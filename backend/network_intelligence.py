"""
SkyWeave Network Intelligence Engine

Dynamic network discovery and analysis using:
- DOT T-100 traffic data
- DOT DB1B market fare data
- Live SerpAPI fare scraping
- AirLabs route data
- Competitive intelligence

Replaces static ASG file with real-time market intelligence.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from pathlib import Path
import asyncio
from collections import defaultdict


@dataclass
class MarketIntelligence:
    """Comprehensive market intelligence for a route."""
    origin: str
    destination: str
    market_key: str

    # Traffic data (T-100)
    t100_passengers: int = 0
    t100_carriers: List[str] = field(default_factory=list)
    nk_passengers: int = 0
    f9_passengers: int = 0
    nk_market_share: float = 0.0

    # Fare data (DB1B / scraped)
    avg_fare: float = 0.0
    nk_avg_fare: float = 0.0
    f9_avg_fare: float = 0.0
    fare_advantage: float = 0.0  # NK vs F9
    price_level: str = 'typical'  # low, typical, high

    # Market characteristics
    distance: float = 0.0
    is_overlap_market: bool = False
    competitive_intensity: str = 'moderate'  # low, moderate, high, intense


@dataclass
class NetworkPosition:
    """NK's position in the overall network."""
    total_markets: int = 0
    overlap_markets: int = 0
    nk_only_markets: int = 0
    f9_only_markets: int = 0
    total_nk_passengers: int = 0
    total_f9_passengers: int = 0
    avg_nk_market_share: float = 0.0
    fare_advantage_markets: int = 0
    fare_disadvantage_markets: int = 0


class NetworkIntelligenceEngine:
    """
    Dynamic network discovery engine using multiple data sources.
    """

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.t100_df: Optional[pd.DataFrame] = None
        self.db1b_df: Optional[pd.DataFrame] = None
        self.nk_routes_df: Optional[pd.DataFrame] = None
        self.f9_routes_df: Optional[pd.DataFrame] = None
        self.overlap_df: Optional[pd.DataFrame] = None
        self.scraped_fares_df: Optional[pd.DataFrame] = None
        self._loaded = False

    def load_data(self):
        """Load all available data sources."""
        print("Loading Network Intelligence data sources...")

        # Load T-100 traffic data
        t100_path = self.data_dir / "T_100_OCT.csv"
        if t100_path.exists():
            self.t100_df = pd.read_csv(t100_path)
            # Filter to actual routes (origin != dest) with passengers
            self.t100_df = self.t100_df[
                (self.t100_df['ORIGIN'] != self.t100_df['DEST']) &
                (self.t100_df['PASSENGERS'] > 0)
            ]
            print(f"  ✓ T-100: {len(self.t100_df):,} traffic records")

        # Load DB1B market fare data
        db1b_path = self.data_dir / "db1b_market_parsed.csv"
        if db1b_path.exists():
            # Only load sample due to large size
            self.db1b_df = pd.read_csv(db1b_path, nrows=1_000_000)
            print(f"  ✓ DB1B: {len(self.db1b_df):,} fare records (sampled)")

        # Load NK routes
        nk_routes_path = self.data_dir / "nk_routes.csv"
        if nk_routes_path.exists():
            self.nk_routes_df = pd.read_csv(nk_routes_path)
            print(f"  ✓ NK Routes: {len(self.nk_routes_df)} routes")

        # Load F9 routes
        f9_routes_path = self.data_dir / "f9_routes.csv"
        if f9_routes_path.exists():
            self.f9_routes_df = pd.read_csv(f9_routes_path)
            print(f"  ✓ F9 Routes: {len(self.f9_routes_df)} routes")

        # Load overlap markets
        overlap_path = self.data_dir / "overlap_markets.csv"
        if overlap_path.exists():
            self.overlap_df = pd.read_csv(overlap_path)
            print(f"  ✓ Overlap Markets: {len(self.overlap_df)} markets")

        # Load scraped fares
        fares_path = self.data_dir / "scraped_fares.csv"
        if fares_path.exists():
            self.scraped_fares_df = pd.read_csv(fares_path)
            print(f"  ✓ Scraped Fares: {len(self.scraped_fares_df):,} records")

        self._loaded = True
        print("Network Intelligence data loading complete.")

    def get_network_from_t100(self, carrier: str = 'NK') -> pd.DataFrame:
        """
        Discover network from T-100 data for a specific carrier.
        Returns all routes operated by the carrier.
        """
        if self.t100_df is None:
            return pd.DataFrame()

        carrier_df = self.t100_df[self.t100_df['UNIQUE_CARRIER'] == carrier].copy()

        # Aggregate by route
        route_stats = carrier_df.groupby(['ORIGIN', 'DEST']).agg({
            'PASSENGERS': 'sum',
            'DISTANCE': 'first',
            'MONTH': 'nunique'  # Number of months served
        }).reset_index()

        route_stats.columns = ['origin', 'destination', 'passengers', 'distance', 'months_served']
        route_stats['market'] = route_stats.apply(
            lambda r: '_'.join(sorted([r['origin'], r['destination']])), axis=1
        )
        route_stats['route_key'] = route_stats['origin'] + '-' + route_stats['destination']

        return route_stats.sort_values('passengers', ascending=False)

    def get_market_competitive_position(self) -> Dict[str, MarketIntelligence]:
        """
        Build comprehensive competitive intelligence for all markets.
        """
        markets = {}

        if self.overlap_df is not None:
            for _, row in self.overlap_df.iterrows():
                market_key = row['market']
                origin = row['origin']
                dest = row['dest']  # Column is 'dest' not 'destination'

                mi = MarketIntelligence(
                    origin=origin,
                    destination=dest,
                    market_key=market_key,
                    nk_passengers=int(row.get('nk_passengers', 0)),
                    f9_passengers=int(row.get('f9_passengers', 0)),
                    nk_market_share=float(row.get('nk_share', 0)),
                    distance=float(row.get('distance', 0)),
                    is_overlap_market=True
                )

                total = mi.nk_passengers + mi.f9_passengers
                if total > 500000:
                    mi.competitive_intensity = 'intense'
                elif total > 200000:
                    mi.competitive_intensity = 'high'
                elif total > 100000:
                    mi.competitive_intensity = 'moderate'
                else:
                    mi.competitive_intensity = 'low'

                markets[market_key] = mi

        # Enrich with fare data
        if self.scraped_fares_df is not None:
            fare_stats = self.scraped_fares_df.groupby('market').agg({
                'nk_fare': 'mean',
                'f9_fare': 'mean',
                'market_lowest': 'mean',
                'price_level': lambda x: x.mode().iloc[0] if len(x) > 0 else 'typical'
            }).reset_index()

            for _, row in fare_stats.iterrows():
                market_key = row['market']
                if market_key in markets:
                    markets[market_key].nk_avg_fare = float(row['nk_fare']) if pd.notna(row['nk_fare']) else 0
                    markets[market_key].f9_avg_fare = float(row['f9_fare']) if pd.notna(row['f9_fare']) else 0
                    markets[market_key].avg_fare = float(row['market_lowest']) if pd.notna(row['market_lowest']) else 0
                    markets[market_key].price_level = row['price_level']

                    if markets[market_key].nk_avg_fare > 0 and markets[market_key].f9_avg_fare > 0:
                        markets[market_key].fare_advantage = (
                            markets[market_key].f9_avg_fare - markets[market_key].nk_avg_fare
                        ) / markets[market_key].f9_avg_fare * 100

        return markets

    def get_network_position(self) -> NetworkPosition:
        """
        Calculate NK's overall network position vs Frontier.
        """
        markets = self.get_market_competitive_position()

        position = NetworkPosition()
        position.overlap_markets = len([m for m in markets.values() if m.is_overlap_market])

        if self.nk_routes_df is not None:
            nk_markets = set(self.nk_routes_df['market'].unique())
            position.total_nk_passengers = int(self.nk_routes_df['passengers'].sum())
        else:
            nk_markets = set()

        if self.f9_routes_df is not None:
            f9_markets = set(self.f9_routes_df['market'].unique())
            position.total_f9_passengers = int(self.f9_routes_df['passengers'].sum())
        else:
            f9_markets = set()

        position.nk_only_markets = len(nk_markets - f9_markets)
        position.f9_only_markets = len(f9_markets - nk_markets)
        position.total_markets = len(nk_markets | f9_markets)

        # Calculate fare position
        position.fare_advantage_markets = len([m for m in markets.values() if m.fare_advantage > 5])
        position.fare_disadvantage_markets = len([m for m in markets.values() if m.fare_advantage < -5])

        if markets:
            position.avg_nk_market_share = np.mean([m.nk_market_share for m in markets.values()])

        return position

    def get_fare_analysis(self, market: Optional[str] = None) -> Dict[str, Any]:
        """
        Get detailed fare analysis for a market or all markets.
        """
        if self.scraped_fares_df is None:
            return {'error': 'No fare data available'}

        df = self.scraped_fares_df.copy()

        if market:
            df = df[df['market'] == market]
            if len(df) == 0:
                return {'error': f'No fare data for market {market}'}

        # Calculate comprehensive fare metrics
        result = {
            'total_observations': len(df),
            'markets_covered': df['market'].nunique(),
            'date_range': {
                'min': df['date'].min(),
                'max': df['date'].max()
            },
            'nk_metrics': {
                'avg_fare': float(df['nk_fare'].mean()) if 'nk_fare' in df else 0,
                'min_fare': float(df['nk_fare'].min()) if 'nk_fare' in df else 0,
                'max_fare': float(df['nk_fare'].max()) if 'nk_fare' in df else 0,
                'nonstop_pct': float((df['nk_stops'] == 0).mean() * 100) if 'nk_stops' in df else 0
            },
            'f9_metrics': {
                'avg_fare': float(df['f9_fare'].mean()) if 'f9_fare' in df else 0,
                'min_fare': float(df['f9_fare'].min()) if 'f9_fare' in df else 0,
                'max_fare': float(df['f9_fare'].max()) if 'f9_fare' in df else 0,
                'nonstop_pct': float((df['f9_stops'] == 0).mean() * 100) if 'f9_stops' in df else 0
            },
            'price_level_distribution': df['price_level'].value_counts().to_dict() if 'price_level' in df else {}
        }

        # Calculate win rate (NK cheaper than F9)
        comparable = df.dropna(subset=['nk_fare', 'f9_fare'])
        if len(comparable) > 0:
            nk_wins = (comparable['nk_fare'] < comparable['f9_fare']).sum()
            result['nk_win_rate'] = round(nk_wins / len(comparable) * 100, 1)
            result['avg_fare_difference'] = round(
                (comparable['f9_fare'] - comparable['nk_fare']).mean(), 2
            )

        return result

    def get_market_opportunities(self) -> List[Dict[str, Any]]:
        """
        Identify market opportunities for NK.
        """
        opportunities = []

        # Get current position
        markets = self.get_market_competitive_position()

        # Find underperforming markets (low share in high-traffic markets)
        for market_key, mi in markets.items():
            total_pax = mi.nk_passengers + mi.f9_passengers

            # High traffic but low NK share
            if total_pax > 200000 and mi.nk_market_share < 0.4:
                opp = {
                    'market': market_key,
                    'type': 'share_opportunity',
                    'current_share': round(mi.nk_market_share * 100, 1),
                    'total_market_size': total_pax,
                    'nk_passengers': mi.nk_passengers,
                    'f9_passengers': mi.f9_passengers,
                    'fare_position': 'advantage' if mi.fare_advantage > 5 else 'parity' if abs(mi.fare_advantage) <= 5 else 'disadvantage',
                    'priority': 'high' if total_pax > 400000 else 'medium',
                    'insight': f"NK has only {mi.nk_market_share*100:.0f}% share in {total_pax:,} pax market"
                }
                opportunities.append(opp)

            # Markets where NK has fare advantage but lower share
            if mi.fare_advantage > 10 and mi.nk_market_share < 0.5:
                opp = {
                    'market': market_key,
                    'type': 'pricing_opportunity',
                    'fare_advantage_pct': round(mi.fare_advantage, 1),
                    'current_share': round(mi.nk_market_share * 100, 1),
                    'priority': 'high',
                    'insight': f"NK is {mi.fare_advantage:.0f}% cheaper but only has {mi.nk_market_share*100:.0f}% share"
                }
                if opp not in opportunities:
                    opportunities.append(opp)

        # Sort by priority and market size
        return sorted(opportunities, key=lambda x: (
            0 if x['priority'] == 'high' else 1,
            -x.get('total_market_size', 0)
        ))

    def get_db1b_fare_curves(self, origin: str, destination: str) -> Dict[str, Any]:
        """
        Get fare distribution from DB1B data for booking curve analysis.
        """
        if self.db1b_df is None:
            return {'error': 'No DB1B data available'}

        # Filter to market
        market_df = self.db1b_df[
            ((self.db1b_df['ORIGIN'] == origin) & (self.db1b_df['DEST'] == destination)) |
            ((self.db1b_df['ORIGIN'] == destination) & (self.db1b_df['DEST'] == origin))
        ].copy()

        if len(market_df) == 0:
            return {'error': f'No DB1B data for {origin}-{destination}'}

        # Calculate fare percentiles
        fare_col = 'FARE'
        if fare_col in market_df:
            result = {
                'market': f'{origin}-{destination}',
                'sample_size': len(market_df),
                'fare_distribution': {
                    'min': float(market_df[fare_col].min()),
                    'p10': float(market_df[fare_col].quantile(0.1)),
                    'p25': float(market_df[fare_col].quantile(0.25)),
                    'median': float(market_df[fare_col].median()),
                    'p75': float(market_df[fare_col].quantile(0.75)),
                    'p90': float(market_df[fare_col].quantile(0.9)),
                    'max': float(market_df[fare_col].max()),
                    'mean': float(market_df[fare_col].mean()),
                    'std': float(market_df[fare_col].std())
                }
            }

            # Carrier breakdown if available
            if 'CARRIER' in market_df:
                carrier_fares = market_df.groupby('CARRIER').agg({
                    fare_col: ['mean', 'median', 'count']
                }).reset_index()
                carrier_fares.columns = ['carrier', 'avg_fare', 'median_fare', 'observations']
                result['by_carrier'] = carrier_fares.to_dict('records')

            return result

        return {'error': 'Fare column not found'}

    def get_route_ranking_intelligence(self, top_n: int = 50) -> List[Dict[str, Any]]:
        """
        Get intelligent route rankings with competitive context.
        """
        rankings = []
        markets = self.get_market_competitive_position()

        if self.nk_routes_df is not None:
            # Combine route data with competitive intelligence
            for _, row in self.nk_routes_df.head(top_n).iterrows():
                market_key = row['market']
                mi = markets.get(market_key)

                ranking = {
                    'rank': len(rankings) + 1,
                    'route': f"{row['origin']}-{row['dest']}",
                    'origin': row['origin'],
                    'destination': row['dest'],  # Column is 'dest' in CSV
                    'passengers': int(row['passengers']),
                    'distance': int(row.get('distance', 0)),
                    'months_served': int(row.get('months_served', 0))
                }

                if mi:
                    ranking['competitive_context'] = {
                        'f9_passengers': mi.f9_passengers,
                        'market_share': round(mi.nk_market_share * 100, 1),
                        'fare_advantage': round(mi.fare_advantage, 1) if mi.fare_advantage != 0 else None,
                        'competitive_intensity': mi.competitive_intensity
                    }

                    # Generate insight
                    if mi.nk_market_share > 0.7:
                        ranking['insight'] = 'NK dominates this market'
                    elif mi.nk_market_share < 0.3:
                        ranking['insight'] = 'Growth opportunity - F9 dominates'
                    elif mi.fare_advantage > 10:
                        ranking['insight'] = 'Price leader position'
                    elif mi.fare_advantage < -10:
                        ranking['insight'] = 'Price disadvantage vs F9'
                    else:
                        ranking['insight'] = 'Competitive equilibrium'

                rankings.append(ranking)

        return rankings


class CrossDomainIntelligence:
    """
    Cross-domain analysis connecting Fleet, Crew, MRO with Network.
    """

    def __init__(self, network_engine: NetworkIntelligenceEngine):
        self.network = network_engine
        self.fleet_df: Optional[pd.DataFrame] = None
        self.crew_df: Optional[pd.DataFrame] = None
        self.mro_df: Optional[pd.DataFrame] = None

    def set_operational_data(
        self,
        fleet_df: Optional[pd.DataFrame] = None,
        crew_df: Optional[pd.DataFrame] = None,
        mro_df: Optional[pd.DataFrame] = None
    ):
        """Set operational data for cross-domain analysis."""
        self.fleet_df = fleet_df
        self.crew_df = crew_df
        self.mro_df = mro_df

    def get_fleet_network_alignment(self) -> Dict[str, Any]:
        """
        Analyze how fleet is aligned with network needs.
        """
        if self.fleet_df is None:
            return {'error': 'No fleet data available'}

        result = {
            'fleet_summary': {},
            'base_analysis': {},
            'recommendations': []
        }

        # Fleet by base
        if 'home_base' in self.fleet_df.columns:
            base_counts = self.fleet_df['home_base'].value_counts()
            result['fleet_summary']['by_base'] = base_counts.to_dict()

            # Compare with network traffic
            if self.network.nk_routes_df is not None:
                # Get traffic by hub
                hub_traffic = self.network.nk_routes_df.groupby('origin')['passengers'].sum()

                for base in base_counts.index:
                    traffic = hub_traffic.get(base, 0)
                    aircraft = base_counts[base]
                    pax_per_aircraft = traffic / aircraft if aircraft > 0 else 0

                    result['base_analysis'][base] = {
                        'aircraft': int(aircraft),
                        'annual_passengers': int(traffic),
                        'pax_per_aircraft': round(pax_per_aircraft)
                    }

                    # Generate recommendations
                    if pax_per_aircraft > 2_000_000:
                        result['recommendations'].append({
                            'type': 'capacity_constraint',
                            'base': base,
                            'message': f'{base} may need additional aircraft - {pax_per_aircraft:,.0f} pax/aircraft'
                        })
                    elif pax_per_aircraft < 500_000 and aircraft > 5:
                        result['recommendations'].append({
                            'type': 'excess_capacity',
                            'base': base,
                            'message': f'{base} may have excess capacity - only {pax_per_aircraft:,.0f} pax/aircraft'
                        })

        return result

    def get_crew_network_alignment(self) -> Dict[str, Any]:
        """
        Analyze how crew is aligned with network needs.
        """
        if self.crew_df is None:
            return {'error': 'No crew data available'}

        result = {
            'crew_summary': {},
            'base_analysis': {},
            'training_alerts': []
        }

        # Crew by base and type
        if 'home_base' in self.crew_df.columns and 'crew_type' in self.crew_df.columns:
            base_type_counts = self.crew_df.groupby(['home_base', 'crew_type']).size().unstack(fill_value=0)
            result['crew_summary']['by_base_type'] = base_type_counts.to_dict()

            # Check pilot/FA ratio
            if 'PILOT' in base_type_counts.columns and 'FA' in base_type_counts.columns:
                for base in base_type_counts.index:
                    pilots = base_type_counts.loc[base, 'PILOT']
                    fas = base_type_counts.loc[base, 'FA']
                    ratio = fas / pilots if pilots > 0 else 0

                    result['base_analysis'][base] = {
                        'pilots': int(pilots),
                        'flight_attendants': int(fas),
                        'fa_pilot_ratio': round(ratio, 2)
                    }

                    # Typical ULCC ratio is ~2.5-3.0 FAs per pilot
                    if ratio < 2.0:
                        result['training_alerts'].append({
                            'base': base,
                            'issue': 'low_fa_ratio',
                            'message': f'{base}: Low FA/Pilot ratio ({ratio:.1f}), may need FA hiring'
                        })

        # Training due analysis
        if 'recurrent_training_due' in self.crew_df.columns:
            self.crew_df['training_due_date'] = pd.to_datetime(self.crew_df['recurrent_training_due'])
            now = pd.Timestamp.now()

            due_30 = len(self.crew_df[self.crew_df['training_due_date'] <= now + timedelta(days=30)])
            due_60 = len(self.crew_df[self.crew_df['training_due_date'] <= now + timedelta(days=60)])
            due_90 = len(self.crew_df[self.crew_df['training_due_date'] <= now + timedelta(days=90)])

            result['training_alerts'].append({
                'type': 'training_summary',
                'due_30_days': due_30,
                'due_60_days': due_60,
                'due_90_days': due_90
            })

        return result

    def get_mro_network_impact(self) -> Dict[str, Any]:
        """
        Analyze MRO impact on network operations.
        """
        if self.mro_df is None:
            return {'error': 'No MRO data available'}

        result = {
            'mro_summary': {},
            'upcoming_events': [],
            'network_impact': []
        }

        # MRO summary
        if 'maintenance_type' in self.mro_df.columns:
            result['mro_summary']['by_type'] = self.mro_df['maintenance_type'].value_counts().to_dict()

        if 'status' in self.mro_df.columns:
            result['mro_summary']['by_status'] = self.mro_df['status'].value_counts().to_dict()

        # Upcoming maintenance events
        if 'scheduled_start_date' in self.mro_df.columns:
            self.mro_df['start_date'] = pd.to_datetime(self.mro_df['scheduled_start_date'])
            now = pd.Timestamp.now()

            upcoming = self.mro_df[
                (self.mro_df['start_date'] >= now) &
                (self.mro_df['start_date'] <= now + timedelta(days=30))
            ].copy()

            if len(upcoming) > 0 and self.fleet_df is not None:
                # Link MRO to fleet base
                fleet_bases = self.fleet_df.set_index('aircraft_registration')['home_base'].to_dict()

                for _, row in upcoming.iterrows():
                    reg = row.get('aircraft_registration')
                    base = fleet_bases.get(reg, 'Unknown')
                    downtime = row.get('downtime_days', 0)

                    event = {
                        'aircraft': reg,
                        'base': base,
                        'maintenance_type': row.get('maintenance_type'),
                        'start_date': row['start_date'].strftime('%Y-%m-%d'),
                        'downtime_days': int(downtime)
                    }
                    result['upcoming_events'].append(event)

                    # Check network impact
                    if downtime > 5 and base != 'Unknown':
                        result['network_impact'].append({
                            'base': base,
                            'aircraft': reg,
                            'impact': f'{downtime} day aircraft outage at {base}',
                            'severity': 'high' if downtime > 14 else 'medium'
                        })

        return result

    def get_route_equipment_recommendations(self) -> List[Dict[str, Any]]:
        """
        Recommend optimal equipment for routes based on demand characteristics.
        """
        recommendations = []

        if self.fleet_df is None or self.network.nk_routes_df is None:
            return recommendations

        # Get fleet capabilities
        fleet_caps = {}
        if 'aircraft_type' in self.fleet_df.columns and 'seat_config' in self.fleet_df.columns:
            fleet_caps = self.fleet_df.groupby('aircraft_type')['seat_config'].first().to_dict()

        markets = self.network.get_market_competitive_position()

        # Analyze top routes
        for _, row in self.network.nk_routes_df.head(30).iterrows():
            market_key = row['market']
            mi = markets.get(market_key)

            if mi:
                # Determine equipment recommendation
                daily_pax = mi.nk_passengers / 365  # Rough estimate

                if daily_pax > 500:
                    recommended_type = 'A321neo'
                    reason = 'High-demand route benefits from largest gauge'
                elif daily_pax > 300:
                    recommended_type = 'A320neo'
                    reason = 'Medium-high demand optimal for A320'
                else:
                    recommended_type = 'A319'
                    reason = 'Lower demand route - right-size with smaller gauge'

                # Check if competitive pressure requires specific equipment
                if mi.competitive_intensity == 'intense' and mi.nk_market_share < 0.4:
                    recommended_type = 'A321neo'
                    reason = 'Intense competition - maximize capacity for share growth'

                recommendations.append({
                    'route': f"{row['origin']}-{row['dest']}",  # Column is 'dest' in CSV
                    'market_key': market_key,
                    'recommended_equipment': recommended_type,
                    'reason': reason,
                    'estimated_daily_pax': round(daily_pax),
                    'competitive_intensity': mi.competitive_intensity
                })

        return recommendations


class ActionableInsightEngine:
    """
    Generates actionable insights from cross-domain analysis.
    """

    def __init__(
        self,
        network_engine: NetworkIntelligenceEngine,
        cross_domain: CrossDomainIntelligence
    ):
        self.network = network_engine
        self.cross_domain = cross_domain

    def generate_executive_insights(self) -> List[Dict[str, Any]]:
        """
        Generate top executive-level insights.
        """
        insights = []

        # Network position insight
        position = self.network.get_network_position()
        insights.append({
            'category': 'Network Strategy',
            'headline': f'NK competes in {position.overlap_markets} overlap markets with F9',
            'detail': f'NK-only: {position.nk_only_markets} markets, F9-only: {position.f9_only_markets} markets',
            'metric': f'{position.avg_nk_market_share*100:.1f}% avg market share',
            'action': 'Review expansion strategy for F9-only markets',
            'priority': 'high' if position.f9_only_markets > 100 else 'medium'
        })

        # Pricing insight
        fare_analysis = self.network.get_fare_analysis()
        if 'nk_win_rate' in fare_analysis:
            insights.append({
                'category': 'Pricing',
                'headline': f'NK wins on price {fare_analysis["nk_win_rate"]:.0f}% of the time',
                'detail': f'Avg fare difference: ${fare_analysis.get("avg_fare_difference", 0):.0f}',
                'metric': f'{position.fare_advantage_markets} markets with >5% fare advantage',
                'action': 'Increase marketing in fare-advantaged markets',
                'priority': 'high' if fare_analysis["nk_win_rate"] > 60 else 'medium'
            })

        # Opportunities
        opportunities = self.network.get_market_opportunities()
        if opportunities:
            top_opp = opportunities[0]
            insights.append({
                'category': 'Growth Opportunity',
                'headline': f'Top opportunity: {top_opp["market"]}',
                'detail': top_opp.get('insight', ''),
                'metric': f'{top_opp.get("total_market_size", 0):,} annual passengers',
                'action': f'Evaluate capacity increase in {top_opp["market"]}',
                'priority': top_opp.get('priority', 'medium')
            })

        # Fleet alignment
        fleet_alignment = self.cross_domain.get_fleet_network_alignment()
        if fleet_alignment.get('recommendations'):
            rec = fleet_alignment['recommendations'][0]
            insights.append({
                'category': 'Fleet Operations',
                'headline': rec.get('message', 'Fleet alignment opportunity'),
                'detail': f'Base: {rec.get("base")}',
                'metric': rec.get('type'),
                'action': 'Review fleet deployment strategy',
                'priority': 'medium'
            })

        return insights

    def generate_route_insights(self, origin: str, destination: str) -> Dict[str, Any]:
        """
        Generate comprehensive insights for a specific route.
        """
        market_key = '_'.join(sorted([origin, destination]))
        markets = self.network.get_market_competitive_position()
        mi = markets.get(market_key)

        if not mi:
            return {'error': f'No data for market {market_key}'}

        insights = {
            'route': f'{origin}-{destination}',
            'market_key': market_key,
            'summary': {},
            'competitive_position': {},
            'recommendations': []
        }

        # Summary
        total_pax = mi.nk_passengers + mi.f9_passengers
        insights['summary'] = {
            'total_market_size': total_pax,
            'nk_passengers': mi.nk_passengers,
            'f9_passengers': mi.f9_passengers,
            'nk_share': round(mi.nk_market_share * 100, 1),
            'distance': mi.distance
        }

        # Competitive position
        insights['competitive_position'] = {
            'intensity': mi.competitive_intensity,
            'nk_avg_fare': mi.nk_avg_fare,
            'f9_avg_fare': mi.f9_avg_fare,
            'fare_advantage_pct': round(mi.fare_advantage, 1),
            'price_position': 'leader' if mi.fare_advantage > 5 else 'follower' if mi.fare_advantage < -5 else 'parity'
        }

        # Generate recommendations
        if mi.nk_market_share < 0.4 and mi.fare_advantage > 0:
            insights['recommendations'].append({
                'type': 'marketing',
                'priority': 'high',
                'message': 'Increase marketing - NK has price advantage but low share'
            })

        if mi.nk_market_share > 0.6:
            insights['recommendations'].append({
                'type': 'revenue_optimization',
                'priority': 'medium',
                'message': 'Strong market position - optimize for yield not share'
            })

        if mi.competitive_intensity == 'intense':
            insights['recommendations'].append({
                'type': 'competitive_response',
                'priority': 'high',
                'message': 'High competition - monitor F9 capacity changes closely'
            })

        return insights


# Booking curve analysis (simulated based on segment mix)
class BookingCurveAnalyzer:
    """
    Generates booking curves based on demand decomposition.
    """

    # Days before departure booking patterns by segment
    BOOKING_PATTERNS = {
        'vfr': {
            # VFR books early (45+ days) for family events
            90: 0.20, 60: 0.45, 45: 0.65, 30: 0.80, 14: 0.92, 7: 0.97, 0: 1.0
        },
        'leisure': {
            # Leisure varies - deal seekers book early, some last-minute
            90: 0.15, 60: 0.35, 45: 0.55, 30: 0.75, 14: 0.88, 7: 0.95, 0: 1.0
        },
        'cruise': {
            # Cruise books very early (cruise booking 90-180 days out)
            90: 0.40, 60: 0.65, 45: 0.80, 30: 0.90, 14: 0.96, 7: 0.99, 0: 1.0
        },
        'business': {
            # Business books late
            90: 0.05, 60: 0.15, 45: 0.30, 30: 0.50, 14: 0.75, 7: 0.90, 0: 1.0
        },
        'other': {
            90: 0.15, 60: 0.35, 45: 0.55, 30: 0.70, 14: 0.85, 7: 0.95, 0: 1.0
        }
    }

    def generate_booking_curve(self, segment_mix: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Generate composite booking curve based on segment mix.
        """
        days_points = [90, 60, 45, 30, 14, 7, 0]
        curve = []

        for days in days_points:
            composite_pct = 0
            for segment, share in segment_mix.items():
                pattern = self.BOOKING_PATTERNS.get(segment, self.BOOKING_PATTERNS['other'])
                composite_pct += share * pattern.get(days, 0.5)

            curve.append({
                'days_before_departure': days,
                'cumulative_booked_pct': round(composite_pct * 100, 1),
                'segment_breakdown': {
                    segment: round(share * self.BOOKING_PATTERNS.get(segment, self.BOOKING_PATTERNS['other']).get(days, 0.5) * 100, 1)
                    for segment, share in segment_mix.items()
                }
            })

        return curve

    def get_optimal_pricing_windows(self, segment_mix: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Recommend pricing windows based on segment booking patterns.
        """
        windows = []

        # Determine dominant segment
        dominant_segment = max(segment_mix.items(), key=lambda x: x[1])[0]

        if segment_mix.get('cruise', 0) > 0.15:
            windows.append({
                'window': '60-90 days out',
                'strategy': 'Capture cruise pax',
                'recommendation': 'Competitive pricing to attract cruise travelers booking early'
            })

        if segment_mix.get('business', 0) > 0.2:
            windows.append({
                'window': '0-14 days out',
                'strategy': 'Yield management',
                'recommendation': 'Premium pricing for business travelers with late booking'
            })

        if segment_mix.get('leisure', 0) > 0.3:
            windows.append({
                'window': '30-60 days out',
                'strategy': 'Promotional pricing',
                'recommendation': 'Flash sales to capture price-sensitive leisure travelers'
            })

        if segment_mix.get('vfr', 0) > 0.3:
            windows.append({
                'window': '45-90 days out',
                'strategy': 'Early bird',
                'recommendation': 'Competitive pricing to capture VFR early bookers'
            })

        return windows
