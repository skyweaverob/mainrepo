"""
SkyWeave Segment Inference Engine

Advanced segment inference using external signals:
- Cruise ship departures
- School calendars
- Cultural holidays
- Weather differentials
- Search trends
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from dataclasses import dataclass


@dataclass
class ExternalSignal:
    """An external signal that drives segment demand."""
    name: str
    segment: str  # Which segment this signal drives
    signal_type: str  # 'event', 'calendar', 'weather', 'trend'
    strength: float  # 0-1 correlation strength


# Major cruise ports and their typical departure days
CRUISE_PORTS = {
    'MIA': {'port_name': 'PortMiami', 'primary_departure_day': 6, 'ships_per_week': 35},
    'FLL': {'port_name': 'Port Everglades', 'primary_departure_day': 6, 'ships_per_week': 25},
    'TPA': {'port_name': 'Port Tampa Bay', 'primary_departure_day': 6, 'ships_per_week': 10},
    'SJU': {'port_name': 'Port of San Juan', 'primary_departure_day': 7, 'ships_per_week': 8},
    'CZM': {'port_name': 'Cozumel', 'primary_departure_day': 0, 'ships_per_week': 20},  # Embarkation port
    'NAS': {'port_name': 'Nassau', 'primary_departure_day': 0, 'ships_per_week': 15},
    'GCM': {'port_name': 'Grand Cayman', 'primary_departure_day': 0, 'ships_per_week': 12},
}

# Major cruise lines and their typical booking patterns
CRUISE_LINES = {
    'Carnival': {'avg_booking_lead_days': 90, 'price_tier': 'value'},
    'Royal Caribbean': {'avg_booking_lead_days': 120, 'price_tier': 'premium'},
    'Norwegian': {'avg_booking_lead_days': 100, 'price_tier': 'value'},
    'MSC': {'avg_booking_lead_days': 80, 'price_tier': 'value'},
    'Celebrity': {'avg_booking_lead_days': 150, 'price_tier': 'premium'},
    'Princess': {'avg_booking_lead_days': 140, 'price_tier': 'premium'},
    'Disney': {'avg_booking_lead_days': 180, 'price_tier': 'luxury'},
}

# US School calendars (approximate)
SCHOOL_CALENDARS = {
    'winter_break': {'start_month': 12, 'start_day': 20, 'end_month': 1, 'end_day': 5},
    'spring_break_early': {'start_month': 3, 'start_day': 10, 'end_month': 3, 'end_day': 20},
    'spring_break_late': {'start_month': 3, 'start_day': 20, 'end_month': 4, 'end_day': 5},
    'summer_start': {'start_month': 6, 'start_day': 1, 'end_month': 6, 'end_day': 15},
    'summer_end': {'start_month': 8, 'start_day': 15, 'end_month': 8, 'end_day': 31},
    'thanksgiving': {'start_month': 11, 'start_day': 20, 'end_month': 11, 'end_day': 30},
}

# Cultural holidays affecting VFR travel
CULTURAL_HOLIDAYS = {
    'three_kings_day': {'date': (1, 6), 'regions': ['caribbean', 'latin_america'], 'segment': 'vfr'},
    'carnival': {'date': (2, 15), 'regions': ['caribbean', 'latin_america'], 'segment': 'vfr'},  # Approximate
    'dia_de_los_muertos': {'date': (11, 2), 'regions': ['latin_america'], 'segment': 'vfr'},
    'christmas_eve': {'date': (12, 24), 'regions': ['all'], 'segment': 'vfr'},
    'new_years_eve': {'date': (12, 31), 'regions': ['all'], 'segment': 'leisure'},
    'mlk_day': {'date': (1, 15), 'regions': ['us'], 'segment': 'leisure'},  # Approximate
    'memorial_day': {'date': (5, 27), 'regions': ['us'], 'segment': 'leisure'},  # Approximate
    'july_4th': {'date': (7, 4), 'regions': ['us'], 'segment': 'leisure'},
    'labor_day': {'date': (9, 2), 'regions': ['us'], 'segment': 'leisure'},  # Approximate
}

# Airport to region mapping
AIRPORT_REGIONS = {
    # Caribbean
    'SJU': 'caribbean', 'STT': 'caribbean', 'STX': 'caribbean', 'NAS': 'caribbean',
    'CZM': 'caribbean', 'SXM': 'caribbean', 'AUA': 'caribbean', 'CUR': 'caribbean',
    'POS': 'caribbean', 'BGI': 'caribbean', 'GCM': 'caribbean', 'PLS': 'caribbean',
    'MBJ': 'caribbean', 'KIN': 'caribbean',
    # Latin America
    'CUN': 'latin_america', 'PUJ': 'latin_america', 'SJO': 'latin_america',
    'LIR': 'latin_america', 'PVR': 'latin_america', 'SJD': 'latin_america',
    'GDL': 'latin_america', 'MEX': 'latin_america', 'BOG': 'latin_america',
    'MDE': 'latin_america', 'LIM': 'latin_america', 'SCL': 'latin_america',
    # US - all others default to 'us'
}


def get_airport_region(iata_code: str) -> str:
    """Get the cultural/geographic region for an airport."""
    return AIRPORT_REGIONS.get(iata_code.upper(), 'us')


class CruiseSignalEngine:
    """
    Generates cruise demand signals based on port schedules.
    """

    def __init__(self):
        self.ports = CRUISE_PORTS
        self.cruise_lines = CRUISE_LINES

    def get_cruise_signal(self, destination: str, day_of_week: int) -> Dict[str, Any]:
        """
        Get cruise signal strength for a destination and day.

        Args:
            destination: IATA code of destination airport
            day_of_week: 1-7 (Mon-Sun)

        Returns:
            Signal strength and explanation
        """
        dest = destination.upper()

        if dest not in self.ports:
            return {'signal_strength': 0, 'is_cruise_port': False}

        port_info = self.ports[dest]
        primary_day = port_info['primary_departure_day']

        # Calculate signal based on proximity to departure day
        # Passengers typically arrive 1-2 days before cruise departure
        days_before_departure = (primary_day - day_of_week) % 7

        if days_before_departure == 0:
            # Day of departure - some same-day arrivals
            signal = 0.3
        elif days_before_departure == 1:
            # Day before - peak arrival day
            signal = 1.0
        elif days_before_departure == 2:
            # Two days before - early arrivals
            signal = 0.6
        elif days_before_departure == 6:
            # Day after departure (for returning cruisers - less relevant for one-way)
            signal = 0.2
        else:
            signal = 0.05

        return {
            'signal_strength': signal,
            'is_cruise_port': True,
            'port_name': port_info['port_name'],
            'ships_per_week': port_info['ships_per_week'],
            'primary_departure_day': primary_day,
            'days_before_departure': days_before_departure,
            'explanation': self._get_cruise_explanation(signal, days_before_departure, port_info)
        }

    def _get_cruise_explanation(self, signal: float, days_before: int, port_info: dict) -> str:
        """Generate human-readable explanation for cruise signal."""
        if signal >= 0.8:
            return f"Peak cruise arrival day - {port_info['ships_per_week']} ships depart weekly from {port_info['port_name']}"
        elif signal >= 0.5:
            return f"Strong cruise traffic - passengers arriving early for {port_info['port_name']} sailings"
        elif signal >= 0.2:
            return f"Moderate cruise traffic - some same-day arrivals for {port_info['port_name']}"
        else:
            return "Low cruise influence on this day"


class SeasonalityEngine:
    """
    Generates seasonality signals based on school calendars and holidays.
    """

    def __init__(self):
        self.school_calendars = SCHOOL_CALENDARS
        self.cultural_holidays = CULTURAL_HOLIDAYS

    def get_seasonality_signal(self, date_obj: date, origin: str, destination: str) -> Dict[str, Any]:
        """
        Get seasonality signals for a given date and route.
        """
        signals = []

        # Check school calendars
        school_signal = self._check_school_calendar(date_obj)
        if school_signal:
            signals.append(school_signal)

        # Check cultural holidays
        dest_region = get_airport_region(destination)
        origin_region = get_airport_region(origin)
        holiday_signal = self._check_cultural_holidays(date_obj, dest_region, origin_region)
        if holiday_signal:
            signals.append(holiday_signal)

        # Combine signals
        if not signals:
            return {'signal_strength': 0, 'drivers': []}

        max_signal = max(s['strength'] for s in signals)
        return {
            'signal_strength': max_signal,
            'drivers': signals,
            'primary_driver': max(signals, key=lambda x: x['strength']),
        }

    def _check_school_calendar(self, date_obj: date) -> Optional[Dict]:
        """Check if date falls within a school break period."""
        month, day = date_obj.month, date_obj.day

        for period_name, period in self.school_calendars.items():
            # Simple date range check (doesn't handle year boundaries perfectly)
            start_month, start_day = period['start_month'], period['start_day']
            end_month, end_day = period['end_month'], period['end_day']

            in_period = False
            if start_month <= end_month:
                # Same year range
                if (month > start_month or (month == start_month and day >= start_day)) and \
                   (month < end_month or (month == end_month and day <= end_day)):
                    in_period = True
            else:
                # Year boundary (e.g., Dec-Jan)
                if (month > start_month or (month == start_month and day >= start_day)) or \
                   (month < end_month or (month == end_month and day <= end_day)):
                    in_period = True

            if in_period:
                return {
                    'type': 'school_calendar',
                    'name': period_name,
                    'strength': 0.7,
                    'segment': 'vfr',
                    'explanation': f"School break period: {period_name.replace('_', ' ').title()}"
                }

        return None

    def _check_cultural_holidays(self, date_obj: date, dest_region: str, origin_region: str) -> Optional[Dict]:
        """Check if date is near a cultural holiday relevant to the route."""
        month, day = date_obj.month, date_obj.day

        for holiday_name, holiday in self.cultural_holidays.items():
            h_month, h_day = holiday['date']
            regions = holiday['regions']

            # Check if holiday is relevant to this route's regions
            region_match = 'all' in regions or dest_region in regions or origin_region in regions

            if not region_match:
                continue

            # Check if date is within ±3 days of holiday
            days_diff = abs((month * 30 + day) - (h_month * 30 + h_day))
            if days_diff <= 3:
                return {
                    'type': 'cultural_holiday',
                    'name': holiday_name,
                    'strength': 0.8 if days_diff <= 1 else 0.5,
                    'segment': holiday['segment'],
                    'explanation': f"Near {holiday_name.replace('_', ' ').title()} - {holiday['segment'].upper()} traffic expected"
                }

        return None


class WeatherSignalEngine:
    """
    Generates weather-based demand signals.
    Leisure demand correlates with temperature differential (origin cold, destination warm).
    """

    # Average monthly temperatures (°F) for major airports
    AIRPORT_TEMPS = {
        # Florida
        'MIA': [68, 70, 73, 77, 81, 84, 85, 85, 84, 80, 75, 70],
        'FLL': [67, 69, 72, 76, 80, 83, 84, 84, 83, 79, 74, 69],
        'MCO': [62, 64, 68, 73, 78, 82, 83, 83, 82, 76, 69, 63],
        'TPA': [61, 63, 67, 72, 78, 82, 83, 83, 82, 76, 69, 63],
        # Caribbean
        'SJU': [76, 77, 78, 79, 81, 83, 84, 84, 84, 83, 80, 77],
        'CUN': [75, 77, 80, 83, 86, 87, 87, 87, 86, 83, 79, 76],
        # Northeast
        'JFK': [32, 35, 42, 53, 63, 72, 77, 76, 69, 58, 47, 37],
        'EWR': [32, 35, 43, 54, 64, 73, 78, 77, 70, 58, 47, 37],
        'BOS': [29, 32, 39, 49, 59, 68, 74, 73, 66, 55, 45, 34],
        'PHL': [33, 36, 44, 55, 65, 74, 79, 78, 71, 59, 48, 38],
        # Midwest
        'ORD': [24, 29, 39, 51, 62, 72, 76, 75, 67, 55, 42, 29],
        'DTW': [25, 28, 37, 50, 61, 71, 75, 73, 66, 53, 42, 30],
        'MSP': [14, 20, 32, 48, 60, 70, 75, 72, 63, 49, 33, 19],
        # West
        'LAX': [58, 59, 60, 62, 65, 68, 72, 73, 72, 68, 62, 58],
        'LAS': [47, 52, 59, 67, 77, 87, 93, 91, 83, 70, 56, 47],
        'DEN': [32, 35, 42, 50, 59, 69, 76, 74, 65, 52, 40, 32],
        'PHX': [55, 59, 65, 73, 82, 92, 95, 93, 88, 77, 63, 54],
    }

    def get_weather_signal(self, origin: str, destination: str, month: int) -> Dict[str, Any]:
        """
        Calculate weather-driven demand signal.
        Higher differential (cold origin → warm destination) = stronger leisure signal.
        """
        origin = origin.upper()
        dest = destination.upper()

        origin_temps = self.AIRPORT_TEMPS.get(origin)
        dest_temps = self.AIRPORT_TEMPS.get(dest)

        if not origin_temps or not dest_temps:
            return {'signal_strength': 0, 'has_data': False}

        month_idx = month - 1  # 0-indexed
        origin_temp = origin_temps[month_idx]
        dest_temp = dest_temps[month_idx]
        temp_diff = dest_temp - origin_temp

        # Calculate signal strength based on temperature differential
        if temp_diff > 30:
            signal = 1.0
            explanation = f"Strong weather driver: {temp_diff}°F warmer at destination (escape winter)"
        elif temp_diff > 20:
            signal = 0.7
            explanation = f"Moderate weather driver: {temp_diff}°F warmer at destination"
        elif temp_diff > 10:
            signal = 0.4
            explanation = f"Mild weather driver: {temp_diff}°F warmer at destination"
        elif temp_diff > 0:
            signal = 0.2
            explanation = f"Slight weather advantage: {temp_diff}°F warmer"
        else:
            signal = 0.0
            explanation = f"No weather advantage: destination is {abs(temp_diff)}°F cooler"

        return {
            'signal_strength': signal,
            'has_data': True,
            'origin_temp': origin_temp,
            'destination_temp': dest_temp,
            'temp_differential': temp_diff,
            'explanation': explanation,
            'segment': 'leisure',
        }


class TrendsSignalEngine:
    """
    Generates demand signals based on Google Trends search data.
    Uses SearchAPI to fetch real-time search interest.
    """

    def __init__(self, trends_client=None):
        """
        Initialize with optional SearchAPITrendsClient.
        If not provided, signals will be estimated based on destination characteristics.
        """
        self.trends_client = trends_client
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 3600  # 1 hour cache

    async def get_trends_signal(
        self,
        origin: str,
        destination: str
    ) -> Dict[str, Any]:
        """
        Get search trends-based demand signal for a route.
        """
        cache_key = f"{origin}_{destination}"

        if cache_key in self._cache:
            cached = self._cache[cache_key]
            if datetime.now().timestamp() - cached.get('timestamp', 0) < self._cache_ttl:
                return cached['data']

        if self.trends_client:
            try:
                result = await self.trends_client.get_route_demand_signal(origin, destination)
                if result.get('success'):
                    signal_data = {
                        'signal_strength': result['signal_strength'],
                        'has_data': True,
                        'demand_outlook': result['demand_outlook'],
                        'interest_ratio': result['interest_ratio'],
                        'segment': 'leisure',
                        'explanation': result['explanation'],
                        'source': 'google_trends',
                    }
                    self._cache[cache_key] = {
                        'timestamp': datetime.now().timestamp(),
                        'data': signal_data,
                    }
                    return signal_data
            except Exception:
                pass

        return self._get_synthetic_signal(origin, destination)

    def _get_synthetic_signal(self, origin: str, destination: str) -> Dict[str, Any]:
        """Generate synthetic signal when API unavailable."""
        high_interest = {'MIA', 'FLL', 'MCO', 'LAS', 'CUN', 'SJU', 'PUJ', 'MBJ'}
        moderate_interest = {'TPA', 'SAN', 'PHX', 'DEN', 'AUA', 'SXM', 'NAS'}
        dest = destination.upper()

        if dest in high_interest:
            signal_strength, demand_outlook = 0.7, 'strong'
            explanation = f"{dest} is a high-demand leisure destination"
        elif dest in moderate_interest:
            signal_strength, demand_outlook = 0.5, 'moderate'
            explanation = f"{dest} shows moderate leisure demand"
        else:
            signal_strength, demand_outlook = 0.3, 'normal'
            explanation = f"Standard demand patterns for {dest}"

        return {
            'signal_strength': signal_strength,
            'has_data': False,
            'demand_outlook': demand_outlook,
            'interest_ratio': 1.0,
            'segment': 'leisure',
            'explanation': explanation + " (estimated)",
            'source': 'synthetic',
        }

    def get_trends_signal_sync(self, origin: str, destination: str) -> Dict[str, Any]:
        """Synchronous version returning synthetic data."""
        return self._get_synthetic_signal(origin, destination)


class SegmentSignalAggregator:
    """
    Aggregates all external signals to refine segment estimates.
    """

    def __init__(self, trends_client=None):
        self.cruise_engine = CruiseSignalEngine()
        self.seasonality_engine = SeasonalityEngine()
        self.weather_engine = WeatherSignalEngine()
        self.trends_engine = TrendsSignalEngine(trends_client)

    def get_all_signals(
        self,
        origin: str,
        destination: str,
        day_of_week: int,
        month: int,
        date_obj: Optional[date] = None,
        include_trends: bool = False
    ) -> Dict[str, Any]:
        """
        Get all external signals for a route/date combination.
        """
        signals = {}

        # Cruise signal
        cruise = self.cruise_engine.get_cruise_signal(destination, day_of_week)
        if cruise['signal_strength'] > 0:
            signals['cruise'] = cruise

        # Weather signal
        weather = self.weather_engine.get_weather_signal(origin, destination, month)
        if weather['signal_strength'] > 0:
            signals['weather'] = weather

        # Seasonality signal (if we have a specific date)
        if date_obj:
            seasonality = self.seasonality_engine.get_seasonality_signal(date_obj, origin, destination)
            if seasonality['signal_strength'] > 0:
                signals['seasonality'] = seasonality

        # Search trends signal (synchronous, use async version for live data)
        if include_trends:
            trends = self.trends_engine.get_trends_signal_sync(origin, destination)
            if trends['signal_strength'] > 0:
                signals['trends'] = trends

        return {
            'route': f"{origin}-{destination}",
            'signals': signals,
            'signal_count': len(signals),
            'primary_signal': max(signals.values(), key=lambda x: x['signal_strength']) if signals else None,
        }

    async def get_all_signals_async(
        self,
        origin: str,
        destination: str,
        day_of_week: int,
        month: int,
        date_obj: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Async version that fetches live trends data.
        """
        signals = {}

        # Cruise signal
        cruise = self.cruise_engine.get_cruise_signal(destination, day_of_week)
        if cruise['signal_strength'] > 0:
            signals['cruise'] = cruise

        # Weather signal
        weather = self.weather_engine.get_weather_signal(origin, destination, month)
        if weather['signal_strength'] > 0:
            signals['weather'] = weather

        # Seasonality signal
        if date_obj:
            seasonality = self.seasonality_engine.get_seasonality_signal(date_obj, origin, destination)
            if seasonality['signal_strength'] > 0:
                signals['seasonality'] = seasonality

        # Live trends signal
        trends = await self.trends_engine.get_trends_signal(origin, destination)
        if trends['signal_strength'] > 0:
            signals['trends'] = trends

        return {
            'route': f"{origin}-{destination}",
            'signals': signals,
            'signal_count': len(signals),
            'primary_signal': max(signals.values(), key=lambda x: x['signal_strength']) if signals else None,
        }

    def adjust_segment_mix(
        self,
        base_mix: Dict[str, float],
        signals: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Adjust segment mix based on external signals.
        """
        adjusted = base_mix.copy()

        for signal_type, signal_data in signals.get('signals', {}).items():
            strength = signal_data.get('signal_strength', 0)

            if signal_type == 'cruise' and strength > 0.3:
                # Boost cruise segment
                boost = strength * 0.15
                adjusted['cruise'] = min(0.5, adjusted.get('cruise', 0) + boost)
                adjusted['leisure'] = max(0, adjusted.get('leisure', 0) - boost * 0.5)
                adjusted['other'] = max(0, adjusted.get('other', 0) - boost * 0.5)

            elif signal_type == 'weather' and strength > 0.3:
                # Boost leisure segment
                boost = strength * 0.1
                adjusted['leisure'] = min(0.6, adjusted.get('leisure', 0) + boost)
                adjusted['business'] = max(0, adjusted.get('business', 0) - boost * 0.5)
                adjusted['other'] = max(0, adjusted.get('other', 0) - boost * 0.5)

            elif signal_type == 'seasonality':
                segment = signal_data.get('segment', 'vfr')
                boost = strength * 0.1
                adjusted[segment] = min(0.6, adjusted.get(segment, 0) + boost)
                # Reduce other segments proportionally
                for other_seg in adjusted:
                    if other_seg != segment:
                        adjusted[other_seg] = max(0, adjusted[other_seg] - boost / 4)

            elif signal_type == 'trends' and strength > 0.3:
                # Search trends primarily drive leisure segment
                boost = strength * 0.12
                adjusted['leisure'] = min(0.6, adjusted.get('leisure', 0) + boost)
                adjusted['business'] = max(0, adjusted.get('business', 0) - boost * 0.3)
                adjusted['other'] = max(0, adjusted.get('other', 0) - boost * 0.3)

        # Normalize
        total = sum(adjusted.values())
        if total > 0:
            return {k: round(v/total, 4) for k, v in adjusted.items()}
        return adjusted
