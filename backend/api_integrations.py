"""
SkyWeave External API Integrations

Connects to external data sources:
- AirLabs: Flight schedules, routes, airlines
- SerpAPI: Google Flights competitive fares
- OpenWeatherMap: Weather data
- Google Trends (pytrends): Search interest
"""

import os
import httpx
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from dataclasses import dataclass
import asyncio
from functools import lru_cache
import json


@dataclass
class APIConfig:
    """API configuration from environment variables."""
    airlabs_key: str = ""
    serp_api_key: str = ""
    openweathermap_key: str = ""
    searchapi_key: str = ""  # For Google Trends via SearchAPI

    @classmethod
    def from_env(cls) -> 'APIConfig':
        return cls(
            airlabs_key=os.getenv('AIRLABS_API_KEY', ''),
            serp_api_key=os.getenv('SERP_API_KEY', ''),
            openweathermap_key=os.getenv('OPENWEATHERMAP_API_KEY', ''),
            searchapi_key=os.getenv('SEARCHAPI_KEY', ''),
        )


class AirLabsClient:
    """
    Client for AirLabs API.
    Free tier: 1000 requests/month
    """

    BASE_URL = "https://airlabs.co/api/v9"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def get_schedules(
        self,
        dep_iata: str,
        arr_iata: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get flight schedules for a route.

        Args:
            dep_iata: Departure airport IATA code
            arr_iata: Arrival airport IATA code (optional)
        """
        if not self.api_key:
            return {'error': 'AirLabs API key not configured', 'data': []}

        params = {
            'api_key': self.api_key,
            'dep_iata': dep_iata.upper(),
        }
        if arr_iata:
            params['arr_iata'] = arr_iata.upper()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/schedules",
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return {
                    'success': True,
                    'data': data.get('response', []),
                    'request': data.get('request', {}),
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': []}

    async def get_routes(self, dep_iata: str) -> Dict[str, Any]:
        """
        Get all routes from an airport.
        """
        if not self.api_key:
            return {'error': 'AirLabs API key not configured', 'data': []}

        params = {
            'api_key': self.api_key,
            'dep_iata': dep_iata.upper(),
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/routes",
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return {
                    'success': True,
                    'data': data.get('response', []),
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': []}

    async def get_airline_info(self, iata_code: str) -> Dict[str, Any]:
        """
        Get airline information.
        """
        if not self.api_key:
            return {'error': 'AirLabs API key not configured', 'data': None}

        params = {
            'api_key': self.api_key,
            'iata_code': iata_code.upper(),
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/airlines",
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                airlines = data.get('response', [])
                return {
                    'success': True,
                    'data': airlines[0] if airlines else None,
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': None}

    async def get_airport_info(self, iata_code: str) -> Dict[str, Any]:
        """
        Get airport information.
        """
        if not self.api_key:
            return {'error': 'AirLabs API key not configured', 'data': None}

        params = {
            'api_key': self.api_key,
            'iata_code': iata_code.upper(),
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/airports",
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                airports = data.get('response', [])
                return {
                    'success': True,
                    'data': airports[0] if airports else None,
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': None}


class SerpAPIClient:
    """
    Client for SerpAPI Google Flights.
    $50/month for standard plan.
    """

    BASE_URL = "https://serpapi.com/search"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def get_flight_prices(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: Optional[str] = None,
        adults: int = 1
    ) -> Dict[str, Any]:
        """
        Get flight prices from Google Flights via SerpAPI.

        Args:
            origin: Origin airport IATA code
            destination: Destination airport IATA code
            departure_date: Departure date (YYYY-MM-DD)
            return_date: Return date (optional, for round trip)
            adults: Number of adult passengers
        """
        if not self.api_key:
            return {'error': 'SerpAPI key not configured', 'data': []}

        params = {
            'api_key': self.api_key,
            'engine': 'google_flights',
            'departure_id': origin.upper(),
            'arrival_id': destination.upper(),
            'outbound_date': departure_date,
            'currency': 'USD',
            'hl': 'en',
            'adults': adults,
        }

        if return_date:
            params['return_date'] = return_date
            params['type'] = '1'  # Round trip
        else:
            params['type'] = '2'  # One way

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    self.BASE_URL,
                    params=params,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()

                # Parse the flight results
                best_flights = data.get('best_flights', [])
                other_flights = data.get('other_flights', [])

                parsed_results = []
                for flight in best_flights + other_flights:
                    parsed_results.append({
                        'price': flight.get('price'),
                        'airline': flight.get('flights', [{}])[0].get('airline'),
                        'departure_time': flight.get('flights', [{}])[0].get('departure_airport', {}).get('time'),
                        'arrival_time': flight.get('flights', [{}])[-1].get('arrival_airport', {}).get('time'),
                        'duration': flight.get('total_duration'),
                        'stops': len(flight.get('flights', [])) - 1,
                        'is_best': flight in best_flights,
                    })

                return {
                    'success': True,
                    'data': parsed_results,
                    'search_metadata': data.get('search_metadata', {}),
                    'price_insights': data.get('price_insights', {}),
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': []}

    async def get_competitive_fares(
        self,
        origin: str,
        destination: str,
        departure_date: str
    ) -> Dict[str, Any]:
        """
        Get competitive fare comparison for a route.
        """
        result = await self.get_flight_prices(origin, destination, departure_date)

        if not result.get('success'):
            return result

        flights = result.get('data', [])
        if not flights:
            return {'error': 'No flights found', 'data': {}}

        # Group by airline
        airline_fares = {}
        for flight in flights:
            airline = flight.get('airline', 'Unknown')
            price = flight.get('price')
            if price and airline:
                if airline not in airline_fares:
                    airline_fares[airline] = []
                airline_fares[airline].append(price)

        # Calculate min fare per airline
        competitive_analysis = {
            airline: {
                'min_fare': min(fares),
                'max_fare': max(fares),
                'avg_fare': sum(fares) / len(fares),
                'flight_count': len(fares),
            }
            for airline, fares in airline_fares.items()
        }

        # Find lowest fare overall
        all_prices = [f['price'] for f in flights if f.get('price')]
        min_overall = min(all_prices) if all_prices else None

        return {
            'success': True,
            'route': f"{origin}-{destination}",
            'date': departure_date,
            'min_fare': min_overall,
            'airline_analysis': competitive_analysis,
            'total_options': len(flights),
        }


class OpenWeatherClient:
    """
    Client for OpenWeatherMap API.
    Free tier: 1000 calls/day
    """

    BASE_URL = "https://api.openweathermap.org/data/2.5"

    # Airport coordinates for weather lookups
    AIRPORT_COORDS = {
        'MIA': (25.7959, -80.2870),
        'FLL': (26.0742, -80.1506),
        'MCO': (28.4294, -81.3089),
        'TPA': (27.9756, -82.5333),
        'JFK': (40.6413, -73.7781),
        'EWR': (40.6895, -74.1745),
        'LGA': (40.7769, -73.8740),
        'BOS': (42.3656, -71.0096),
        'ORD': (41.9742, -87.9073),
        'LAX': (33.9425, -118.4081),
        'SFO': (37.6213, -122.3790),
        'DFW': (32.8998, -97.0403),
        'ATL': (33.6407, -84.4277),
        'DEN': (39.8561, -104.6737),
        'LAS': (36.0840, -115.1537),
        'PHX': (33.4373, -112.0078),
        'SEA': (47.4502, -122.3088),
        'DTW': (42.2162, -83.3554),
        'MSP': (44.8848, -93.2223),
        'SJU': (18.4373, -66.0041),
        'CUN': (21.0365, -86.8771),
    }

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def get_current_weather(self, airport_code: str) -> Dict[str, Any]:
        """
        Get current weather for an airport.
        """
        if not self.api_key:
            return {'error': 'OpenWeatherMap API key not configured', 'data': None}

        coords = self.AIRPORT_COORDS.get(airport_code.upper())
        if not coords:
            return {'error': f'Coordinates not found for {airport_code}', 'data': None}

        lat, lon = coords
        params = {
            'lat': lat,
            'lon': lon,
            'appid': self.api_key,
            'units': 'imperial',  # Fahrenheit
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/weather",
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()

                return {
                    'success': True,
                    'airport': airport_code.upper(),
                    'data': {
                        'temp': data.get('main', {}).get('temp'),
                        'feels_like': data.get('main', {}).get('feels_like'),
                        'humidity': data.get('main', {}).get('humidity'),
                        'description': data.get('weather', [{}])[0].get('description'),
                        'wind_speed': data.get('wind', {}).get('speed'),
                    }
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': None}

    async def get_weather_differential(
        self,
        origin: str,
        destination: str
    ) -> Dict[str, Any]:
        """
        Get temperature differential between two airports.
        """
        origin_weather = await self.get_current_weather(origin)
        dest_weather = await self.get_current_weather(destination)

        if not origin_weather.get('success') or not dest_weather.get('success'):
            return {
                'error': 'Could not fetch weather for both airports',
                'origin_error': origin_weather.get('error'),
                'dest_error': dest_weather.get('error'),
            }

        origin_temp = origin_weather['data']['temp']
        dest_temp = dest_weather['data']['temp']
        differential = dest_temp - origin_temp

        return {
            'success': True,
            'origin': {
                'airport': origin.upper(),
                'temp': origin_temp,
                'description': origin_weather['data']['description'],
            },
            'destination': {
                'airport': destination.upper(),
                'temp': dest_temp,
                'description': dest_weather['data']['description'],
            },
            'differential': differential,
            'leisure_signal': 'strong' if differential > 30 else 'moderate' if differential > 15 else 'weak' if differential > 0 else 'none',
        }


class SearchAPITrendsClient:
    """
    Client for Google Trends via SearchAPI.
    https://www.searchapi.io/api/v1/search?engine=google_trends

    Free tier: 100 searches/month
    Paid: $50/mo for 5000 searches
    """

    BASE_URL = "https://www.searchapi.io/api/v1/search"

    # Destination search query templates
    DESTINATION_QUERIES = {
        'flights': "flights to {destination}",
        'vacation': "{destination} vacation",
        'hotels': "{destination} hotels",
        'travel': "travel to {destination}",
    }

    # Airport to city/destination name mapping
    AIRPORT_TO_DESTINATION = {
        'MIA': 'Miami',
        'FLL': 'Fort Lauderdale',
        'MCO': 'Orlando',
        'TPA': 'Tampa',
        'JFK': 'New York',
        'EWR': 'Newark',
        'LGA': 'New York',
        'BOS': 'Boston',
        'ORD': 'Chicago',
        'LAX': 'Los Angeles',
        'SFO': 'San Francisco',
        'DFW': 'Dallas',
        'ATL': 'Atlanta',
        'DEN': 'Denver',
        'LAS': 'Las Vegas',
        'PHX': 'Phoenix',
        'SEA': 'Seattle',
        'DTW': 'Detroit',
        'MSP': 'Minneapolis',
        'SJU': 'Puerto Rico',
        'CUN': 'Cancun',
        'PUJ': 'Punta Cana',
        'NAS': 'Bahamas',
        'SXM': 'St Maarten',
        'MBJ': 'Jamaica',
        'AUA': 'Aruba',
        'SJO': 'Costa Rica',
        'PVR': 'Puerto Vallarta',
        'SJD': 'Cabo San Lucas',
        'CZM': 'Cozumel',
    }

    def __init__(self, api_key: str):
        self.api_key = api_key

    def _get_destination_name(self, airport_code: str) -> str:
        """Convert airport IATA code to destination name for search."""
        return self.AIRPORT_TO_DESTINATION.get(airport_code.upper(), airport_code)

    async def get_interest_over_time(
        self,
        query: str,
        geo: str = "US",
        data_type: str = "TIMESERIES",
        time_range: str = "today 3-m"  # Last 3 months
    ) -> Dict[str, Any]:
        """
        Get Google Trends interest over time for a search query.

        Args:
            query: Search query (e.g., "flights to Miami")
            geo: Geographic region (default: US)
            data_type: TIMESERIES or GEO_MAP
            time_range: Time period (e.g., "today 3-m", "today 12-m", "2024-01-01 2024-12-31")

        Returns:
            Interest data with timeline and values
        """
        if not self.api_key:
            return {'error': 'SearchAPI key not configured', 'data': None}

        params = {
            'api_key': self.api_key,
            'engine': 'google_trends',
            'q': query,
            'geo': geo,
            'data_type': data_type,
            'date': time_range,
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    self.BASE_URL,
                    params=params,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()

                # Parse the timeline data
                interest_data = data.get('interest_over_time', {})
                timeline = interest_data.get('timeline_data', [])

                parsed_timeline = []
                for point in timeline:
                    parsed_timeline.append({
                        'date': point.get('date'),
                        'timestamp': point.get('timestamp'),
                        'values': point.get('values', [{}])[0].get('value', 0) if point.get('values') else 0,
                    })

                # Calculate trend metrics
                values = [p['values'] for p in parsed_timeline if isinstance(p['values'], (int, float))]

                return {
                    'success': True,
                    'query': query,
                    'geo': geo,
                    'time_range': time_range,
                    'data': {
                        'timeline': parsed_timeline,
                        'avg_interest': sum(values) / len(values) if values else 0,
                        'max_interest': max(values) if values else 0,
                        'min_interest': min(values) if values else 0,
                        'current_interest': values[-1] if values else 0,
                        'trend_direction': self._calculate_trend_direction(values),
                        'data_points': len(values),
                    },
                    'raw_response': data,
                }
            except httpx.HTTPError as e:
                return {'error': str(e), 'data': None}

    def _calculate_trend_direction(self, values: List[float]) -> str:
        """Calculate if trend is rising, falling, or stable."""
        if len(values) < 4:
            return 'insufficient_data'

        # Compare last quarter to first quarter
        quarter_len = len(values) // 4
        first_quarter_avg = sum(values[:quarter_len]) / quarter_len
        last_quarter_avg = sum(values[-quarter_len:]) / quarter_len

        change_pct = ((last_quarter_avg - first_quarter_avg) / first_quarter_avg * 100) if first_quarter_avg > 0 else 0

        if change_pct > 15:
            return 'rising_strong'
        elif change_pct > 5:
            return 'rising'
        elif change_pct < -15:
            return 'falling_strong'
        elif change_pct < -5:
            return 'falling'
        else:
            return 'stable'

    async def get_destination_interest(
        self,
        destination_code: str,
        origin_geo: str = "US",
        query_type: str = "flights"
    ) -> Dict[str, Any]:
        """
        Get search interest for a destination.

        Args:
            destination_code: Destination airport IATA code
            origin_geo: Origin market (default: US)
            query_type: Type of query (flights, vacation, hotels, travel)

        Returns:
            Destination interest analysis
        """
        destination_name = self._get_destination_name(destination_code)
        query_template = self.DESTINATION_QUERIES.get(query_type, self.DESTINATION_QUERIES['flights'])
        query = query_template.format(destination=destination_name)

        result = await self.get_interest_over_time(query, geo=origin_geo)

        if not result.get('success'):
            return result

        # Add segment inference based on search patterns
        data = result['data']
        segment_inference = self._infer_segment_from_interest(data, query_type)

        return {
            'success': True,
            'destination': destination_code,
            'destination_name': destination_name,
            'query_type': query_type,
            'query': query,
            'interest_metrics': {
                'current': data['current_interest'],
                'average': data['avg_interest'],
                'peak': data['max_interest'],
                'trend': data['trend_direction'],
            },
            'segment_inference': segment_inference,
            'timeline': data['timeline'],
        }

    def _infer_segment_from_interest(self, data: Dict, query_type: str) -> Dict[str, Any]:
        """Infer demand segment characteristics from search patterns."""
        current = data['current_interest']
        avg = data['avg_interest']
        trend = data['trend_direction']

        # High interest relative to average suggests strong demand
        interest_ratio = current / avg if avg > 0 else 1.0

        signal_strength = 0.0
        segment_hint = 'leisure'  # Default

        if interest_ratio > 1.3:
            signal_strength = 0.8
            explanation = f"Search interest {((interest_ratio - 1) * 100):.0f}% above average - strong demand signal"
        elif interest_ratio > 1.1:
            signal_strength = 0.5
            explanation = f"Search interest {((interest_ratio - 1) * 100):.0f}% above average - moderate demand"
        elif interest_ratio > 0.9:
            signal_strength = 0.3
            explanation = "Search interest near average - normal demand"
        else:
            signal_strength = 0.1
            explanation = f"Search interest {((1 - interest_ratio) * 100):.0f}% below average - weak demand"

        # Adjust based on trend
        if trend == 'rising_strong':
            signal_strength = min(1.0, signal_strength + 0.2)
            explanation += " (trending up strongly)"
        elif trend == 'falling_strong':
            signal_strength = max(0.0, signal_strength - 0.2)
            explanation += " (trending down)"

        return {
            'signal_strength': signal_strength,
            'segment_hint': segment_hint,
            'interest_ratio': interest_ratio,
            'explanation': explanation,
        }

    async def compare_destinations(
        self,
        destinations: List[str],
        query_type: str = "flights"
    ) -> Dict[str, Any]:
        """
        Compare search interest across multiple destinations.

        Args:
            destinations: List of destination airport codes
            query_type: Type of query

        Returns:
            Comparative interest analysis
        """
        tasks = [
            self.get_destination_interest(dest, query_type=query_type)
            for dest in destinations
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        comparison = {
            'destinations': [],
            'query_type': query_type,
            'timestamp': datetime.now().isoformat(),
        }

        for i, result in enumerate(results):
            dest = destinations[i]
            if isinstance(result, Exception):
                comparison['destinations'].append({
                    'code': dest,
                    'error': str(result),
                })
            elif result.get('success'):
                comparison['destinations'].append({
                    'code': dest,
                    'name': result['destination_name'],
                    'current_interest': result['interest_metrics']['current'],
                    'average_interest': result['interest_metrics']['average'],
                    'trend': result['interest_metrics']['trend'],
                    'signal_strength': result['segment_inference']['signal_strength'],
                })
            else:
                comparison['destinations'].append({
                    'code': dest,
                    'error': result.get('error', 'Unknown error'),
                })

        # Rank destinations by interest
        valid_dests = [d for d in comparison['destinations'] if 'current_interest' in d]
        if valid_dests:
            valid_dests.sort(key=lambda x: x['current_interest'], reverse=True)
            for i, d in enumerate(valid_dests):
                d['rank'] = i + 1

        comparison['ranking'] = valid_dests
        return comparison

    async def get_route_demand_signal(
        self,
        origin: str,
        destination: str
    ) -> Dict[str, Any]:
        """
        Get aggregated demand signal for a specific route based on trends.

        Args:
            origin: Origin airport code
            destination: Destination airport code

        Returns:
            Demand signal for the route
        """
        # Get trends for destination from origin market
        dest_name = self._get_destination_name(destination)

        # Get state/region code for origin
        origin_geo = self._get_origin_geo(origin)

        # Search multiple query types
        tasks = [
            self.get_interest_over_time(f"flights to {dest_name}", geo=origin_geo),
            self.get_interest_over_time(f"{dest_name} vacation", geo=origin_geo),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine signals
        signals = []
        for i, result in enumerate(results):
            if isinstance(result, Exception) or not result.get('success'):
                continue
            data = result['data']
            signals.append({
                'type': 'flights' if i == 0 else 'vacation',
                'current': data['current_interest'],
                'average': data['avg_interest'],
                'trend': data['trend_direction'],
            })

        if not signals:
            # Return synthetic data when API is unavailable
            return self._get_synthetic_demand_signal(origin, destination, dest_name)

        # Calculate combined signal strength
        avg_current = sum(s['current'] for s in signals) / len(signals)
        avg_average = sum(s['average'] for s in signals) / len(signals)
        ratio = avg_current / avg_average if avg_average > 0 else 1.0

        # Map to segment signal
        if ratio > 1.2:
            signal_strength = 0.8
            demand_outlook = 'strong'
        elif ratio > 1.0:
            signal_strength = 0.5
            demand_outlook = 'moderate'
        elif ratio > 0.8:
            signal_strength = 0.3
            demand_outlook = 'normal'
        else:
            signal_strength = 0.1
            demand_outlook = 'weak'

        return {
            'success': True,
            'route': f"{origin}-{destination}",
            'origin': origin,
            'destination': destination,
            'destination_name': dest_name,
            'signal_strength': signal_strength,
            'demand_outlook': demand_outlook,
            'interest_ratio': ratio,
            'signals': signals,
            'segment': 'leisure',  # Trends primarily drive leisure
            'explanation': f"Search trends indicate {demand_outlook} demand for {dest_name} from {origin} market",
        }

    def _get_origin_geo(self, origin_code: str) -> str:
        """Map origin airport to geographic region for trends."""
        # Map airports to state codes for more targeted trends
        airport_to_state = {
            'JFK': 'US-NY', 'LGA': 'US-NY', 'EWR': 'US-NJ',
            'BOS': 'US-MA', 'ORD': 'US-IL', 'LAX': 'US-CA',
            'SFO': 'US-CA', 'DFW': 'US-TX', 'ATL': 'US-GA',
            'DEN': 'US-CO', 'LAS': 'US-NV', 'PHX': 'US-AZ',
            'SEA': 'US-WA', 'DTW': 'US-MI', 'MSP': 'US-MN',
            'MIA': 'US-FL', 'FLL': 'US-FL', 'MCO': 'US-FL', 'TPA': 'US-FL',
            'PHL': 'US-PA', 'DCA': 'US-VA', 'IAD': 'US-VA', 'BWI': 'US-MD',
        }
        return airport_to_state.get(origin_code.upper(), 'US')

    def _get_synthetic_demand_signal(
        self,
        origin: str,
        destination: str,
        dest_name: str
    ) -> Dict[str, Any]:
        """Generate synthetic demand signal when API is unavailable."""
        # High-interest leisure destinations
        high_interest = {'MIA', 'FLL', 'MCO', 'LAS', 'CUN', 'SJU', 'PUJ', 'MBJ', 'AUA', 'NAS'}
        moderate_interest = {'TPA', 'SAN', 'PHX', 'DEN', 'SXM', 'ATL'}

        dest = destination.upper()

        if dest in high_interest:
            signal_strength = 0.7
            demand_outlook = 'strong'
            explanation = f"{dest_name} is a high-demand leisure destination"
        elif dest in moderate_interest:
            signal_strength = 0.5
            demand_outlook = 'moderate'
            explanation = f"{dest_name} shows moderate leisure demand"
        else:
            signal_strength = 0.3
            demand_outlook = 'normal'
            explanation = f"Standard demand patterns for {dest_name}"

        return {
            'success': True,
            'route': f"{origin}-{destination}",
            'origin': origin,
            'destination': destination,
            'destination_name': dest_name,
            'signal_strength': signal_strength,
            'demand_outlook': demand_outlook,
            'interest_ratio': 1.0,
            'signals': [],
            'segment': 'leisure',
            'explanation': explanation + " (estimated - no API key)",
            'source': 'synthetic',
        }


class ExternalDataService:
    """
    Unified service for all external data integrations.
    """

    def __init__(self, config: Optional[APIConfig] = None):
        if config is None:
            config = APIConfig.from_env()

        self.airlabs = AirLabsClient(config.airlabs_key)
        self.serp = SerpAPIClient(config.serp_api_key)
        self.weather = OpenWeatherClient(config.openweathermap_key)
        self.trends = SearchAPITrendsClient(config.searchapi_key)

    async def get_route_intelligence(
        self,
        origin: str,
        destination: str,
        departure_date: Optional[str] = None,
        include_trends: bool = False
    ) -> Dict[str, Any]:
        """
        Get comprehensive intelligence for a route from all sources.
        """
        tasks = [
            self.airlabs.get_schedules(origin, destination),
            self.weather.get_weather_differential(origin, destination),
        ]

        if departure_date:
            tasks.append(self.serp.get_competitive_fares(origin, destination, departure_date))

        if include_trends:
            tasks.append(self.trends.get_route_demand_signal(origin, destination))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        intelligence = {
            'route': f"{origin}-{destination}",
            'timestamp': datetime.now().isoformat(),
            'schedules': results[0] if not isinstance(results[0], Exception) else {'error': str(results[0])},
            'weather': results[1] if not isinstance(results[1], Exception) else {'error': str(results[1])},
        }

        result_idx = 2
        if departure_date:
            intelligence['competitive_fares'] = results[result_idx] if not isinstance(results[result_idx], Exception) else {'error': str(results[result_idx])}
            result_idx += 1

        if include_trends and result_idx < len(results):
            intelligence['search_trends'] = results[result_idx] if not isinstance(results[result_idx], Exception) else {'error': str(results[result_idx])}

        return intelligence

    async def get_competitor_analysis(
        self,
        origin: str,
        destination: str,
        dates: List[str]
    ) -> Dict[str, Any]:
        """
        Get competitive fare analysis across multiple dates.
        """
        tasks = [
            self.serp.get_competitive_fares(origin, destination, d)
            for d in dates
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        analysis = {
            'route': f"{origin}-{destination}",
            'dates_analyzed': dates,
            'results': [],
        }

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                analysis['results'].append({'date': dates[i], 'error': str(result)})
            else:
                analysis['results'].append(result)

        # Aggregate across dates
        all_airlines = set()
        for r in analysis['results']:
            if 'airline_analysis' in r:
                all_airlines.update(r['airline_analysis'].keys())

        return analysis
