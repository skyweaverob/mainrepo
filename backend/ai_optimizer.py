"""
SkyWeave AI-Enhanced Optimization Engine

Combines mathematical optimization (PuLP) with machine learning for:
- Demand forecasting
- Price elasticity estimation
- Smart route recommendations
- Scenario outcome prediction

Uses scikit-learn for ML (open source, no API costs).
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, date, timedelta
import logging
import json

# ML imports - using scikit-learn (open source)
try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import cross_val_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.warning("scikit-learn not available. AI features disabled.")

from rasm_optimizer import (
    Route, Aircraft, OptimizationResult,
    calculate_stage_length_casm, calculate_block_hours,
    AIRCRAFT_SPECS, FrequencyOptimizer, EquipmentSwapOptimizer
)

logger = logging.getLogger(__name__)


# =============================================================================
# AI DEMAND FORECASTER
# =============================================================================

class DemandForecaster:
    """
    ML-based demand forecasting using route features.

    Features used:
    - Distance (stage length)
    - Day of week
    - Month (seasonality)
    - Origin/destination characteristics
    - Historical load factors
    - Competitor presence
    - Events/holidays
    """

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler() if SKLEARN_AVAILABLE else None
        self.is_trained = False
        self.feature_names = [
            'distance_nm', 'day_of_week', 'month', 'is_weekend',
            'origin_is_hub', 'dest_is_leisure', 'dest_is_business',
            'competitor_count', 'historical_lf', 'seats_offered',
            'days_until_departure', 'is_holiday_period'
        ]

    def _extract_features(self, route_data: Dict) -> np.ndarray:
        """Extract ML features from route data."""
        features = [
            route_data.get('distance_nm', 500),
            route_data.get('day_of_week', 3),  # 0=Mon, 6=Sun
            route_data.get('month', 6),
            1 if route_data.get('day_of_week', 3) >= 5 else 0,
            1 if route_data.get('origin', '') in ['DTW', 'MCO', 'FLL', 'LAS', 'EWR'] else 0,
            1 if route_data.get('destination', '') in ['MCO', 'FLL', 'LAS', 'CUN', 'SJU'] else 0,
            1 if route_data.get('destination', '') in ['JFK', 'ORD', 'LAX', 'DFW', 'ATL'] else 0,
            route_data.get('competitor_count', 2),
            route_data.get('historical_lf', 0.85),
            route_data.get('seats_offered', 182),
            route_data.get('days_until_departure', 30),
            1 if route_data.get('is_holiday', False) else 0
        ]
        return np.array(features).reshape(1, -1)

    def train(self, historical_data: List[Dict]) -> Dict[str, float]:
        """
        Train the demand forecasting model on historical data.

        Args:
            historical_data: List of dicts with route features and actual_demand

        Returns:
            Training metrics (R2, MAE, etc.)
        """
        if not SKLEARN_AVAILABLE or len(historical_data) < 10:
            return {'status': 'insufficient_data', 'r2': 0}

        X = np.array([
            self._extract_features(d).flatten() for d in historical_data
        ])
        y = np.array([d.get('actual_demand', 100) for d in historical_data])

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Train model
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.model.fit(X_scaled, y)

        # Cross-validation score
        cv_scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring='r2')

        self.is_trained = True

        return {
            'status': 'trained',
            'r2': float(np.mean(cv_scores)),
            'samples': len(historical_data),
            'feature_importance': dict(zip(
                self.feature_names,
                self.model.feature_importances_.tolist()
            ))
        }

    def predict(self, route_data: Dict) -> Dict[str, Any]:
        """
        Predict demand for a route.

        Returns predicted demand with confidence interval.
        """
        if not self.is_trained or not SKLEARN_AVAILABLE:
            # Fallback to heuristic
            return self._heuristic_demand(route_data)

        X = self._extract_features(route_data)
        X_scaled = self.scaler.transform(X)

        prediction = self.model.predict(X_scaled)[0]

        # Estimate confidence using tree variance
        tree_predictions = np.array([
            tree.predict(X_scaled)[0]
            for tree in self.model.estimators_
        ])
        std = np.std(tree_predictions)

        return {
            'predicted_demand': max(0, int(prediction)),
            'confidence_interval': [
                max(0, int(prediction - 2 * std)),
                int(prediction + 2 * std)
            ],
            'confidence_level': 'high' if std < prediction * 0.1 else 'medium' if std < prediction * 0.2 else 'low',
            'model_used': 'gradient_boosting'
        }

    def _heuristic_demand(self, route_data: Dict) -> Dict[str, Any]:
        """Fallback heuristic demand estimation with external signal support."""
        base_demand = 150  # Base daily demand

        # Adjustments
        if route_data.get('dest_is_leisure', False):
            base_demand *= 1.3
        if route_data.get('is_weekend', False):
            base_demand *= 1.2
        if route_data.get('competitor_count', 2) > 3:
            base_demand *= 0.8

        # External signal adjustments (from live data sources)
        event_boost = route_data.get('event_demand_boost', 1.0)
        trend_signal = route_data.get('trend_signal_strength', 0.5)
        weather_factor = route_data.get('weather_leisure_signal', 1.0)

        # Apply external signals
        base_demand *= event_boost
        base_demand *= (1 + (trend_signal - 0.5) * 0.2)  # ±10% based on trends
        base_demand *= weather_factor

        return {
            'predicted_demand': int(base_demand),
            'confidence_interval': [int(base_demand * 0.7), int(base_demand * 1.3)],
            'confidence_level': 'low',
            'model_used': 'heuristic',
            'external_signals_applied': {
                'event_boost': event_boost,
                'trend_signal': trend_signal,
                'weather_factor': weather_factor
            }
        }


# =============================================================================
# AI PRICE ELASTICITY ESTIMATOR
# =============================================================================

class PriceElasticityModel:
    """
    Estimates price elasticity of demand for each route.

    Elasticity = % change in demand / % change in price

    Used to optimize pricing and understand RASM tradeoffs.
    """

    # Base elasticities by segment (from airline industry research)
    SEGMENT_ELASTICITIES = {
        'business': -0.7,   # Inelastic - will pay higher fares
        'leisure': -1.5,    # Elastic - price sensitive
        'vfr': -1.2,        # Moderate - must travel but price aware
        'cruise': -1.0,     # Moderate - date-fixed but will compare
    }

    def estimate_elasticity(
        self,
        route: Route,
        segment_mix: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Estimate price elasticity for a route based on segment mix.
        """
        # Weighted average elasticity
        weighted_elasticity = sum(
            self.SEGMENT_ELASTICITIES.get(seg, -1.2) * share
            for seg, share in segment_mix.items()
        )

        # Adjust for competition
        competition_factor = 1 + 0.1 * route.competitors
        adjusted_elasticity = weighted_elasticity * competition_factor

        return {
            'elasticity': round(adjusted_elasticity, 2),
            'interpretation': self._interpret_elasticity(adjusted_elasticity),
            'pricing_recommendation': self._pricing_recommendation(adjusted_elasticity, route),
            'segment_mix': segment_mix
        }

    def _interpret_elasticity(self, e: float) -> str:
        if e > -0.5:
            return "Highly inelastic - strong pricing power"
        elif e > -1.0:
            return "Inelastic - moderate pricing power"
        elif e > -1.5:
            return "Unit elastic - balanced"
        else:
            return "Elastic - price sensitive market"

    def _pricing_recommendation(self, elasticity: float, route: Route) -> Dict[str, Any]:
        """Generate pricing recommendation based on elasticity."""
        if elasticity > -0.8:
            return {
                'action': 'increase_fares',
                'suggested_change_pct': 5,
                'expected_demand_change_pct': round(5 * elasticity, 1),
                'expected_revenue_change_pct': round(5 + 5 * elasticity, 1)
            }
        elif elasticity < -1.3:
            return {
                'action': 'decrease_fares',
                'suggested_change_pct': -5,
                'expected_demand_change_pct': round(-5 * elasticity, 1),
                'expected_revenue_change_pct': round(-5 + -5 * elasticity, 1)
            }
        else:
            return {
                'action': 'maintain_fares',
                'suggested_change_pct': 0,
                'expected_demand_change_pct': 0,
                'expected_revenue_change_pct': 0
            }


# =============================================================================
# AI ROUTE SCORER
# =============================================================================

class AIRouteScorer:
    """
    AI-powered route scoring for network planning.

    Scores routes on multiple dimensions:
    - RASM potential
    - Strategic fit
    - Risk level
    - Growth potential
    """

    def score_route(
        self,
        route: Route,
        fleet_fit: Dict[str, bool],
        crew_availability: bool,
        market_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive AI score for a route.
        """
        scores = {}

        # 1. RASM Score (0-100)
        casm = calculate_stage_length_casm(route.distance_nm)
        expected_yield = route.avg_fare / route.distance_nm if route.distance_nm > 0 else 0
        rasm_margin = expected_yield - (casm / 100)  # dollars per mile
        scores['rasm_score'] = min(100, max(0, 50 + rasm_margin * 500))

        # 2. Strategic Fit (0-100)
        hub_routes = ['DTW', 'MCO', 'FLL', 'LAS', 'EWR']
        strategic_score = 50
        if route.origin in hub_routes:
            strategic_score += 20
        if route.destination in hub_routes:
            strategic_score += 15
        if route.competitors < 2:
            strategic_score += 15  # Underserved market
        scores['strategic_score'] = min(100, strategic_score)

        # 3. Risk Score (0-100, higher = less risky)
        risk_score = 70
        if route.daily_demand < 50:
            risk_score -= 20  # Low demand risk
        if route.competitors > 4:
            risk_score -= 15  # High competition risk
        if not crew_availability:
            risk_score -= 25  # Crew constraint risk
        scores['risk_score'] = max(0, risk_score)

        # 4. Growth Potential (0-100)
        growth_score = 50
        leisure_destinations = ['MCO', 'FLL', 'LAS', 'CUN', 'SJU', 'PUJ']
        if route.destination in leisure_destinations:
            growth_score += 25
        if route.daily_demand > route.max_frequency * 150:
            growth_score += 20  # Spill indicates growth potential
        scores['growth_score'] = min(100, growth_score)

        # Overall AI Score (weighted average)
        weights = {'rasm': 0.35, 'strategic': 0.25, 'risk': 0.20, 'growth': 0.20}
        overall = (
            weights['rasm'] * scores['rasm_score'] +
            weights['strategic'] * scores['strategic_score'] +
            weights['risk'] * scores['risk_score'] +
            weights['growth'] * scores['growth_score']
        )

        return {
            'route': f"{route.origin}-{route.destination}",
            'overall_score': round(overall, 1),
            'scores': {k: round(v, 1) for k, v in scores.items()},
            'recommendation': self._generate_recommendation(overall, scores),
            'key_factors': self._identify_key_factors(scores)
        }

    def _generate_recommendation(self, overall: float, scores: Dict) -> str:
        if overall >= 80:
            return "STRONG BUY - High RASM potential with manageable risk"
        elif overall >= 65:
            return "BUY - Good opportunity with some optimization needed"
        elif overall >= 50:
            return "HOLD - Monitor and optimize existing operation"
        elif overall >= 35:
            return "REDUCE - Consider frequency reduction or exit"
        else:
            return "EXIT - Route not meeting RASM targets"

    def _identify_key_factors(self, scores: Dict) -> List[str]:
        factors = []
        if scores.get('rasm_score', 0) >= 70:
            factors.append("Strong unit revenue")
        if scores.get('rasm_score', 0) < 40:
            factors.append("Weak unit revenue - stage length challenge")
        if scores.get('risk_score', 0) < 50:
            factors.append("Elevated operational risk")
        if scores.get('growth_score', 0) >= 70:
            factors.append("High growth potential")
        return factors


# =============================================================================
# AI-ENHANCED OPTIMIZER
# =============================================================================

class AIOptimizer:
    """
    Main AI-enhanced optimization engine.

    Combines:
    - Mathematical optimization (PuLP solver)
    - ML demand forecasting
    - Price elasticity modeling
    - Smart recommendations
    """

    def __init__(self):
        self.demand_forecaster = DemandForecaster()
        self.elasticity_model = PriceElasticityModel()
        self.route_scorer = AIRouteScorer()

    def optimize_route(
        self,
        origin: str,
        destination: str,
        distance_nm: float,
        current_equipment: str,
        current_frequency: int,
        current_fare: float,
        daily_demand: float,
        segment_mix: Optional[Dict[str, float]] = None,
        competitor_count: int = 2
    ) -> Dict[str, Any]:
        """
        AI-enhanced single route optimization.

        Returns comprehensive analysis with recommendations.
        """
        # Create route object
        route = Route(
            origin=origin,
            destination=destination,
            distance_nm=distance_nm,
            daily_demand=daily_demand,
            avg_fare=current_fare,
            competitors=competitor_count
        )

        # Default segment mix if not provided
        if segment_mix is None:
            segment_mix = {'leisure': 0.4, 'vfr': 0.3, 'business': 0.2, 'cruise': 0.1}

        # 1. Equipment swap analysis (mathematical optimization)
        swap_optimizer = EquipmentSwapOptimizer(route, current_equipment, current_frequency)
        equipment_options = swap_optimizer.evaluate_options()
        best_equipment = swap_optimizer.get_best_option()

        # 2. Demand forecast
        demand_forecast = self.demand_forecaster.predict({
            'origin': origin,
            'destination': destination,
            'distance_nm': distance_nm,
            'seats_offered': AIRCRAFT_SPECS.get(current_equipment, {}).get('seats', 182) * current_frequency,
            'competitor_count': competitor_count
        })

        # 3. Price elasticity analysis
        elasticity_analysis = self.elasticity_model.estimate_elasticity(route, segment_mix)

        # 4. AI route score
        route_score = self.route_scorer.score_route(
            route,
            fleet_fit={eq: True for eq in AIRCRAFT_SPECS.keys()},
            crew_availability=True
        )

        # 5. Stage-length adjusted CASM
        casm = calculate_stage_length_casm(distance_nm)

        # 6. Generate unified recommendations
        recommendations = self._generate_unified_recommendations(
            best_equipment,
            demand_forecast,
            elasticity_analysis,
            route_score,
            casm,
            current_fare,
            route
        )

        return {
            'route': f"{origin}-{destination}",
            'distance_nm': distance_nm,
            'stage_length_casm_cents': round(casm, 2),

            'current_state': {
                'equipment': current_equipment,
                'frequency': current_frequency,
                'fare': current_fare,
                'daily_demand': daily_demand,
                'segment_mix': segment_mix
            },

            'equipment_analysis': {
                'options': equipment_options[:5],  # Top 5 options
                'recommended': best_equipment,
                'rasm_improvement_cents': best_equipment['delta_rasm']
            },

            'demand_forecast': demand_forecast,
            'price_elasticity': elasticity_analysis,
            'ai_route_score': route_score,

            'recommendations': recommendations,

            'optimization_summary': {
                'potential_profit_increase': best_equipment['delta_profit'],
                'potential_rasm_increase': best_equipment['delta_rasm'],
                'confidence': 'high' if route_score['overall_score'] > 60 else 'medium'
            }
        }

    def _generate_unified_recommendations(
        self,
        best_equipment: Dict,
        demand_forecast: Dict,
        elasticity: Dict,
        route_score: Dict,
        casm: float,
        current_fare: float,
        route: Route
    ) -> List[Dict[str, Any]]:
        """Generate prioritized list of AI recommendations."""
        recommendations = []

        # Equipment recommendation
        if best_equipment['delta_profit'] > 1000:
            recommendations.append({
                'priority': 1,
                'category': 'equipment',
                'action': f"Switch to {best_equipment['equipment']} at {best_equipment['frequency']}x daily",
                'impact': f"+${best_equipment['delta_profit']:,}/day profit, +{best_equipment['delta_rasm']}¢ RASM",
                'confidence': 'high'
            })

        # Pricing recommendation
        pricing_rec = elasticity.get('pricing_recommendation', {})
        if pricing_rec.get('action') == 'increase_fares':
            recommendations.append({
                'priority': 2,
                'category': 'pricing',
                'action': f"Increase fares by {pricing_rec['suggested_change_pct']}%",
                'impact': f"Expected {pricing_rec['expected_revenue_change_pct']}% revenue change",
                'confidence': 'medium'
            })
        elif pricing_rec.get('action') == 'decrease_fares':
            recommendations.append({
                'priority': 2,
                'category': 'pricing',
                'action': f"Decrease fares by {abs(pricing_rec['suggested_change_pct'])}%",
                'impact': f"Capture demand, expected {pricing_rec['expected_revenue_change_pct']}% revenue change",
                'confidence': 'medium'
            })

        # Demand-based recommendation
        if demand_forecast.get('predicted_demand', 0) > route.daily_demand * 1.2:
            recommendations.append({
                'priority': 3,
                'category': 'capacity',
                'action': "Consider capacity increase - demand exceeds current supply",
                'impact': f"Forecast: {demand_forecast['predicted_demand']} pax vs {route.daily_demand} current",
                'confidence': demand_forecast.get('confidence_level', 'medium')
            })

        # Strategic recommendation
        if route_score['overall_score'] < 40:
            recommendations.append({
                'priority': 1,
                'category': 'strategic',
                'action': "Review route viability - AI score below threshold",
                'impact': route_score['recommendation'],
                'confidence': 'high'
            })
        elif route_score['overall_score'] > 75:
            recommendations.append({
                'priority': 4,
                'category': 'strategic',
                'action': "Growth opportunity - consider frequency increase",
                'impact': "High AI score indicates strong market position",
                'confidence': 'high'
            })

        # Sort by priority
        recommendations.sort(key=lambda x: x['priority'])

        return recommendations

    def optimize_network(
        self,
        routes: List[Dict],
        fleet: List[Dict],
        crew: List[Dict],
        objective: str = 'profit'
    ) -> Dict[str, Any]:
        """
        Full network optimization with AI enhancements.
        """
        # Convert to proper objects
        route_objects = [
            Route(
                origin=r['origin'],
                destination=r['destination'],
                distance_nm=r.get('distance_nm', 500),
                daily_demand=r.get('daily_demand', 100),
                avg_fare=r.get('avg_fare', 100),
                competitors=r.get('competitors', 2)
            )
            for r in routes
        ]

        # Score all routes with AI
        route_scores = [
            self.route_scorer.score_route(
                r,
                fleet_fit={eq: True for eq in AIRCRAFT_SPECS.keys()},
                crew_availability=True
            )
            for r in route_objects
        ]

        # Run mathematical optimization
        from rasm_optimizer import optimize_network as run_optimization
        opt_result = run_optimization(routes, fleet, crew, objective)

        # Enhance results with AI insights
        return {
            'optimization_result': {
                'status': opt_result.status,
                'objective_value': opt_result.objective_value,
                'total_revenue': opt_result.total_revenue,
                'total_asm': opt_result.total_asm,
                'total_cost': opt_result.total_cost,
                'solve_time': opt_result.solve_time_seconds
            },
            'route_scores': route_scores,
            'decisions': opt_result.decisions,
            'ai_recommendations': opt_result.recommendations,
            'network_health': {
                'avg_route_score': np.mean([s['overall_score'] for s in route_scores]),
                'routes_at_risk': len([s for s in route_scores if s['overall_score'] < 40]),
                'high_performers': len([s for s in route_scores if s['overall_score'] > 70])
            }
        }


# =============================================================================
# SCENARIO SIMULATOR
# =============================================================================

class ScenarioSimulator:
    """
    AI-powered what-if scenario simulation.

    Simulates outcomes of:
    - Route additions/deletions
    - Equipment changes
    - Competitor entry/exit
    - Demand shocks
    """

    def __init__(self):
        self.ai_optimizer = AIOptimizer()

    def simulate_equipment_change(
        self,
        route: Route,
        from_equipment: str,
        to_equipment: str,
        frequency_change: int = 0
    ) -> Dict[str, Any]:
        """Simulate impact of equipment change."""
        from_specs = AIRCRAFT_SPECS.get(from_equipment, AIRCRAFT_SPECS['A320neo'])
        to_specs = AIRCRAFT_SPECS.get(to_equipment, AIRCRAFT_SPECS['A320neo'])

        current_freq = 2  # Assume
        new_freq = current_freq + frequency_change

        # Calculate before/after
        casm = calculate_stage_length_casm(route.distance_nm)

        before_asm = from_specs['seats'] * route.distance_nm * current_freq
        before_capacity = from_specs['seats'] * current_freq
        before_pax = min(route.daily_demand, before_capacity * 0.9)
        before_revenue = before_pax * route.avg_fare
        before_cost = casm * before_asm / 100

        after_asm = to_specs['seats'] * route.distance_nm * new_freq
        after_capacity = to_specs['seats'] * new_freq
        after_pax = min(route.daily_demand, after_capacity * 0.9)
        after_revenue = after_pax * route.avg_fare
        after_cost = casm * after_asm / 100

        return {
            'scenario': f"{from_equipment} → {to_equipment}",
            'frequency_change': frequency_change,
            'before': {
                'equipment': from_equipment,
                'frequency': current_freq,
                'asm': before_asm,
                'revenue': round(before_revenue),
                'cost': round(before_cost),
                'profit': round(before_revenue - before_cost),
                'rasm_cents': round(before_revenue / before_asm * 100, 2) if before_asm > 0 else 0
            },
            'after': {
                'equipment': to_equipment,
                'frequency': new_freq,
                'asm': after_asm,
                'revenue': round(after_revenue),
                'cost': round(after_cost),
                'profit': round(after_revenue - after_cost),
                'rasm_cents': round(after_revenue / after_asm * 100, 2) if after_asm > 0 else 0
            },
            'impact': {
                'delta_profit': round((after_revenue - after_cost) - (before_revenue - before_cost)),
                'delta_rasm': round((after_revenue / after_asm * 100) - (before_revenue / before_asm * 100), 2) if before_asm > 0 and after_asm > 0 else 0,
                'delta_capacity_pct': round((after_capacity - before_capacity) / before_capacity * 100, 1) if before_capacity > 0 else 0
            }
        }

    def simulate_competitor_entry(
        self,
        route: Route,
        competitor_capacity: int,
        competitor_fare_discount: float = 0.1
    ) -> Dict[str, Any]:
        """Simulate impact of competitor entering market."""
        # Competitor takes share proportional to capacity and price
        total_capacity = route.daily_demand * 1.5 + competitor_capacity
        our_share = route.daily_demand * 1.5 / total_capacity

        # Price pressure
        new_fare = route.avg_fare * (1 - competitor_fare_discount * 0.5)

        # New demand for us
        new_demand = route.daily_demand * our_share * 0.9  # Lose some to competitor

        casm = calculate_stage_length_casm(route.distance_nm)
        seats = AIRCRAFT_SPECS['A320neo']['seats']
        asm = seats * route.distance_nm * 2  # Assume 2x daily

        before_revenue = min(route.daily_demand, seats * 2 * 0.9) * route.avg_fare
        after_revenue = min(new_demand, seats * 2 * 0.9) * new_fare
        cost = casm * asm / 100

        return {
            'scenario': f"Competitor entry with {competitor_capacity} daily seats",
            'market_impact': {
                'our_share_before': '100%',
                'our_share_after': f"{our_share * 100:.0f}%",
                'fare_pressure': f"-{competitor_fare_discount * 50:.0f}%",
            },
            'financial_impact': {
                'revenue_before': round(before_revenue),
                'revenue_after': round(after_revenue),
                'revenue_loss': round(before_revenue - after_revenue),
                'profit_before': round(before_revenue - cost),
                'profit_after': round(after_revenue - cost),
            },
            'recommended_response': self._competitor_response(
                before_revenue - after_revenue,
                route
            )
        }

    def _competitor_response(self, revenue_loss: float, route: Route) -> str:
        if revenue_loss > 10000:
            return "DEFEND - Match capacity and consider price response"
        elif revenue_loss > 5000:
            return "MONITOR - Maintain position, optimize costs"
        else:
            return "HOLD - Minimal impact, maintain current strategy"


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def ai_optimize_route(
    origin: str,
    destination: str,
    distance_nm: float,
    current_equipment: str,
    current_frequency: int,
    current_fare: float,
    daily_demand: float,
    segment_mix: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Quick AI-enhanced route optimization.
    """
    optimizer = AIOptimizer()
    return optimizer.optimize_route(
        origin=origin,
        destination=destination,
        distance_nm=distance_nm,
        current_equipment=current_equipment,
        current_frequency=current_frequency,
        current_fare=current_fare,
        daily_demand=daily_demand,
        segment_mix=segment_mix
    )


def get_ai_score(
    origin: str,
    destination: str,
    distance_nm: float,
    daily_demand: float,
    avg_fare: float,
    competitors: int = 2
) -> Dict[str, Any]:
    """
    Get AI score for a route.
    """
    route = Route(
        origin=origin,
        destination=destination,
        distance_nm=distance_nm,
        daily_demand=daily_demand,
        avg_fare=avg_fare,
        competitors=competitors
    )

    scorer = AIRouteScorer()
    return scorer.score_route(
        route,
        fleet_fit={eq: True for eq in AIRCRAFT_SPECS.keys()},
        crew_availability=True
    )
