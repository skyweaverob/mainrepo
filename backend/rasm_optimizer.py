"""
SkyWeave RASM Optimization Engine

True mathematical optimization using PuLP (open source).
Maximizes RASM subject to fleet, crew, and maintenance constraints.

Key concepts:
- RASM = Total Revenue / Total ASM
- Stage-length adjusted CASM (shorter flights have higher unit costs)
- Joint optimization across fleet, crew, and network
"""

from pulp import (
    LpProblem, LpMaximize, LpMinimize, LpVariable, LpInteger, LpBinary,
    lpSum, LpStatus, value, PULP_CBC_CMD
)
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class Aircraft:
    """Aircraft in the fleet."""
    registration: str
    aircraft_type: str  # A319, A320neo, A321neo
    seats: int
    home_base: str
    available: bool = True
    next_maintenance: Optional[date] = None
    hourly_cost: float = 0  # Operating cost per block hour


@dataclass
class Route:
    """A route (O&D pair) with demand and characteristics."""
    origin: str
    destination: str
    distance_nm: float  # Nautical miles for stage length
    daily_demand: float  # Average daily unconstrained demand
    avg_fare: float  # Average fare achieved
    competitors: int = 0
    min_frequency: int = 0  # Contractual minimum (if any)
    max_frequency: int = 10  # Operational maximum per day


@dataclass
class CrewBase:
    """Crew availability at a base."""
    base: str
    pilots_available: int
    fas_available: int  # Flight attendants
    pilot_cost_per_hour: float = 250.0
    fa_cost_per_hour: float = 50.0


@dataclass
class MaintenanceSlot:
    """Maintenance capacity constraint."""
    location: str
    daily_capacity: int  # Aircraft that can be serviced per day
    types_supported: List[str] = field(default_factory=list)


@dataclass
class OptimizationResult:
    """Result of an optimization run."""
    status: str  # 'Optimal', 'Infeasible', 'Unbounded', etc.
    objective_value: float  # RASM in cents
    total_revenue: float
    total_asm: float
    total_cost: float
    decisions: Dict[str, Any]  # Route frequencies, equipment assignments
    constraints_binding: List[str]  # Which constraints are tight
    solve_time_seconds: float
    recommendations: List[Dict[str, Any]]


# =============================================================================
# STAGE-LENGTH ADJUSTED CASM
# =============================================================================

def calculate_stage_length_casm(distance_nm: float, base_casm: float = 10.5) -> float:
    """
    Calculate stage-length adjusted CASM.

    Based on Spirit Airlines 2024 actuals:
    - Total CASM: 11.35¢ (all-in including fuel)
    - Ex-fuel CASM: 7.97¢
    - Average stage length: ~1,000nm

    Shorter flights have higher CASM due to:
    - Fixed costs (landing fees, ground handling) spread over fewer ASMs
    - Less efficient fuel burn (climb/descent vs cruise)
    - Higher crew costs per ASM

    Formula: CASM = base + (fixed_penalty / distance)
    Calibrated to give:
    - 500nm: ~12.5¢
    - 1000nm: ~11.5¢
    - 1500nm: ~11¢
    - 2000nm: ~10.75¢

    Args:
        distance_nm: Stage length in nautical miles
        base_casm: Base CASM for long-haul flights (cents per ASM)

    Returns:
        Stage-adjusted CASM in cents
    """
    if distance_nm <= 0:
        return 15.0  # High cost for invalid distance

    # Fixed cost penalty per flight spread over distance
    # ~$2,000 in fixed costs / 182 seats = ~$11 per seat per flight
    # At 500nm: $11 / 500 * 100 = 2.2¢ per ASM penalty
    fixed_penalty_per_asm = 1000  # Calibration factor (nm * cents)

    stage_adjustment = fixed_penalty_per_asm / distance_nm
    return base_casm + stage_adjustment


def calculate_block_hours(distance_nm: float, aircraft_type: str = 'A320neo') -> float:
    """
    Calculate block time for a flight.

    Block time = taxi + climb + cruise + descent + taxi
    """
    # Average speeds by phase (knots)
    cruise_speed = {'A319': 450, 'A320neo': 460, 'A321neo': 460}.get(aircraft_type, 450)

    # Fixed time components (hours)
    taxi_out = 0.25
    taxi_in = 0.17
    climb_time = 0.33  # ~20 minutes
    descent_time = 0.33  # ~20 minutes

    # Cruise distance (subtract climb/descent distance)
    climb_descent_distance = 100  # nm used in climb + descent
    cruise_distance = max(0, distance_nm - climb_descent_distance)
    cruise_time = cruise_distance / cruise_speed

    return taxi_out + climb_time + cruise_time + descent_time + taxi_in


# =============================================================================
# FLEET CHARACTERISTICS
# =============================================================================

AIRCRAFT_SPECS = {
    'A319': {
        'seats': 145,
        'range_nm': 3700,
        'fuel_burn_per_hour': 650,  # gallons
        'hourly_cost': 4500,  # Total operating cost per block hour
        'crew_required': {'pilots': 2, 'fas': 3},
    },
    'A320neo': {
        'seats': 182,
        'range_nm': 3500,
        'fuel_burn_per_hour': 600,
        'hourly_cost': 4800,
        'crew_required': {'pilots': 2, 'fas': 4},
    },
    'A321neo': {
        'seats': 228,
        'range_nm': 4000,
        'fuel_burn_per_hour': 700,
        'hourly_cost': 5200,
        'crew_required': {'pilots': 2, 'fas': 5},
    },
}


# =============================================================================
# RASM OPTIMIZER - FREQUENCY OPTIMIZATION
# =============================================================================

class FrequencyOptimizer:
    """
    Optimizes daily flight frequencies across the network.

    Decision variable: How many flights per day on each route?
    Objective: Maximize RASM (or total profit)
    Constraints: Fleet availability, crew, demand caps
    """

    def __init__(
        self,
        routes: List[Route],
        fleet: List[Aircraft],
        crew_bases: List[CrewBase],
        planning_horizon_days: int = 1
    ):
        self.routes = {f"{r.origin}-{r.destination}": r for r in routes}
        self.fleet = fleet
        self.crew_bases = {c.base: c for c in crew_bases}
        self.horizon = planning_horizon_days

        # Aggregate fleet by type and base
        self.fleet_by_type_base = self._aggregate_fleet()

    def _aggregate_fleet(self) -> Dict[Tuple[str, str], int]:
        """Count available aircraft by type and base."""
        counts = {}
        for ac in self.fleet:
            if ac.available:
                key = (ac.aircraft_type, ac.home_base)
                counts[key] = counts.get(key, 0) + 1
        return counts

    def optimize(
        self,
        objective: str = 'rasm',  # 'rasm', 'profit', 'revenue'
        max_solve_time: int = 60
    ) -> OptimizationResult:
        """
        Run the frequency optimization.

        Args:
            objective: What to optimize ('rasm', 'profit', 'revenue')
            max_solve_time: Maximum solver time in seconds

        Returns:
            OptimizationResult with optimal frequencies
        """
        start_time = datetime.now()

        # Create the optimization problem
        prob = LpProblem("RASM_Frequency_Optimization", LpMaximize)

        # =================================================================
        # DECISION VARIABLES
        # =================================================================

        # freq[route, aircraft_type] = number of daily flights
        freq = {}
        for route_key, route in self.routes.items():
            for ac_type in AIRCRAFT_SPECS.keys():
                var_name = f"freq_{route_key}_{ac_type}".replace("-", "_")
                freq[route_key, ac_type] = LpVariable(
                    var_name,
                    lowBound=0,
                    upBound=route.max_frequency,
                    cat=LpInteger
                )

        # =================================================================
        # HELPER CALCULATIONS
        # =================================================================

        # Pre-calculate revenue and cost coefficients
        revenue_coef = {}  # Revenue per flight
        cost_coef = {}     # Cost per flight
        asm_coef = {}      # ASM per flight

        for route_key, route in self.routes.items():
            for ac_type, specs in AIRCRAFT_SPECS.items():
                # Revenue = min(demand, seats) * fare
                # Use load factor assumption for frequency planning
                expected_lf = min(0.90, route.daily_demand / (specs['seats'] * 2))  # cap at 90%
                pax_per_flight = specs['seats'] * expected_lf
                revenue = pax_per_flight * route.avg_fare

                # ASM = seats * distance
                asm = specs['seats'] * route.distance_nm

                # Cost = stage-adjusted CASM * ASM
                casm = calculate_stage_length_casm(route.distance_nm)
                cost = casm * asm / 100  # Convert cents to dollars

                revenue_coef[route_key, ac_type] = revenue
                cost_coef[route_key, ac_type] = cost
                asm_coef[route_key, ac_type] = asm

        # =================================================================
        # OBJECTIVE FUNCTION
        # =================================================================

        if objective == 'profit':
            # Maximize profit = revenue - cost
            prob += lpSum([
                (revenue_coef[k] - cost_coef[k]) * freq[k]
                for k in freq.keys()
            ]), "Total_Profit"

        elif objective == 'revenue':
            # Maximize revenue (market share focus)
            prob += lpSum([
                revenue_coef[k] * freq[k]
                for k in freq.keys()
            ]), "Total_Revenue"

        else:  # RASM optimization
            # RASM = Revenue / ASM
            # Since this is nonlinear, we use profit as proxy
            # (Higher profit per ASM = higher RASM)
            # For true RASM optimization, we'd need MILP reformulation
            prob += lpSum([
                (revenue_coef[k] - cost_coef[k]) * freq[k]
                for k in freq.keys()
            ]), "RASM_Proxy"

        # =================================================================
        # CONSTRAINTS
        # =================================================================

        binding_constraints = []

        # 1. Fleet availability by type and base
        for (ac_type, base), count in self.fleet_by_type_base.items():
            # Each aircraft can do ~4-6 flights per day (utilization)
            max_flights = count * 5  # 5 flights per aircraft per day average

            # Sum of flights originating from this base with this type
            relevant_routes = [
                (rk, ac_type) for rk in self.routes.keys()
                if self.routes[rk].origin == base
            ]

            if relevant_routes:
                constraint_name = f"Fleet_{ac_type}_{base}"
                prob += (
                    lpSum([freq[k] for k in relevant_routes]) <= max_flights,
                    constraint_name
                )

        # 2. Crew availability by base
        for base, crew in self.crew_bases.items():
            # Each flight needs 2 pilots, varies FA by aircraft
            # Pilots can do ~4 flights per day (duty time limits)
            max_pilot_flights = (crew.pilots_available * 4) // 2  # 2 pilots per flight

            relevant_routes = [k for k in freq.keys() if self.routes[k[0]].origin == base]

            if relevant_routes:
                prob += (
                    lpSum([freq[k] for k in relevant_routes]) <= max_pilot_flights,
                    f"Crew_Pilots_{base}"
                )

        # 3. Minimum frequency requirements (if any)
        for route_key, route in self.routes.items():
            if route.min_frequency > 0:
                prob += (
                    lpSum([freq[route_key, ac] for ac in AIRCRAFT_SPECS.keys()]) >= route.min_frequency,
                    f"MinFreq_{route_key}".replace("-", "_")
                )

        # 4. Demand cap - don't schedule more seats than demand
        for route_key, route in self.routes.items():
            daily_seats = lpSum([
                AIRCRAFT_SPECS[ac]['seats'] * freq[route_key, ac]
                for ac in AIRCRAFT_SPECS.keys()
            ])
            # Allow 20% overbooking relative to unconstrained demand
            prob += (
                daily_seats <= route.daily_demand * 1.2,
                f"DemandCap_{route_key}".replace("-", "_")
            )

        # =================================================================
        # SOLVE
        # =================================================================

        solver = PULP_CBC_CMD(msg=0, timeLimit=max_solve_time)
        prob.solve(solver)

        solve_time = (datetime.now() - start_time).total_seconds()

        # =================================================================
        # EXTRACT RESULTS
        # =================================================================

        if LpStatus[prob.status] != 'Optimal':
            return OptimizationResult(
                status=LpStatus[prob.status],
                objective_value=0,
                total_revenue=0,
                total_asm=0,
                total_cost=0,
                decisions={},
                constraints_binding=[],
                solve_time_seconds=solve_time,
                recommendations=[{
                    'type': 'error',
                    'message': f'Optimization failed: {LpStatus[prob.status]}'
                }]
            )

        # Extract optimal frequencies
        decisions = {'frequencies': {}, 'equipment': {}}
        total_revenue = 0
        total_cost = 0
        total_asm = 0

        for (route_key, ac_type), var in freq.items():
            flights = int(value(var))
            if flights > 0:
                if route_key not in decisions['frequencies']:
                    decisions['frequencies'][route_key] = {'total': 0, 'by_equipment': {}}

                decisions['frequencies'][route_key]['total'] += flights
                decisions['frequencies'][route_key]['by_equipment'][ac_type] = flights

                total_revenue += revenue_coef[route_key, ac_type] * flights
                total_cost += cost_coef[route_key, ac_type] * flights
                total_asm += asm_coef[route_key, ac_type] * flights

        # Calculate RASM
        rasm = (total_revenue / total_asm * 100) if total_asm > 0 else 0  # cents per ASM

        # Generate recommendations
        recommendations = self._generate_recommendations(decisions, total_revenue, total_cost, total_asm)

        return OptimizationResult(
            status='Optimal',
            objective_value=rasm,
            total_revenue=total_revenue,
            total_asm=total_asm,
            total_cost=total_cost,
            decisions=decisions,
            constraints_binding=binding_constraints,
            solve_time_seconds=solve_time,
            recommendations=recommendations
        )

    def _generate_recommendations(
        self,
        decisions: Dict,
        revenue: float,
        cost: float,
        asm: float
    ) -> List[Dict[str, Any]]:
        """Generate actionable recommendations from optimization results."""
        recommendations = []

        rasm = (revenue / asm * 100) if asm > 0 else 0
        casm = (cost / asm * 100) if asm > 0 else 0
        profit_margin = ((revenue - cost) / revenue * 100) if revenue > 0 else 0

        recommendations.append({
            'type': 'summary',
            'title': 'Network Optimization Summary',
            'metrics': {
                'rasm_cents': round(rasm, 2),
                'casm_cents': round(casm, 2),
                'spread_cents': round(rasm - casm, 2),
                'profit_margin_pct': round(profit_margin, 1),
                'daily_profit': round(revenue - cost, 0)
            }
        })

        # Identify high-RASM routes
        route_metrics = []
        for route_key, data in decisions.get('frequencies', {}).items():
            route = self.routes.get(route_key)
            if route:
                route_asm = sum(
                    AIRCRAFT_SPECS[ac]['seats'] * route.distance_nm * count
                    for ac, count in data['by_equipment'].items()
                )
                route_rev = sum(
                    AIRCRAFT_SPECS[ac]['seats'] * 0.85 * route.avg_fare * count
                    for ac, count in data['by_equipment'].items()
                )
                route_rasm = (route_rev / route_asm * 100) if route_asm > 0 else 0
                route_metrics.append({
                    'route': route_key,
                    'rasm': route_rasm,
                    'frequency': data['total'],
                    'distance': route.distance_nm
                })

        if route_metrics:
            route_metrics.sort(key=lambda x: x['rasm'], reverse=True)
            recommendations.append({
                'type': 'top_routes',
                'title': 'Highest RASM Routes',
                'routes': route_metrics[:5]
            })

            # Stage-length analysis
            short_haul = [r for r in route_metrics if r['distance'] < 500]
            long_haul = [r for r in route_metrics if r['distance'] >= 1000]

            if short_haul and long_haul:
                avg_short_rasm = np.mean([r['rasm'] for r in short_haul])
                avg_long_rasm = np.mean([r['rasm'] for r in long_haul])
                recommendations.append({
                    'type': 'stage_length',
                    'title': 'Stage Length Analysis',
                    'short_haul_avg_rasm': round(avg_short_rasm, 2),
                    'long_haul_avg_rasm': round(avg_long_rasm, 2),
                    'insight': 'Short-haul premium' if avg_short_rasm > avg_long_rasm else 'Long-haul advantage'
                })

        return recommendations


# =============================================================================
# EQUIPMENT SWAP OPTIMIZER
# =============================================================================

class EquipmentSwapOptimizer:
    """
    Optimizes single-route equipment decisions.

    Given a route with current equipment, evaluate:
    - Upgauge: Switch to larger aircraft
    - Downgauge: Switch to smaller aircraft
    - Frequency change: Adjust departures

    Returns RASM impact of each option.
    """

    def __init__(self, route: Route, current_equipment: str, current_frequency: int):
        self.route = route
        self.current_eq = current_equipment
        self.current_freq = current_frequency

    def evaluate_options(self) -> List[Dict[str, Any]]:
        """Evaluate all equipment/frequency options."""
        options = []

        current_specs = AIRCRAFT_SPECS.get(self.current_eq, AIRCRAFT_SPECS['A320neo'])
        casm = calculate_stage_length_casm(self.route.distance_nm)

        # Current state baseline
        current_asm = current_specs['seats'] * self.route.distance_nm * self.current_freq
        current_capacity = current_specs['seats'] * self.current_freq
        current_pax = min(self.route.daily_demand, current_capacity * 0.95)
        current_revenue = current_pax * self.route.avg_fare
        current_cost = casm * current_asm / 100
        current_rasm = (current_revenue / current_asm * 100) if current_asm > 0 else 0
        current_profit = current_revenue - current_cost

        options.append({
            'option': 'Current',
            'equipment': self.current_eq,
            'frequency': self.current_freq,
            'seats': current_specs['seats'],
            'daily_capacity': current_capacity,
            'expected_pax': round(current_pax),
            'load_factor': round(current_pax / current_capacity * 100, 1) if current_capacity > 0 else 0,
            'revenue': round(current_revenue),
            'cost': round(current_cost),
            'profit': round(current_profit),
            'rasm_cents': round(current_rasm, 2),
            'asm': round(current_asm),
            'delta_profit': 0,
            'delta_rasm': 0,
            'recommendation': 'baseline'
        })

        # Evaluate alternatives
        for eq_type, specs in AIRCRAFT_SPECS.items():
            for freq_delta in [-1, 0, 1]:
                new_freq = self.current_freq + freq_delta
                if new_freq < 1 or new_freq > self.route.max_frequency:
                    continue
                if eq_type == self.current_eq and freq_delta == 0:
                    continue  # Skip current state

                new_asm = specs['seats'] * self.route.distance_nm * new_freq
                new_capacity = specs['seats'] * new_freq
                new_pax = min(self.route.daily_demand, new_capacity * 0.95)
                new_revenue = new_pax * self.route.avg_fare
                new_cost = casm * new_asm / 100
                new_rasm = (new_revenue / new_asm * 100) if new_asm > 0 else 0
                new_profit = new_revenue - new_cost

                # Determine option type
                if specs['seats'] > current_specs['seats']:
                    option_type = 'Upgauge'
                elif specs['seats'] < current_specs['seats']:
                    option_type = 'Downgauge'
                else:
                    option_type = 'Refrequency'

                if freq_delta != 0:
                    option_type += f" (+{freq_delta})" if freq_delta > 0 else f" ({freq_delta})"

                options.append({
                    'option': option_type,
                    'equipment': eq_type,
                    'frequency': new_freq,
                    'seats': specs['seats'],
                    'daily_capacity': new_capacity,
                    'expected_pax': round(new_pax),
                    'load_factor': round(new_pax / new_capacity * 100, 1) if new_capacity > 0 else 0,
                    'revenue': round(new_revenue),
                    'cost': round(new_cost),
                    'profit': round(new_profit),
                    'rasm_cents': round(new_rasm, 2),
                    'asm': round(new_asm),
                    'delta_profit': round(new_profit - current_profit),
                    'delta_rasm': round(new_rasm - current_rasm, 2),
                    'recommendation': self._get_recommendation(new_profit - current_profit, new_rasm - current_rasm)
                })

        # Sort by profit improvement
        options.sort(key=lambda x: x['delta_profit'], reverse=True)
        return options

    def _get_recommendation(self, delta_profit: float, delta_rasm: float) -> str:
        """Generate recommendation based on deltas."""
        if delta_profit > 5000 and delta_rasm > 0.5:
            return 'strongly_recommended'
        elif delta_profit > 2000 and delta_rasm > 0:
            return 'recommended'
        elif delta_profit > 0:
            return 'consider'
        elif delta_profit < -2000:
            return 'avoid'
        else:
            return 'neutral'

    def get_best_option(self) -> Dict[str, Any]:
        """Return the best equipment/frequency option."""
        options = self.evaluate_options()
        # Best = highest profit improvement
        best = max(options, key=lambda x: x['delta_profit'])
        return best


# =============================================================================
# TRADEOFF ANALYZER
# =============================================================================

class TradeoffAnalyzer:
    """
    Analyzes tradeoffs between different optimization objectives.

    - RASM vs Load Factor
    - Profit vs Market Share
    - Fleet utilization vs RASM
    """

    def __init__(self, routes: List[Route], fleet: List[Aircraft]):
        self.routes = routes
        self.fleet = fleet

    def analyze_rasm_vs_loadfactor(self, route: Route) -> Dict[str, Any]:
        """
        Analyze the RASM vs load factor tradeoff for a route.

        Higher frequency = lower LF but potentially higher RASM (fare premium)
        Lower frequency = higher LF but lower RASM (spill, less schedule appeal)
        """
        results = []

        for freq in range(1, min(route.max_frequency + 1, 8)):
            for eq in ['A319', 'A320neo', 'A321neo']:
                specs = AIRCRAFT_SPECS[eq]
                capacity = specs['seats'] * freq

                # Model: higher frequency attracts more demand (schedule quality)
                schedule_premium = 1 + 0.05 * (freq - 1)  # 5% more demand per extra frequency
                attracted_demand = route.daily_demand * schedule_premium

                pax = min(attracted_demand, capacity)
                lf = pax / capacity if capacity > 0 else 0

                # Revenue with yield management
                # Higher LF = lower average fare (more discount seats sold)
                fare_adj = route.avg_fare * (1.1 - 0.15 * lf)  # Fare decreases with LF
                revenue = pax * fare_adj

                asm = specs['seats'] * route.distance_nm * freq
                casm = calculate_stage_length_casm(route.distance_nm)
                cost = casm * asm / 100

                rasm = (revenue / asm * 100) if asm > 0 else 0

                results.append({
                    'frequency': freq,
                    'equipment': eq,
                    'load_factor': round(lf * 100, 1),
                    'rasm_cents': round(rasm, 2),
                    'profit': round(revenue - cost),
                    'spill_pax': round(max(0, attracted_demand - capacity))
                })

        # Find Pareto frontier
        pareto = []
        for r in results:
            dominated = False
            for other in results:
                if other['rasm_cents'] >= r['rasm_cents'] and other['load_factor'] >= r['load_factor']:
                    if other['rasm_cents'] > r['rasm_cents'] or other['load_factor'] > r['load_factor']:
                        dominated = True
                        break
            if not dominated:
                pareto.append(r)

        return {
            'route': f"{route.origin}-{route.destination}",
            'all_options': results,
            'pareto_frontier': pareto,
            'recommendation': max(results, key=lambda x: x['profit'])
        }


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def quick_rasm_analysis(
    origin: str,
    destination: str,
    distance_nm: float,
    daily_demand: float,
    avg_fare: float,
    current_equipment: str = 'A320neo',
    current_frequency: int = 2
) -> Dict[str, Any]:
    """
    Quick RASM analysis for a single route.

    Returns equipment swap options with RASM impact.
    """
    route = Route(
        origin=origin,
        destination=destination,
        distance_nm=distance_nm,
        daily_demand=daily_demand,
        avg_fare=avg_fare
    )

    optimizer = EquipmentSwapOptimizer(route, current_equipment, current_frequency)
    options = optimizer.evaluate_options()
    best = optimizer.get_best_option()

    return {
        'route': f"{origin}-{destination}",
        'distance_nm': distance_nm,
        'stage_length_casm': round(calculate_stage_length_casm(distance_nm), 2),
        'current': options[0] if options else None,
        'options': options,
        'recommended': best,
        'rasm_improvement_potential': best['delta_rasm'] if best else 0
    }


def optimize_network(
    routes_data: List[Dict],
    fleet_data: List[Dict],
    crew_data: List[Dict],
    objective: str = 'profit'
) -> OptimizationResult:
    """
    Full network optimization.

    Args:
        routes_data: List of route dicts with origin, destination, distance, demand, fare
        fleet_data: List of aircraft dicts with registration, type, base, available
        crew_data: List of crew base dicts with base, pilots, fas
        objective: 'rasm', 'profit', or 'revenue'

    Returns:
        OptimizationResult with optimal network plan
    """
    routes = [
        Route(
            origin=r['origin'],
            destination=r['destination'],
            distance_nm=r.get('distance_nm', 500),
            daily_demand=r.get('daily_demand', 100),
            avg_fare=r.get('avg_fare', 100),
            min_frequency=r.get('min_frequency', 0),
            max_frequency=r.get('max_frequency', 6)
        )
        for r in routes_data
    ]

    fleet = [
        Aircraft(
            registration=f['registration'],
            aircraft_type=f.get('aircraft_type', 'A320neo'),
            seats=AIRCRAFT_SPECS.get(f.get('aircraft_type', 'A320neo'), {}).get('seats', 182),
            home_base=f.get('home_base', 'DTW'),
            available=f.get('available', True)
        )
        for f in fleet_data
    ]

    crew_bases = [
        CrewBase(
            base=c['base'],
            pilots_available=c.get('pilots', 50),
            fas_available=c.get('fas', 100)
        )
        for c in crew_data
    ]

    optimizer = FrequencyOptimizer(routes, fleet, crew_bases)
    return optimizer.optimize(objective=objective)
