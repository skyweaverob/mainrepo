"""
SkyWeave Demand Decomposition Engine

Decomposes aggregate demand into behavioral segments:
- VFR (Visiting Friends/Relatives)
- Leisure
- Cruise
- Business
- Other

Each segment has distinct price sensitivity, date flexibility, and demand drivers.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from scipy import stats
from data_parser import categorize_airport, infer_route_segment_profile


@dataclass
class SegmentProfile:
    """Profile for a demand segment."""
    name: str
    price_sensitivity: str  # 'very_high', 'high', 'medium', 'low'
    date_flexibility: str  # 'zero', 'low', 'medium', 'high'
    booking_lead_time: str  # 'early', 'medium', 'late'
    primary_drivers: List[str]


# Segment definitions
SEGMENT_PROFILES = {
    'vfr': SegmentProfile(
        name='VFR',
        price_sensitivity='high',
        date_flexibility='low',
        booking_lead_time='early',
        primary_drivers=['family_events', 'cultural_holidays', 'school_calendars']
    ),
    'leisure': SegmentProfile(
        name='Leisure',
        price_sensitivity='very_high',
        date_flexibility='high',
        booking_lead_time='medium',
        primary_drivers=['weather_differential', 'vacation_timing', 'deals', 'search_trends']
    ),
    'cruise': SegmentProfile(
        name='Cruise',
        price_sensitivity='medium',
        date_flexibility='zero',
        booking_lead_time='early',
        primary_drivers=['cruise_departures', 'port_schedules']
    ),
    'business': SegmentProfile(
        name='Business',
        price_sensitivity='low',
        date_flexibility='low',
        booking_lead_time='late',
        primary_drivers=['conventions', 'corporate_travel', 'meetings']
    ),
    'other': SegmentProfile(
        name='Other',
        price_sensitivity='medium',
        date_flexibility='medium',
        booking_lead_time='medium',
        primary_drivers=[]
    )
}


# Day of week patterns by segment
DOW_PATTERNS = {
    # Index 1-7 (Mon-Sun) weights
    'vfr': {1: 0.08, 2: 0.08, 3: 0.10, 4: 0.12, 5: 0.22, 6: 0.18, 7: 0.22},  # Weekend heavy
    'leisure': {1: 0.12, 2: 0.14, 3: 0.14, 4: 0.14, 5: 0.16, 6: 0.16, 7: 0.14},  # More evenly distributed
    'cruise': {1: 0.05, 2: 0.05, 3: 0.05, 4: 0.10, 5: 0.25, 6: 0.40, 7: 0.10},  # Saturday spike (ships depart)
    'business': {1: 0.20, 2: 0.18, 3: 0.18, 4: 0.22, 5: 0.15, 6: 0.04, 7: 0.03},  # Weekday heavy
    'other': {1: 0.14, 2: 0.14, 3: 0.14, 4: 0.14, 5: 0.15, 6: 0.15, 7: 0.14},  # Flat
}


class DemandDecomposer:
    """
    Decomposes aggregate demand into behavioral segments.
    """

    def __init__(self, network_df: pd.DataFrame, column_mappings: Dict[str, str]):
        self.df = network_df.copy()
        self.mappings = column_mappings
        self._prepare_data()

    def _prepare_data(self):
        """Prepare data for analysis."""
        # Extract key columns
        self.origin_col = self.mappings.get('origin', 'Departure Airport')
        self.dest_col = self.mappings.get('destination', 'Arrival Airport')
        self.dow_col = self.mappings.get('dow', 'Departure Day')
        self.hub_col = self.mappings.get('hub', 'Hub (nested)')
        self.scenario_col = self.mappings.get('scenario', 'ScenarioLabel')

        # Pax columns
        self.const_local_pax = self.mappings.get('constrained_local_pax', 'Constrained Local Pax')
        self.unc_local_pax = self.mappings.get('unconstrained_local_pax', 'Unconstrained Local Pax')
        self.const_seg_pax = self.mappings.get('constrained_segment_pax', 'Constrained Segment Pax')
        self.unc_seg_pax = self.mappings.get('unconstrained_segment_pax', 'Unconstrained Segment Pax')

        # Revenue/fare columns
        self.const_fare = self.mappings.get('constrained_local_fare', 'Constrained Local Fare')
        self.unc_fare = self.mappings.get('unconstrained_local_fare', 'Unconstrained Local Fare')
        self.load_factor = self.mappings.get('load_factor', 'Load Factor')
        self.spill_rate = self.mappings.get('spill_rate', 'Spill Rate')
        self.seats_col = self.mappings.get('seats', 'Seats')

    def decompose_route(self, origin: str, destination: str) -> Dict[str, Any]:
        """
        Decompose demand for a specific route into segments.
        """
        # Filter to this route
        route_df = self.df[
            (self.df[self.origin_col] == origin) &
            (self.df[self.dest_col] == destination)
        ].copy()

        if len(route_df) == 0:
            return {'error': f'No data found for route {origin}-{destination}'}

        # Get base segment profile from geography
        base_profile = infer_route_segment_profile(origin, destination)

        # Refine with DOW patterns
        dow_refined = self._refine_by_dow_pattern(route_df, base_profile)

        # Refine with spill analysis
        spill_refined = self._refine_by_spill_pattern(route_df, dow_refined)

        # Refine with fare sensitivity
        final_profile = self._refine_by_fare_sensitivity(route_df, spill_refined)

        # Calculate segment-level metrics
        segment_metrics = self._calculate_segment_metrics(route_df, final_profile)

        return {
            'route': f"{origin}-{destination}",
            'origin': origin,
            'destination': destination,
            'origin_categories': categorize_airport(origin),
            'destination_categories': categorize_airport(destination),
            'segment_mix': final_profile,
            'segment_metrics': segment_metrics,
            'total_records': len(route_df),
            'dow_distribution': route_df.groupby(self.dow_col)[self.const_local_pax].sum().to_dict(),
            'avg_load_factor': route_df[self.load_factor].mean() if self.load_factor in route_df else None,
            'avg_spill_rate': route_df[self.spill_rate].mean() if self.spill_rate in route_df else None,
            'avg_fare': route_df[self.const_fare].mean() if self.const_fare in route_df else None,
        }

    def _refine_by_dow_pattern(self, route_df: pd.DataFrame, base_profile: Dict[str, float]) -> Dict[str, float]:
        """
        Refine segment mix based on day-of-week demand patterns.
        """
        if self.dow_col not in route_df.columns:
            return base_profile

        # Calculate actual DOW distribution
        dow_dist = route_df.groupby(self.dow_col)[self.const_local_pax].sum()
        dow_dist = dow_dist / dow_dist.sum()
        dow_dist = dow_dist.to_dict()

        # Calculate fit score for each segment pattern
        segment_fits = {}
        for segment, pattern in DOW_PATTERNS.items():
            # Calculate correlation between actual and expected pattern
            actual = [dow_dist.get(d, 0) for d in range(1, 8)]
            expected = [pattern.get(d, 0) for d in range(1, 8)]
            if sum(actual) > 0:
                corr, _ = stats.pearsonr(actual, expected)
                segment_fits[segment] = max(0, corr)
            else:
                segment_fits[segment] = 0

        # Adjust base profile based on fit scores
        adjusted = base_profile.copy()

        # If weekend-heavy, boost VFR
        weekend_ratio = sum(dow_dist.get(d, 0) for d in [5, 6, 7]) / max(sum(dow_dist.values()), 0.001)
        if weekend_ratio > 0.5:
            adjusted['vfr'] = min(1.0, adjusted['vfr'] * 1.2)
            adjusted['business'] = adjusted['business'] * 0.8

        # If Saturday spike, boost cruise (for cruise port destinations)
        sat_ratio = dow_dist.get(6, 0) / max(max(dow_dist.values()), 0.001)
        if sat_ratio > 0.2 and adjusted.get('cruise', 0) > 0:
            adjusted['cruise'] = min(0.4, adjusted['cruise'] * 1.5)

        # If weekday-heavy, boost business
        weekday_ratio = sum(dow_dist.get(d, 0) for d in [1, 2, 3, 4]) / max(sum(dow_dist.values()), 0.001)
        if weekday_ratio > 0.6:
            adjusted['business'] = min(0.5, adjusted['business'] * 1.3)
            adjusted['leisure'] = adjusted['leisure'] * 0.9

        # Normalize
        total = sum(adjusted.values())
        return {k: round(v/total, 4) for k, v in adjusted.items()}

    def _refine_by_spill_pattern(self, route_df: pd.DataFrame, profile: Dict[str, float]) -> Dict[str, float]:
        """
        Refine based on spill rate patterns.
        High spill + low price sensitivity = VFR/Cruise (must travel)
        High spill + high price sensitivity = Leisure (will shift/not travel)
        """
        if self.spill_rate not in route_df.columns:
            return profile

        avg_spill = route_df[self.spill_rate].mean()
        adjusted = profile.copy()

        if avg_spill > 0.1:  # High spill
            # Indicates constrained demand - boost must-travel segments
            adjusted['vfr'] = min(1.0, adjusted['vfr'] * 1.1)
            adjusted['cruise'] = min(0.5, adjusted['cruise'] * 1.15)
        elif avg_spill < 0.02:  # Very low spill
            # Could indicate soft demand or well-matched capacity
            adjusted['leisure'] = min(1.0, adjusted['leisure'] * 1.1)

        # Normalize
        total = sum(adjusted.values())
        return {k: round(v/total, 4) for k, v in adjusted.items()}

    def _refine_by_fare_sensitivity(self, route_df: pd.DataFrame, profile: Dict[str, float]) -> Dict[str, float]:
        """
        Refine based on fare premium patterns.
        """
        if self.const_fare not in route_df.columns or self.unc_fare not in route_df.columns:
            return profile

        # Calculate fare premium (constrained fare > unconstrained when demand exceeds capacity)
        avg_const_fare = route_df[self.const_fare].mean()
        avg_unc_fare = route_df[self.unc_fare].mean()

        fare_premium = (avg_const_fare - avg_unc_fare) / max(avg_unc_fare, 1)
        adjusted = profile.copy()

        if fare_premium > 0.05:  # Significant fare premium
            # Price-insensitive demand (business, cruise, VFR)
            adjusted['business'] = min(0.5, adjusted['business'] * 1.15)
            adjusted['vfr'] = min(0.6, adjusted['vfr'] * 1.1)
            adjusted['leisure'] = adjusted['leisure'] * 0.85
        elif fare_premium < -0.02:  # Fare discount needed
            # Price-sensitive demand (leisure)
            adjusted['leisure'] = min(0.7, adjusted['leisure'] * 1.2)
            adjusted['business'] = adjusted['business'] * 0.9

        # Normalize
        total = sum(adjusted.values())
        return {k: round(v/total, 4) for k, v in adjusted.items()}

    def _calculate_segment_metrics(self, route_df: pd.DataFrame, profile: Dict[str, float]) -> Dict[str, Dict]:
        """
        Calculate estimated metrics per segment.
        """
        total_const_pax = route_df[self.const_local_pax].sum() if self.const_local_pax in route_df else 0
        total_unc_pax = route_df[self.unc_local_pax].sum() if self.unc_local_pax in route_df else 0
        total_revenue = (route_df[self.const_local_pax] * route_df[self.const_fare]).sum() if self.const_fare in route_df else 0

        metrics = {}
        for segment, share in profile.items():
            seg_profile = SEGMENT_PROFILES.get(segment, SEGMENT_PROFILES['other'])
            metrics[segment] = {
                'share': share,
                'est_pax': round(total_const_pax * share),
                'est_unconstrained_pax': round(total_unc_pax * share),
                'est_revenue': round(total_revenue * share, 2),
                'price_sensitivity': seg_profile.price_sensitivity,
                'date_flexibility': seg_profile.date_flexibility,
                'primary_drivers': seg_profile.primary_drivers,
            }

        return metrics

    def decompose_all_routes(self) -> List[Dict[str, Any]]:
        """
        Decompose demand for all routes in the dataset.
        """
        results = []

        # Get unique routes
        routes = self.df.groupby([self.origin_col, self.dest_col]).size().reset_index()

        for _, row in routes.iterrows():
            origin = row[self.origin_col]
            dest = row[self.dest_col]
            decomposition = self.decompose_route(origin, dest)
            results.append(decomposition)

        return results

    def get_dow_segment_heatmap(self, origin: str, destination: str) -> Dict[str, Dict[int, float]]:
        """
        Get estimated segment contribution by day of week.
        """
        route_df = self.df[
            (self.df[self.origin_col] == origin) &
            (self.df[self.dest_col] == destination)
        ].copy()

        if len(route_df) == 0:
            return {}

        # Get route segment profile
        profile = self.decompose_route(origin, destination)['segment_mix']

        # Calculate DOW distribution
        dow_pax = route_df.groupby(self.dow_col)[self.const_local_pax].sum()

        # Allocate to segments based on profile and DOW patterns
        heatmap = {segment: {} for segment in profile.keys()}

        for dow in range(1, 8):
            dow_total = dow_pax.get(dow, 0)
            for segment, base_share in profile.items():
                # Adjust share by DOW pattern
                dow_pattern = DOW_PATTERNS.get(segment, DOW_PATTERNS['other'])
                dow_weight = dow_pattern.get(dow, 1/7)
                # Relative weight compared to uniform distribution
                adjusted_share = base_share * dow_weight * 7
                heatmap[segment][dow] = round(dow_total * adjusted_share / sum(profile.values()), 1)

        return heatmap


class NetworkAnalyzer:
    """
    Analyze network-level patterns and connections.
    """

    def __init__(self, network_df: pd.DataFrame, column_mappings: Dict[str, str]):
        self.df = network_df.copy()
        self.mappings = column_mappings
        self.decomposer = DemandDecomposer(network_df, column_mappings)
        self._prepare_data()

    def _prepare_data(self):
        """Prepare data for network analysis."""
        self.origin_col = self.mappings.get('origin', 'Departure Airport')
        self.dest_col = self.mappings.get('destination', 'Arrival Airport')
        self.hub_col = self.mappings.get('hub', 'Hub (nested)')
        self.const_local_pax = self.mappings.get('constrained_local_pax', 'Constrained Local Pax')
        self.const_seg_pax = self.mappings.get('constrained_segment_pax', 'Constrained Segment Pax')
        self.load_factor = self.mappings.get('load_factor', 'Load Factor')

    def get_hub_summary(self) -> Dict[str, Dict]:
        """
        Get summary metrics by hub.
        """
        if self.hub_col not in self.df.columns:
            return {}

        hub_summary = {}
        for hub in self.df[self.hub_col].unique():
            hub_df = self.df[self.df[self.hub_col] == hub]
            hub_summary[hub] = {
                'total_flights': len(hub_df),
                'unique_routes': len(hub_df.groupby([self.origin_col, self.dest_col])),
                'total_pax': hub_df[self.const_local_pax].sum() if self.const_local_pax in hub_df else 0,
                'avg_load_factor': hub_df[self.load_factor].mean() if self.load_factor in hub_df else None,
            }

        return hub_summary

    def get_route_rankings(self, metric: str = 'pax', limit: int = 20) -> List[Dict]:
        """
        Get top routes by specified metric.
        """
        if metric == 'pax':
            col = self.const_local_pax
        elif metric == 'load_factor':
            col = self.load_factor
        else:
            col = self.const_local_pax

        if col not in self.df.columns:
            return []

        route_metrics = self.df.groupby([self.origin_col, self.dest_col]).agg({
            col: 'sum' if metric == 'pax' else 'mean'
        }).reset_index()

        route_metrics = route_metrics.sort_values(col, ascending=False).head(limit)

        rankings = []
        for _, row in route_metrics.iterrows():
            origin = row[self.origin_col]
            dest = row[self.dest_col]
            rankings.append({
                'route': f"{origin}-{dest}",
                'origin': origin,
                'destination': dest,
                'value': round(row[col], 2),
                'metric': metric,
            })

        return rankings

    def get_directional_asymmetry(self) -> List[Dict]:
        """
        Find routes with significant directional asymmetry.
        """
        # Group by market pair (sorted) to compare both directions
        self.df['_market_pair'] = self.df.apply(
            lambda r: tuple(sorted([r[self.origin_col], r[self.dest_col]])),
            axis=1
        )

        asymmetries = []

        for market_pair in self.df['_market_pair'].unique():
            a, b = market_pair

            # Get metrics for both directions
            ab_df = self.df[(self.df[self.origin_col] == a) & (self.df[self.dest_col] == b)]
            ba_df = self.df[(self.df[self.origin_col] == b) & (self.df[self.dest_col] == a)]

            if len(ab_df) > 0 and len(ba_df) > 0:
                ab_pax = ab_df[self.const_local_pax].sum() if self.const_local_pax in ab_df else 0
                ba_pax = ba_df[self.const_local_pax].sum() if self.const_local_pax in ba_df else 0

                if ab_pax > 0 and ba_pax > 0:
                    ratio = max(ab_pax, ba_pax) / min(ab_pax, ba_pax)
                    if ratio > 1.2:  # 20% asymmetry threshold
                        asymmetries.append({
                            'market_pair': f"{a}/{b}",
                            f'{a}_to_{b}_pax': round(ab_pax),
                            f'{b}_to_{a}_pax': round(ba_pax),
                            'asymmetry_ratio': round(ratio, 2),
                            'stronger_direction': f"{a}-{b}" if ab_pax > ba_pax else f"{b}-{a}",
                        })

        return sorted(asymmetries, key=lambda x: x['asymmetry_ratio'], reverse=True)

    def get_network_stats(self) -> Dict[str, Any]:
        """
        Get overall network statistics.
        """
        unique_airports = set(self.df[self.origin_col].unique()) | set(self.df[self.dest_col].unique())

        return {
            'total_records': len(self.df),
            'unique_airports': len(unique_airports),
            'unique_routes': len(self.df.groupby([self.origin_col, self.dest_col])),
            'total_pax': self.df[self.const_local_pax].sum() if self.const_local_pax in self.df else 0,
            'avg_load_factor': self.df[self.load_factor].mean() if self.load_factor in self.df else None,
            'hub_distribution': self.df[self.hub_col].value_counts().to_dict() if self.hub_col in self.df else {},
        }
