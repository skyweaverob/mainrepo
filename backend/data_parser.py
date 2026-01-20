"""
SkyWeave Data Ingestion and Parsing Engine

Handles auto-detection and parsing of airline data from any CSV/XLSX format.
Preserves route directionality (EWR-LAX ≠ LAX-EWR).
"""

import pandas as pd
import numpy as np
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field


@dataclass
class ParsedRoute:
    """Represents a parsed route with directionality preserved."""
    origin: str
    destination: str
    route_key: str  # "EWR-LAX" - directional
    market_pair: Tuple[str, str]  # ("EWR", "LAX") sorted - for bidirectional grouping


@dataclass
class DataSchema:
    """Detected schema for a loaded dataset."""
    file_type: str  # 'network', 'fleet', 'crew', 'mro'
    origin_col: Optional[str] = None
    dest_col: Optional[str] = None
    market_col: Optional[str] = None
    column_mappings: Dict[str, str] = field(default_factory=dict)
    unique_routes: List[ParsedRoute] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# Airport categorization for segment inference
AIRPORT_CATEGORIES = {
    'cruise_ports': ['MIA', 'FLL', 'TPA', 'SJU', 'CZM', 'NAS', 'GCM', 'SXM',
                     'POS', 'BGI', 'AUA', 'CUR', 'STT', 'STX', 'SAV', 'CHS',
                     'JAX', 'MSY', 'HOU', 'SEA', 'YVR', 'LAX', 'SAN', 'NYC'],
    'beach_resort': ['CUN', 'PUJ', 'MBJ', 'SJO', 'LIR', 'PVR', 'SJD', 'GCM',
                     'AUA', 'SXM', 'PLS', 'EYW', 'RSW', 'PBI', 'HNL', 'OGG',
                     'KOA', 'LIH', 'SJU', 'STT', 'STX', 'NAS', 'FPO'],
    'theme_park': ['MCO', 'SAN', 'LAX', 'ANA'],
    'casino': ['LAS', 'RNO', 'ATL', 'BIL'],
    'business_hub': ['JFK', 'LGA', 'EWR', 'ORD', 'LAX', 'SFO', 'DFW', 'IAH',
                     'ATL', 'BOS', 'DCA', 'IAD', 'SEA', 'DEN', 'PHX', 'CLT',
                     'MIA', 'MSP', 'DTW', 'PHL'],
    'secondary': ['ABQ', 'ALB', 'AUS', 'BDL', 'BHM', 'BNA', 'BUF', 'BWI',
                  'CLE', 'CMH', 'CVG', 'DAY', 'DSM', 'ELP', 'GRR', 'GSO',
                  'IND', 'JAX', 'MCI', 'MEM', 'MKE', 'OKC', 'OMA', 'ONT',
                  'PIT', 'PVD', 'RDU', 'RIC', 'ROC', 'SAT', 'SDF', 'SJC',
                  'SMF', 'SNA', 'STL', 'SYR', 'TUL', 'TUS']
}


def parse_market_code(code: Any) -> Optional[Tuple[str, str]]:
    """
    Parse any market code format into origin/destination.

    Supported formats:
    - "EWRLAX" or "LAXEWR" (6 chars, concatenated)
    - "EWR-LAX" or "EWR_LAX" or "EWR/LAX" (with separator)
    - "EWR LAX" (space separated)
    """
    if pd.isna(code):
        return None

    code = str(code).upper().strip()

    # Format: "EWRLAX" (exactly 6 uppercase letters)
    if re.match(r'^[A-Z]{6}$', code):
        return (code[:3], code[3:])

    # Format: "EWR-LAX", "EWR_LAX", "EWR/LAX", "EWR LAX"
    match = re.match(r'^([A-Z]{3})[\s\-_/]([A-Z]{3})$', code)
    if match:
        return (match.group(1), match.group(2))

    # Format: Might have flight number prefix "NK123 EWRLAX"
    match = re.search(r'([A-Z]{3})[\s\-_/]?([A-Z]{3})$', code)
    if match:
        return (match.group(1), match.group(2))

    return None


def normalize_route(origin: str, destination: str) -> ParsedRoute:
    """
    Create a ParsedRoute with preserved directionality.
    EWR-LAX and LAX-EWR are DIFFERENT routes.
    """
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    return ParsedRoute(
        origin=origin,
        destination=destination,
        route_key=f"{origin}-{destination}",
        market_pair=tuple(sorted([origin, destination]))
    )


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names for consistent access."""
    df.columns = (df.columns
                  .str.strip()
                  .str.lower()
                  .str.replace(' ', '_')
                  .str.replace('(', '')
                  .str.replace(')', '')
                  .str.replace('&', 'and'))
    return df


def detect_file_type(df: pd.DataFrame) -> str:
    """
    Determine if file is network, fleet, crew, mro, traffic, fares, or routes data.
    """
    cols_lower = set(c.lower() for c in df.columns)

    # Fleet indicators
    fleet_signals = ['aircraft_registration', 'aircraft_type', 'seat_config', 'home_base',
                     'flight_hours_total', 'flight_cycles_total', 'lessor', 'msn', 'next_c_check']
    if sum(1 for s in fleet_signals if any(s in c for c in cols_lower)) >= 3:
        return 'fleet'

    # Crew indicators
    crew_signals = ['employee_id', 'crew_type', 'seniority_number', 'aircraft_qual',
                    'recurrent_training_due', 'line_check_due', 'total_flight_hours', 'hourly_rate']
    if sum(1 for s in crew_signals if any(s in c for c in cols_lower)) >= 3:
        return 'crew'

    # MRO indicators
    mro_signals = ['work_order_id', 'maintenance_type', 'mro_provider', 'mro_location',
                   'downtime_days', 'ata_chapter', 'parts_cost', 'labor_hours']
    if sum(1 for s in mro_signals if any(s in c for c in cols_lower)) >= 3:
        return 'mro'

    # Fare scrape data indicators
    fare_signals = ['nk_fare', 'f9_fare', 'market_lowest', 'price_level', 'scrape_timestamp',
                    'typical_range', 'carrier_count']
    if sum(1 for s in fare_signals if any(s in c for c in cols_lower)) >= 2:
        return 'fares'

    # Route summary data (carrier routes with passengers)
    route_signals = ['route_id', 'months_served', 'departures', 'carrier']
    if sum(1 for s in route_signals if any(s in c for c in cols_lower)) >= 2:
        return 'routes'

    # DOT T-100 / DB1B traffic data
    traffic_signals = ['passengers', 'unique_carrier', 'yearqtr', 'roundtrip', 'quarter']
    if sum(1 for s in traffic_signals if any(s in c for c in cols_lower)) >= 2:
        return 'traffic'

    # Network indicators (default for airline demand/revenue data)
    network_signals = ['market', 'pax', 'revenue', 'fare', 'load_factor', 'asm', 'rpm',
                       'constrained', 'unconstrained', 'spill']
    if sum(1 for s in network_signals if any(s in c for c in cols_lower)) >= 2:
        return 'network'

    return 'unknown'


def detect_routes(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Auto-detect route information from dataframe columns.
    """
    routes_info = {
        'origin_col': None,
        'dest_col': None,
        'market_col': None,
        'parsed_routes': []
    }

    cols_lower = {c.lower(): c for c in df.columns}

    # Strategy 1: Separate origin/destination columns
    origin_patterns = ['departure_airport', 'origin', 'dep', 'dep_airport', 'from', 'orig']
    dest_patterns = ['arrival_airport', 'destination', 'dest', 'arr_airport', 'to', 'arr']

    for op in origin_patterns:
        for col in cols_lower:
            if op in col:
                routes_info['origin_col'] = cols_lower[col]
                break
        if routes_info['origin_col']:
            break

    for dp in dest_patterns:
        for col in cols_lower:
            if dp in col:
                routes_info['dest_col'] = cols_lower[col]
                break
        if routes_info['dest_col']:
            break

    # Strategy 2: Combined market column
    market_patterns = ['market', 'o&d', 'ond', 'route', 'city_pair', 'citypair', 'od']
    for mp in market_patterns:
        for col in cols_lower:
            if mp in col and 'segment' not in col:
                routes_info['market_col'] = cols_lower[col]
                break
        if routes_info['market_col']:
            break

    # Parse routes based on what we found
    if routes_info['origin_col'] and routes_info['dest_col']:
        for _, row in df.iterrows():
            if pd.notna(row[routes_info['origin_col']]) and pd.notna(row[routes_info['dest_col']]):
                routes_info['parsed_routes'].append(normalize_route(
                    str(row[routes_info['origin_col']]),
                    str(row[routes_info['dest_col']])
                ))
    elif routes_info['market_col']:
        for _, row in df.iterrows():
            parsed = parse_market_code(row[routes_info['market_col']])
            if parsed:
                routes_info['parsed_routes'].append(normalize_route(parsed[0], parsed[1]))

    # Deduplicate while preserving order
    seen = set()
    unique_routes = []
    for r in routes_info['parsed_routes']:
        if r.route_key not in seen:
            seen.add(r.route_key)
            unique_routes.append(r)
    routes_info['unique_routes'] = unique_routes

    return routes_info


def detect_column_mappings(df: pd.DataFrame, file_type: str) -> Dict[str, str]:
    """
    Map standard column names to actual columns in the dataframe.
    """
    mappings = {}
    cols_lower = {c.lower().replace(' ', '_').replace('(', '').replace(')', ''): c for c in df.columns}

    # Network column patterns
    network_patterns = {
        'market': ['market', 'o_and_d', 'ond', 'route', 'city_pair'],
        'origin': ['departure_airport', 'origin', 'dep', 'from'],
        'destination': ['arrival_airport', 'destination', 'dest', 'to'],
        'dow': ['departure_day', 'dow', 'day', 'day_of_week'],
        'hub': ['hub_nested', 'hub', 'station_type', 'base'],
        'scenario': ['scenariolabel', 'scenario', 'scen'],
        'seats': ['seats', 'capacity', 'cap'],
        'aircraft_type': ['aircraft_type', 'equipment', 'eq', 'ac_type'],
        'constrained_local_pax': ['constrained_local_pax', 'const_local_pax'],
        'unconstrained_local_pax': ['unconstrained_local_pax', 'unc_local_pax'],
        'constrained_segment_pax': ['constrained_segment_pax', 'const_seg_pax'],
        'unconstrained_segment_pax': ['unconstrained_segment_pax', 'unc_seg_pax'],
        'load_factor': ['load_factor', 'lf', 'load'],
        'spill_rate': ['spill_rate', 'spill', 'spillage'],
        'constrained_local_fare': ['constrained_local_fare', 'const_fare'],
        'unconstrained_local_fare': ['unconstrained_local_fare', 'unc_fare'],
        'constrained_local_revenue': ['constrained_local_revenue', 'const_rev'],
        'unconstrained_local_revenue': ['unconstrained_local_revenue', 'unc_rev'],
        'constrained_segment_revenue': ['constrained_segment_revenue'],
        'unconstrained_segment_revenue': ['unconstrained_segment_revenue'],
        'asm': ['asm', 'ask', 'available_seat_miles'],
        'rpm': ['constrained_rpk', 'rpm', 'rpk', 'revenue_pax_miles'],
        'distance': ['dist_mi', 'distance_km', 'distance'],
        'rask': ['constrained_rask_cent', 'rask', 'unit_revenue'],
        'yield': ['constrained_yield_cent,_km', 'yield', 'yield_cent'],
    }

    # Fleet column patterns
    fleet_patterns = {
        'registration': ['aircraft_registration', 'tail', 'registration'],
        'aircraft_type': ['aircraft_type', 'type', 'ac_type'],
        'subtype': ['aircraft_subtype', 'subtype', 'variant'],
        'engine': ['engine_type', 'engine'],
        'delivery_date': ['delivery_date', 'delivery'],
        'age': ['aircraft_age_years', 'age'],
        'lessor': ['lessor', 'owner'],
        'lease_end': ['lease_end_date', 'lease_end'],
        'seats': ['seat_config', 'seats', 'capacity'],
        'home_base': ['home_base', 'base', 'domicile'],
        'status': ['current_status', 'status'],
        'flight_hours': ['flight_hours_total', 'total_hours'],
        'flight_cycles': ['flight_cycles_total', 'total_cycles'],
        'next_c_check': ['next_c_check_due', 'c_check_due'],
        'wifi': ['wifi_equipped', 'wifi'],
    }

    # Crew column patterns
    crew_patterns = {
        'employee_id': ['employee_id', 'crew_id', 'emp_id'],
        'crew_type': ['crew_type', 'position', 'role'],
        'name': ['last_name', 'name'],
        'seniority': ['seniority_number', 'seniority'],
        'hire_date': ['date_of_hire', 'hire_date'],
        'home_base': ['home_base', 'base', 'domicile'],
        'status': ['status', 'crew_status'],
        'aircraft_qual': ['aircraft_qual', 'qualification'],
        'total_hours': ['total_flight_hours', 'hours'],
        'hours_30': ['hours_last_30_days', 'hours_30'],
        'hourly_rate': ['hourly_rate_usd', 'hourly_rate'],
        'recurrent_due': ['recurrent_training_due', 'recurrent_due'],
        'medical_due': ['medical_due', 'medical'],
    }

    # MRO column patterns
    mro_patterns = {
        'work_order': ['work_order_id', 'wo_id'],
        'registration': ['aircraft_registration', 'tail'],
        'maintenance_type': ['maintenance_type', 'mx_type'],
        'description': ['maintenance_description', 'description'],
        'scheduled_start': ['scheduled_start_date', 'start_date'],
        'scheduled_end': ['scheduled_end_date', 'end_date'],
        'status': ['status', 'wo_status'],
        'mro_provider': ['mro_provider', 'provider'],
        'mro_location': ['mro_location', 'location'],
        'parts_cost': ['parts_cost_usd', 'parts_cost'],
        'total_cost': ['total_cost_usd', 'total_cost'],
        'downtime': ['downtime_days', 'downtime'],
        'ata_chapter': ['ata_chapter', 'ata'],
        'priority': ['priority', 'urgency'],
    }

    patterns = {
        'network': network_patterns,
        'fleet': fleet_patterns,
        'crew': crew_patterns,
        'mro': mro_patterns,
    }.get(file_type, network_patterns)

    for standard_name, search_patterns in patterns.items():
        for pattern in search_patterns:
            # First try exact match
            if pattern in cols_lower:
                mappings[standard_name] = cols_lower[pattern]
                break
            # Then try substring match, but avoid matching 'unconstrained' when looking for 'constrained'
            for col_lower, col_original in cols_lower.items():
                # Skip if looking for constrained but found unconstrained
                if 'constrained' in pattern and pattern.startswith('constrained') and col_lower.startswith('unconstrained'):
                    continue
                if pattern in col_lower:
                    mappings[standard_name] = col_original
                    break
            if standard_name in mappings:
                break

    return mappings


def load_excel_file(filepath: str) -> Tuple[pd.DataFrame, str]:
    """
    Load an Excel file, auto-detecting the main data sheet.
    """
    xlsx = pd.ExcelFile(filepath)

    # Find the sheet with the most data
    best_sheet = None
    best_score = 0

    for sheet in xlsx.sheet_names:
        try:
            df = pd.read_excel(xlsx, sheet_name=sheet, nrows=100)
            # Skip summary sheets (few rows) and lookup sheets (few columns)
            if len(df) > 0 and len(df.columns) > 5:
                score = len(df) * len(df.columns)
                if score > best_score:
                    best_score = score
                    best_sheet = sheet
        except Exception:
            continue

    if best_sheet is None:
        best_sheet = xlsx.sheet_names[0]

    df = pd.read_excel(xlsx, sheet_name=best_sheet)
    return df, best_sheet


def load_airline_data(filepath: str) -> Tuple[pd.DataFrame, DataSchema]:
    """
    Load airline data from any CSV or Excel file.
    Auto-detect structure, find the main data sheet, parse routes.
    """
    path = Path(filepath)

    if path.suffix.lower() in ['.xlsx', '.xls']:
        df, sheet_name = load_excel_file(filepath)
    else:
        df = pd.read_csv(filepath)
        sheet_name = None

    # Detect file type
    file_type = detect_file_type(df)

    # Detect column mappings
    column_mappings = detect_column_mappings(df, file_type)

    # Create schema
    schema = DataSchema(
        file_type=file_type,
        column_mappings=column_mappings,
    )

    # Parse routes for network data
    if file_type == 'network':
        routes_info = detect_routes(df)
        schema.origin_col = routes_info.get('origin_col')
        schema.dest_col = routes_info.get('dest_col')
        schema.market_col = routes_info.get('market_col')
        schema.unique_routes = routes_info.get('unique_routes', [])

    # Validate and add warnings
    if file_type == 'unknown':
        schema.warnings.append("Could not determine file type. Limited analysis available.")

    if file_type == 'network' and not schema.unique_routes:
        schema.warnings.append("Could not detect any routes. Check origin/destination columns.")

    return df, schema


def categorize_airport(iata_code: str) -> List[str]:
    """Return list of categories for an airport."""
    iata_code = iata_code.upper().strip()
    categories = []
    for category, airports in AIRPORT_CATEGORIES.items():
        if iata_code in airports:
            categories.append(category)
    return categories if categories else ['other']


def infer_route_segment_profile(origin: str, destination: str) -> Dict[str, float]:
    """
    Infer likely segment mix based on O&D characteristics.
    Returns dict with segment weights (must sum to 1.0).
    """
    origin_cats = set(categorize_airport(origin))
    dest_cats = set(categorize_airport(destination))

    profile = {'vfr': 0.25, 'leisure': 0.25, 'cruise': 0.0, 'business': 0.25, 'other': 0.25}

    # Cruise port destination → likely cruise traffic
    if 'cruise_ports' in dest_cats:
        profile['cruise'] = 0.20
        profile['leisure'] -= 0.10
        profile['other'] -= 0.10

    # Beach/resort destination → leisure heavy
    if 'beach_resort' in dest_cats:
        profile['leisure'] = 0.50
        profile['vfr'] = 0.30
        profile['business'] = 0.10
        profile['cruise'] = 0.10 if 'cruise_ports' in dest_cats else 0.0
        profile['other'] = 0.0

    # Theme park → family leisure + VFR
    if 'theme_park' in dest_cats:
        profile['leisure'] = 0.45
        profile['vfr'] = 0.40
        profile['business'] = 0.10
        profile['cruise'] = 0.0
        profile['other'] = 0.05

    # Casino destination
    if 'casino' in dest_cats:
        profile['leisure'] = 0.55
        profile['vfr'] = 0.20
        profile['business'] = 0.15
        profile['cruise'] = 0.0
        profile['other'] = 0.10

    # Business hub to business hub → higher business
    if 'business_hub' in origin_cats and 'business_hub' in dest_cats:
        profile['business'] = 0.35
        profile['vfr'] = 0.30
        profile['leisure'] = 0.25
        profile['cruise'] = 0.0
        profile['other'] = 0.10

    # Secondary market → VFR heavy
    if 'secondary' in origin_cats or 'secondary' in dest_cats:
        profile['vfr'] = 0.45
        profile['leisure'] = 0.30
        profile['business'] = 0.15
        profile['cruise'] = 0.0
        profile['other'] = 0.10

    # Normalize to sum to 1.0
    total = sum(profile.values())
    return {k: round(v/total, 4) for k, v in profile.items()}


class AirlineDataLoader:
    """
    Main class for loading and managing airline data.
    """

    def __init__(self):
        self.network_data: Optional[pd.DataFrame] = None
        self.network_schema: Optional[DataSchema] = None
        self.fleet_data: Optional[pd.DataFrame] = None
        self.fleet_schema: Optional[DataSchema] = None
        self.crew_data: Optional[pd.DataFrame] = None
        self.crew_schema: Optional[DataSchema] = None
        self.mro_data: Optional[pd.DataFrame] = None
        self.mro_schema: Optional[DataSchema] = None

    def load_file(self, filepath: str) -> str:
        """Load a file and auto-categorize it."""
        df, schema = load_airline_data(filepath)

        if schema.file_type == 'network':
            self.network_data = df
            self.network_schema = schema
        elif schema.file_type == 'fleet':
            self.fleet_data = df
            self.fleet_schema = schema
        elif schema.file_type == 'crew':
            self.crew_data = df
            self.crew_schema = schema
        elif schema.file_type == 'mro':
            self.mro_data = df
            self.mro_schema = schema

        return schema.file_type

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all loaded data."""
        summary = {}

        if self.network_data is not None:
            summary['network'] = {
                'rows': len(self.network_data),
                'unique_routes': len(self.network_schema.unique_routes) if self.network_schema else 0,
                'columns': list(self.network_data.columns),
                'mappings': self.network_schema.column_mappings if self.network_schema else {},
            }

        if self.fleet_data is not None:
            summary['fleet'] = {
                'rows': len(self.fleet_data),
                'columns': list(self.fleet_data.columns),
                'mappings': self.fleet_schema.column_mappings if self.fleet_schema else {},
            }

        if self.crew_data is not None:
            summary['crew'] = {
                'rows': len(self.crew_data),
                'columns': list(self.crew_data.columns),
                'mappings': self.crew_schema.column_mappings if self.crew_schema else {},
            }

        if self.mro_data is not None:
            summary['mro'] = {
                'rows': len(self.mro_data),
                'columns': list(self.mro_data.columns),
                'mappings': self.mro_schema.column_mappings if self.mro_schema else {},
            }

        return summary
