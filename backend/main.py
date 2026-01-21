"""
SkyWeave API Server

FastAPI backend for the SkyWeave airline optimization platform.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, date
import json

from dotenv import load_dotenv

# Load environment variables from .env file BEFORE importing modules that use them
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd
import numpy as np
import aiofiles
import math


def sanitize_for_json(obj):
    """Recursively sanitize data for JSON serialization, handling NaN/Infinity."""
    if obj is None:
        return None
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, np.floating):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return [sanitize_for_json(x) for x in obj.tolist()]
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(x) for x in obj]
    return obj


class NaNSafeJSONResponse(JSONResponse):
    """JSONResponse that handles NaN and Infinity values."""
    def render(self, content) -> bytes:
        sanitized = sanitize_for_json(content)
        return json.dumps(
            sanitized,
            ensure_ascii=False,
        ).encode("utf-8")

from data_parser import AirlineDataLoader, load_airline_data, infer_route_segment_profile
from demand_decomposition import DemandDecomposer, NetworkAnalyzer
from segment_inference import SegmentSignalAggregator, CruiseSignalEngine
from api_integrations import ExternalDataService, APIConfig
from network_intelligence import (
    NetworkIntelligenceEngine,
    CrossDomainIntelligence,
    ActionableInsightEngine,
    BookingCurveAnalyzer
)


# Initialize FastAPI app with NaN-safe JSON response
app = FastAPI(
    title="SkyWeave API",
    description="AI-native airline optimization platform",
    version="0.1.0",
    default_response_class=NaNSafeJSONResponse
)

# CORS middleware for frontend
# Allow Railway domains and localhost for development
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for loaded data
data_store: Dict[str, Any] = {
    'network': None,
    'network_schema': None,
    'fleet': None,
    'crew': None,
    'mro': None,
    'fares': None,
    'routes': None,
    'traffic': None,
    'decomposer': None,
    'analyzer': None,
    # Network Intelligence components
    'network_intelligence': None,
    'cross_domain': None,
    'insight_engine': None,
    'booking_curve_analyzer': None,
}

# Data directory - configurable via environment variable for cloud deployment
# Default: backend/ -> skyweave/ -> NK PROTOTYPE/
DATA_DIR = Path(os.environ.get("DATA_PATH", Path(__file__).parent.parent.parent))
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# Pydantic models for request/response
class RouteQuery(BaseModel):
    origin: str
    destination: str


class DateQuery(BaseModel):
    origin: str
    destination: str
    date: str  # YYYY-MM-DD


class SegmentMix(BaseModel):
    vfr: float
    leisure: float
    cruise: float
    business: float
    other: float


# Helper to convert numpy types to Python types
def convert_numpy(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        val = float(obj)
        # Handle NaN and Infinity which are not JSON compliant
        if np.isnan(val) or np.isinf(val):
            return None
        return val
    elif isinstance(obj, float):
        # Handle regular Python floats too
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, np.ndarray):
        return [convert_numpy(x) for x in obj.tolist()]
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(i) for i in obj]
    return obj


@app.on_event("startup")
async def load_default_data():
    """Load default data files on startup."""
    print("=" * 60)
    print("SkyWeave Data Loader")
    print(f"DATA_DIR: {DATA_DIR}")
    print(f"DATA_DIR exists: {DATA_DIR.exists()}")
    print("=" * 60)

    # Try to load Spirit network data
    network_file = DATA_DIR / "ASG mkt level_0711data_RR.xlsx"
    if network_file.exists():
        try:
            df, schema = load_airline_data(str(network_file))
            data_store['network'] = df
            data_store['network_schema'] = schema
            data_store['decomposer'] = DemandDecomposer(df, schema.column_mappings)
            data_store['analyzer'] = NetworkAnalyzer(df, schema.column_mappings)
            print(f"✓ Network data: {len(df):,} rows, {len(schema.unique_routes):,} routes")
        except Exception as e:
            print(f"✗ Network data: {e}")

    # Load fleet data
    fleet_file = DATA_DIR / "spirit_fleet_2026.csv"
    if fleet_file.exists():
        try:
            df = pd.read_csv(fleet_file)
            data_store['fleet'] = df
            print(f"✓ Fleet data: {len(df)} aircraft")
        except Exception as e:
            print(f"✗ Fleet data: {e}")

    # Load crew data
    crew_file = DATA_DIR / "spirit_crew_roster_2026.csv"
    if crew_file.exists():
        try:
            df = pd.read_csv(crew_file)
            data_store['crew'] = df
            print(f"✓ Crew data: {len(df):,} crew members")
        except Exception as e:
            print(f"✗ Crew data: {e}")

    # Load MRO data
    mro_file = DATA_DIR / "spirit_mro_schedule_2026.csv"
    if mro_file.exists():
        try:
            df = pd.read_csv(mro_file)
            data_store['mro'] = df
            print(f"✓ MRO data: {len(df)} work orders")
        except Exception as e:
            print(f"✗ MRO data: {e}")

    # Load scraped fares data
    fares_file = DATA_DIR / "scraped_fares.csv"
    if fares_file.exists():
        try:
            df = pd.read_csv(fares_file)
            data_store['fares'] = df
            print(f"✓ Fares data: {len(df):,} fare records")
        except Exception as e:
            print(f"✗ Fares data: {e}")

    # Load NK routes data
    routes_file = DATA_DIR / "nk_routes.csv"
    if routes_file.exists():
        try:
            df = pd.read_csv(routes_file)
            data_store['routes'] = df
            print(f"✓ Routes data: {len(df)} route summaries")
        except Exception as e:
            print(f"✗ Routes data: {e}")

    # Load T-100 traffic data
    traffic_file = DATA_DIR / "T_100_OCT.csv"
    if traffic_file.exists():
        try:
            df = pd.read_csv(traffic_file)
            data_store['traffic'] = df
            print(f"✓ Traffic data: {len(df):,} T-100 records")
        except Exception as e:
            print(f"✗ Traffic data: {e}")

    # Initialize Network Intelligence Engine
    print("-" * 60)
    print("Initializing Network Intelligence Engine...")
    try:
        network_intel = NetworkIntelligenceEngine(DATA_DIR)
        network_intel.load_data()
        data_store['network_intelligence'] = network_intel

        # Initialize Cross-Domain Intelligence
        cross_domain = CrossDomainIntelligence(network_intel)
        cross_domain.set_operational_data(
            fleet_df=data_store['fleet'],
            crew_df=data_store['crew'],
            mro_df=data_store['mro']
        )
        data_store['cross_domain'] = cross_domain

        # Initialize Insight Engine
        insight_engine = ActionableInsightEngine(network_intel, cross_domain)
        data_store['insight_engine'] = insight_engine

        # Initialize Booking Curve Analyzer
        data_store['booking_curve_analyzer'] = BookingCurveAnalyzer()

        print("✓ Network Intelligence Engine initialized")
    except Exception as e:
        print(f"✗ Network Intelligence Engine: {e}")

    print("=" * 60)
    print("Data loading complete")
    print("=" * 60)


# ==================== Data Management Endpoints ====================

@app.get("/api/status")
async def get_status():
    """Get current data loading status."""
    return {
        "network_loaded": data_store['network'] is not None,
        "network_rows": len(data_store['network']) if data_store['network'] is not None else 0,
        "fleet_loaded": data_store['fleet'] is not None,
        "fleet_rows": len(data_store['fleet']) if data_store['fleet'] is not None else 0,
        "crew_loaded": data_store['crew'] is not None,
        "crew_rows": len(data_store['crew']) if data_store['crew'] is not None else 0,
        "mro_loaded": data_store['mro'] is not None,
        "mro_rows": len(data_store['mro']) if data_store['mro'] is not None else 0,
        "fares_loaded": data_store['fares'] is not None,
        "fares_rows": len(data_store['fares']) if data_store['fares'] is not None else 0,
        "routes_loaded": data_store['routes'] is not None,
        "routes_rows": len(data_store['routes']) if data_store['routes'] is not None else 0,
        "traffic_loaded": data_store['traffic'] is not None,
        "traffic_rows": len(data_store['traffic']) if data_store['traffic'] is not None else 0,
    }


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process a data file."""
    # Save file to persistent DATA_DIR for restart persistence
    file_path = DATA_DIR / file.filename
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)

    # Load and parse
    try:
        df, schema = load_airline_data(str(file_path))

        # Store based on file type
        if schema.file_type == 'network':
            data_store['network'] = df
            data_store['network_schema'] = schema
            data_store['decomposer'] = DemandDecomposer(df, schema.column_mappings)
            data_store['analyzer'] = NetworkAnalyzer(df, schema.column_mappings)
        elif schema.file_type == 'fleet':
            data_store['fleet'] = df
            # Update cross-domain if it exists
            if data_store.get('cross_domain'):
                data_store['cross_domain'].set_operational_data(
                    fleet_df=data_store['fleet'],
                    crew_df=data_store.get('crew'),
                    mro_df=data_store.get('mro')
                )
        elif schema.file_type == 'crew':
            data_store['crew'] = df
            if data_store.get('cross_domain'):
                data_store['cross_domain'].set_operational_data(
                    fleet_df=data_store.get('fleet'),
                    crew_df=data_store['crew'],
                    mro_df=data_store.get('mro')
                )
        elif schema.file_type == 'mro':
            data_store['mro'] = df
            if data_store.get('cross_domain'):
                data_store['cross_domain'].set_operational_data(
                    fleet_df=data_store.get('fleet'),
                    crew_df=data_store.get('crew'),
                    mro_df=data_store['mro']
                )
        elif schema.file_type == 'fares':
            data_store['fares'] = df
        elif schema.file_type == 'routes':
            data_store['routes'] = df
        elif schema.file_type == 'traffic':
            data_store['traffic'] = df

        # Reload Network Intelligence if relevant files uploaded
        intel_files = ['T_100_OCT.csv', 'nk_routes.csv', 'f9_routes.csv',
                       'overlap_markets.csv', 'scraped_fares.csv', 'db1b_market_parsed.csv']
        if file.filename in intel_files:
            try:
                print(f"Reloading Network Intelligence after {file.filename} upload...")
                network_intel = NetworkIntelligenceEngine(DATA_DIR)
                network_intel.load_data()
                data_store['network_intelligence'] = network_intel

                cross_domain = CrossDomainIntelligence(network_intel)
                cross_domain.set_operational_data(
                    fleet_df=data_store.get('fleet'),
                    crew_df=data_store.get('crew'),
                    mro_df=data_store.get('mro')
                )
                data_store['cross_domain'] = cross_domain
                data_store['insight_engine'] = ActionableInsightEngine(network_intel, cross_domain)
                print("✓ Network Intelligence reloaded")
            except Exception as e:
                print(f"✗ Network Intelligence reload failed: {e}")

        return {
            "success": True,
            "filename": file.filename,
            "file_type": schema.file_type,
            "rows": len(df),
            "columns": list(df.columns),
            "warnings": schema.warnings,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Network Analysis Endpoints ====================

@app.get("/api/network/stats")
async def get_network_stats():
    """Get overall network statistics."""
    if data_store['analyzer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    stats = data_store['analyzer'].get_network_stats()
    return convert_numpy(stats)


@app.get("/api/network/hubs")
async def get_hub_summary():
    """Get summary metrics by hub."""
    if data_store['analyzer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    summary = data_store['analyzer'].get_hub_summary()
    return convert_numpy(summary)


@app.get("/api/network/routes")
async def get_routes(
    limit: int = Query(100, ge=1, le=1000),
    hub: Optional[str] = None,
    scenario: Optional[str] = None
):
    """Get list of routes with key metrics."""
    if data_store['network'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    df = data_store['network']
    schema = data_store['network_schema']

    # Apply filters
    if hub and 'Hub (nested)' in df.columns:
        df = df[df['Hub (nested)'] == hub.upper()]
    if scenario and 'ScenarioLabel' in df.columns:
        df = df[df['ScenarioLabel'] == scenario]

    # Group by route
    origin_col = schema.column_mappings.get('origin', 'Departure Airport')
    dest_col = schema.column_mappings.get('destination', 'Arrival Airport')
    pax_col = schema.column_mappings.get('constrained_local_pax', 'Constrained Local Pax')

    route_metrics = df.groupby([origin_col, dest_col]).agg({
        pax_col: 'sum',
        'Load Factor': 'mean',
        'Spill Rate': 'mean',
        'Constrained Local Fare': 'mean',
    }).reset_index()

    route_metrics = route_metrics.sort_values(pax_col, ascending=False).head(limit)

    routes = []
    for _, row in route_metrics.iterrows():
        routes.append({
            'origin': row[origin_col],
            'destination': row[dest_col],
            'route_key': f"{row[origin_col]}-{row[dest_col]}",
            'total_pax': round(row[pax_col]),
            'avg_load_factor': round(row['Load Factor'], 3) if pd.notna(row['Load Factor']) else None,
            'avg_spill_rate': round(row['Spill Rate'], 4) if pd.notna(row['Spill Rate']) else None,
            'avg_fare': round(row['Constrained Local Fare'], 2) if pd.notna(row['Constrained Local Fare']) else None,
        })

    return routes


@app.get("/api/network/rankings")
async def get_route_rankings(
    metric: str = Query("pax", pattern="^(pax|load_factor|spill|fare)$"),
    limit: int = Query(20, ge=1, le=100)
):
    """Get top routes by specified metric."""
    if data_store['analyzer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    rankings = data_store['analyzer'].get_route_rankings(metric, limit)
    return convert_numpy(rankings)


@app.get("/api/network/asymmetry")
async def get_directional_asymmetry(limit: int = Query(20, ge=1, le=100)):
    """Get routes with significant directional asymmetry."""
    if data_store['analyzer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    asymmetries = data_store['analyzer'].get_directional_asymmetry()
    return convert_numpy(asymmetries[:limit])


# ==================== Demand Decomposition Endpoints ====================

@app.get("/api/demand/route/{origin}/{destination}")
async def get_route_decomposition(origin: str, destination: str):
    """Get demand decomposition for a specific route."""
    if data_store['decomposer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    result = data_store['decomposer'].decompose_route(origin.upper(), destination.upper())
    return convert_numpy(result)


@app.get("/api/demand/segment-profile")
async def get_segment_profile(origin: str, destination: str):
    """Get geographic-based segment profile for a route."""
    profile = infer_route_segment_profile(origin.upper(), destination.upper())
    return profile


@app.get("/api/demand/dow-heatmap/{origin}/{destination}")
async def get_dow_heatmap(origin: str, destination: str):
    """Get segment contribution by day of week."""
    if data_store['decomposer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    heatmap = data_store['decomposer'].get_dow_segment_heatmap(origin.upper(), destination.upper())
    return convert_numpy(heatmap)


@app.get("/api/demand/all-routes")
async def get_all_route_decompositions(limit: int = Query(50, ge=1, le=500)):
    """Get demand decomposition for all routes."""
    if data_store['decomposer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    all_decompositions = data_store['decomposer'].decompose_all_routes()

    # Sort by total pax and limit
    all_decompositions.sort(
        key=lambda x: x.get('segment_metrics', {}).get('vfr', {}).get('est_pax', 0) +
                      x.get('segment_metrics', {}).get('leisure', {}).get('est_pax', 0),
        reverse=True
    )

    return convert_numpy(all_decompositions[:limit])


# ==================== External Signals Endpoints ====================

@app.get("/api/signals/cruise/{destination}/{dow}")
async def get_cruise_signal(destination: str, dow: int):
    """Get cruise demand signal for a destination and day of week."""
    engine = CruiseSignalEngine()
    signal = engine.get_cruise_signal(destination.upper(), dow)
    return signal


@app.get("/api/signals/all/{origin}/{destination}")
async def get_all_signals(
    origin: str,
    destination: str,
    dow: int = Query(6, ge=1, le=7),
    month: int = Query(1, ge=1, le=12)
):
    """Get all external signals for a route."""
    aggregator = SegmentSignalAggregator()
    signals = aggregator.get_all_signals(
        origin.upper(),
        destination.upper(),
        dow,
        month
    )
    return convert_numpy(signals)


# ==================== Fleet Endpoints ====================

@app.get("/api/fleet/summary")
async def get_fleet_summary():
    """Get fleet summary statistics."""
    if data_store['fleet'] is None:
        raise HTTPException(status_code=400, detail="No fleet data loaded")

    df = data_store['fleet']

    summary = {
        'total_aircraft': len(df),
        'by_type': df['aircraft_type'].value_counts().to_dict() if 'aircraft_type' in df.columns else {},
        'by_base': df['home_base'].value_counts().to_dict() if 'home_base' in df.columns else {},
        'by_status': df['current_status'].value_counts().to_dict() if 'current_status' in df.columns else {},
        'avg_age': df['aircraft_age_years'].mean() if 'aircraft_age_years' in df.columns else None,
        'total_seats': df['seat_config'].sum() if 'seat_config' in df.columns else None,
    }

    return convert_numpy(summary)


@app.get("/api/fleet/aircraft")
async def get_fleet_list(
    base: Optional[str] = None,
    aircraft_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
):
    """Get list of aircraft with filters."""
    if data_store['fleet'] is None:
        raise HTTPException(status_code=400, detail="No fleet data loaded")

    df = data_store['fleet']

    if base:
        df = df[df['home_base'] == base.upper()]
    if aircraft_type:
        df = df[df['aircraft_type'] == aircraft_type.upper()]
    if status:
        df = df[df['current_status'] == status.upper()]

    df = df.head(limit)

    return df.to_dict(orient='records')


@app.get("/api/fleet/maintenance-due")
async def get_maintenance_due(days: int = Query(30, ge=1, le=365)):
    """Get aircraft with maintenance due within specified days."""
    if data_store['fleet'] is None:
        raise HTTPException(status_code=400, detail="No fleet data loaded")

    df = data_store['fleet']

    if 'next_c_check_due' not in df.columns:
        return []

    df['next_c_check_due'] = pd.to_datetime(df['next_c_check_due'])
    cutoff = pd.Timestamp.now() + pd.Timedelta(days=days)

    due = df[df['next_c_check_due'] <= cutoff].sort_values('next_c_check_due')

    return due[['aircraft_registration', 'aircraft_type', 'home_base', 'next_c_check_due']].to_dict(orient='records')


# ==================== Crew Endpoints ====================

@app.get("/api/crew/summary")
async def get_crew_summary():
    """Get crew summary statistics."""
    if data_store['crew'] is None:
        raise HTTPException(status_code=400, detail="No crew data loaded")

    df = data_store['crew']

    summary = {
        'total_crew': len(df),
        'by_type': df['crew_type'].value_counts().to_dict() if 'crew_type' in df.columns else {},
        'by_base': df['home_base'].value_counts().to_dict() if 'home_base' in df.columns else {},
        'by_status': df['status'].value_counts().to_dict() if 'status' in df.columns else {},
        'avg_total_hours': df['total_flight_hours'].mean() if 'total_flight_hours' in df.columns else None,
        'avg_30_day_hours': df['hours_last_30_days'].mean() if 'hours_last_30_days' in df.columns else None,
    }

    return convert_numpy(summary)


@app.get("/api/crew/by-base/{base}")
async def get_crew_by_base(base: str):
    """Get crew members at a specific base."""
    if data_store['crew'] is None:
        raise HTTPException(status_code=400, detail="No crew data loaded")

    df = data_store['crew']
    base_crew = df[df['home_base'] == base.upper()]

    return {
        'base': base.upper(),
        'total': len(base_crew),
        'by_type': base_crew['crew_type'].value_counts().to_dict() if 'crew_type' in base_crew.columns else {},
        'crew': base_crew.head(50).to_dict(orient='records'),
    }


@app.get("/api/crew/training-due")
async def get_training_due(days: int = Query(30, ge=1, le=365)):
    """Get crew with training due within specified days."""
    if data_store['crew'] is None:
        raise HTTPException(status_code=400, detail="No crew data loaded")

    df = data_store['crew']

    if 'recurrent_training_due' not in df.columns:
        return []

    df['recurrent_training_due'] = pd.to_datetime(df['recurrent_training_due'])
    cutoff = pd.Timestamp.now() + pd.Timedelta(days=days)

    due = df[df['recurrent_training_due'] <= cutoff].sort_values('recurrent_training_due')

    return due[['employee_id', 'crew_type', 'home_base', 'recurrent_training_due']].head(100).to_dict(orient='records')


# ==================== MRO Endpoints ====================

@app.get("/api/mro/summary")
async def get_mro_summary():
    """Get MRO summary statistics."""
    if data_store['mro'] is None:
        raise HTTPException(status_code=400, detail="No MRO data loaded")

    df = data_store['mro']

    summary = {
        'total_work_orders': len(df),
        'by_type': df['maintenance_type'].value_counts().to_dict() if 'maintenance_type' in df.columns else {},
        'by_status': df['status'].value_counts().to_dict() if 'status' in df.columns else {},
        'by_provider': df['mro_provider'].value_counts().to_dict() if 'mro_provider' in df.columns else {},
        'total_cost': df['total_cost_usd'].sum() if 'total_cost_usd' in df.columns else None,
        'avg_downtime': df['downtime_days'].mean() if 'downtime_days' in df.columns else None,
    }

    return convert_numpy(summary)


@app.get("/api/mro/scheduled")
async def get_scheduled_maintenance(
    days_ahead: int = Query(30, ge=1, le=365),
    aircraft: Optional[str] = None
):
    """Get scheduled maintenance events."""
    if data_store['mro'] is None:
        raise HTTPException(status_code=400, detail="No MRO data loaded")

    df = data_store['mro']

    if 'scheduled_start_date' in df.columns:
        df['scheduled_start_date'] = pd.to_datetime(df['scheduled_start_date'])
        now = pd.Timestamp.now()
        cutoff = now + pd.Timedelta(days=days_ahead)
        df = df[(df['scheduled_start_date'] >= now) & (df['scheduled_start_date'] <= cutoff)]

    if aircraft:
        df = df[df['aircraft_registration'] == aircraft.upper()]

    df = df.sort_values('scheduled_start_date')

    return df.head(100).to_dict(orient='records')


# ==================== Fare Comparison Endpoints ====================

@app.get("/api/fares/summary")
async def get_fares_summary():
    """Get fare comparison summary."""
    if data_store['fares'] is None:
        raise HTTPException(status_code=400, detail="No fares data loaded")

    df = data_store['fares']

    summary = {
        'total_records': len(df),
        'unique_markets': df['market'].nunique() if 'market' in df.columns else 0,
        'date_range': {
            'min': df['date'].min() if 'date' in df.columns else None,
            'max': df['date'].max() if 'date' in df.columns else None,
        },
        'avg_nk_fare': df['nk_fare'].mean() if 'nk_fare' in df.columns else None,
        'avg_f9_fare': df['f9_fare'].mean() if 'f9_fare' in df.columns else None,
        'nk_lower_pct': (df['nk_fare'] < df['f9_fare']).mean() * 100 if 'nk_fare' in df.columns and 'f9_fare' in df.columns else None,
    }

    return convert_numpy(summary)


@app.get("/api/fares/by-market/{market}")
async def get_fares_by_market(market: str):
    """Get fare data for a specific market."""
    if data_store['fares'] is None:
        raise HTTPException(status_code=400, detail="No fares data loaded")

    df = data_store['fares']
    market_upper = market.upper().replace('-', '_')

    market_df = df[df['market'] == market_upper]

    if len(market_df) == 0:
        raise HTTPException(status_code=404, detail=f"No fare data for market '{market}'")

    return {
        'market': market_upper,
        'records': len(market_df),
        'avg_nk_fare': market_df['nk_fare'].mean() if 'nk_fare' in market_df.columns else None,
        'avg_f9_fare': market_df['f9_fare'].mean() if 'f9_fare' in market_df.columns else None,
        'fares': market_df.sort_values('date').to_dict(orient='records'),
    }


@app.get("/api/fares/competitive")
async def get_competitive_fares(limit: int = Query(50, ge=1, le=200)):
    """Get markets with competitive fare data sorted by NK advantage."""
    if data_store['fares'] is None:
        raise HTTPException(status_code=400, detail="No fares data loaded")

    df = data_store['fares']

    if 'nk_fare' not in df.columns or 'f9_fare' not in df.columns:
        return []

    # Calculate fare advantage per market
    market_stats = df.groupby('market').agg({
        'nk_fare': 'mean',
        'f9_fare': 'mean',
        'date': 'count'
    }).reset_index()

    market_stats['fare_diff'] = market_stats['f9_fare'] - market_stats['nk_fare']
    market_stats['nk_advantage_pct'] = (market_stats['fare_diff'] / market_stats['f9_fare']) * 100

    # Sort by NK advantage (negative means NK is cheaper)
    result = market_stats.sort_values('fare_diff', ascending=False).head(limit)

    return result.to_dict(orient='records')


# ==================== Traffic Data Endpoints ====================

@app.get("/api/traffic/summary")
async def get_traffic_summary():
    """Get T-100 traffic data summary."""
    if data_store['traffic'] is None:
        raise HTTPException(status_code=400, detail="No traffic data loaded")

    df = data_store['traffic']

    summary = {
        'total_records': len(df),
        'total_passengers': df['PASSENGERS'].sum() if 'PASSENGERS' in df.columns else 0,
        'unique_carriers': df['UNIQUE_CARRIER'].nunique() if 'UNIQUE_CARRIER' in df.columns else 0,
        'unique_origins': df['ORIGIN'].nunique() if 'ORIGIN' in df.columns else 0,
        'unique_destinations': df['DEST'].nunique() if 'DEST' in df.columns else 0,
    }

    return convert_numpy(summary)


@app.get("/api/traffic/by-carrier/{carrier}")
async def get_traffic_by_carrier(carrier: str):
    """Get traffic data for a specific carrier."""
    if data_store['traffic'] is None:
        raise HTTPException(status_code=400, detail="No traffic data loaded")

    df = data_store['traffic']
    carrier_upper = carrier.upper()

    carrier_df = df[df['UNIQUE_CARRIER'] == carrier_upper]

    if len(carrier_df) == 0:
        raise HTTPException(status_code=404, detail=f"No traffic data for carrier '{carrier}'")

    # Get top routes by passengers
    top_routes = carrier_df.groupby(['ORIGIN', 'DEST']).agg({
        'PASSENGERS': 'sum',
        'DISTANCE': 'first'
    }).reset_index().sort_values('PASSENGERS', ascending=False).head(20)

    return convert_numpy({
        'carrier': carrier_upper,
        'total_passengers': carrier_df['PASSENGERS'].sum(),
        'unique_routes': len(carrier_df.groupby(['ORIGIN', 'DEST'])),
        'top_routes': top_routes.to_dict(orient='records'),
    })


# ==================== Scenario Planning Endpoints ====================

@app.get("/api/scenarios")
async def get_scenarios():
    """Get available scenarios in the data."""
    if data_store['network'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    df = data_store['network']

    if 'ScenarioLabel' not in df.columns:
        return []

    scenarios = df['ScenarioLabel'].value_counts().to_dict()
    return [{'name': k, 'flights': v} for k, v in scenarios.items()]


@app.get("/api/scenarios/compare")
async def compare_scenarios(scenario1: str, scenario2: str):
    """Compare metrics between two scenarios."""
    if data_store['network'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    df = data_store['network']

    if 'ScenarioLabel' not in df.columns:
        raise HTTPException(status_code=400, detail="No scenario data in network file")

    df1 = df[df['ScenarioLabel'] == scenario1]
    df2 = df[df['ScenarioLabel'] == scenario2]

    if len(df1) == 0:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario1}' not found")
    if len(df2) == 0:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario2}' not found")

    comparison = {
        'scenario1': {
            'name': scenario1,
            'flights': len(df1),
            'total_pax': df1['Constrained Local Pax'].sum() if 'Constrained Local Pax' in df1 else 0,
            'avg_load_factor': df1['Load Factor'].mean() if 'Load Factor' in df1 else None,
            'total_revenue': (df1['Constrained Local Pax'] * df1['Constrained Local Fare']).sum() if 'Constrained Local Fare' in df1 else 0,
        },
        'scenario2': {
            'name': scenario2,
            'flights': len(df2),
            'total_pax': df2['Constrained Local Pax'].sum() if 'Constrained Local Pax' in df2 else 0,
            'avg_load_factor': df2['Load Factor'].mean() if 'Load Factor' in df2 else None,
            'total_revenue': (df2['Constrained Local Pax'] * df2['Constrained Local Fare']).sum() if 'Constrained Local Fare' in df2 else 0,
        },
    }

    # Calculate deltas
    comparison['delta'] = {
        'flights': comparison['scenario2']['flights'] - comparison['scenario1']['flights'],
        'pax': comparison['scenario2']['total_pax'] - comparison['scenario1']['total_pax'],
        'load_factor': (comparison['scenario2']['avg_load_factor'] or 0) - (comparison['scenario1']['avg_load_factor'] or 0),
        'revenue': comparison['scenario2']['total_revenue'] - comparison['scenario1']['total_revenue'],
    }

    return convert_numpy(comparison)


# ==================== Live External Data Endpoints ====================

# Initialize external data service (lazy - created on first use)
_external_service: Optional[ExternalDataService] = None

def get_external_service() -> ExternalDataService:
    """Get or create the external data service."""
    global _external_service
    if _external_service is None:
        _external_service = ExternalDataService()
    return _external_service


@app.get("/api/live/airport/{iata_code}")
async def get_live_airport_info(iata_code: str):
    """Get live airport information from AirLabs."""
    service = get_external_service()
    result = await service.airlabs.get_airport_info(iata_code)
    return result


@app.get("/api/live/airline/{iata_code}")
async def get_live_airline_info(iata_code: str):
    """Get live airline information from AirLabs."""
    service = get_external_service()
    result = await service.airlabs.get_airline_info(iata_code)
    return result


@app.get("/api/live/schedules/{origin}")
async def get_live_schedules(origin: str, destination: Optional[str] = None):
    """Get live flight schedules from AirLabs."""
    service = get_external_service()
    result = await service.airlabs.get_schedules(origin, destination)
    return result


@app.get("/api/live/routes/{origin}")
async def get_live_routes(origin: str):
    """Get all routes from an airport via AirLabs."""
    service = get_external_service()
    result = await service.airlabs.get_routes(origin)
    return result


@app.get("/api/live/weather/{airport}")
async def get_live_weather(airport: str):
    """Get current weather for an airport."""
    service = get_external_service()
    result = await service.weather.get_current_weather(airport)
    return result


@app.get("/api/live/weather/differential/{origin}/{destination}")
async def get_live_weather_differential(origin: str, destination: str):
    """Get temperature differential between two airports."""
    service = get_external_service()
    result = await service.weather.get_weather_differential(origin, destination)
    return result


@app.get("/api/live/fares/{origin}/{destination}")
async def get_live_fares(
    origin: str,
    destination: str,
    departure_date: str = Query(..., description="Date in YYYY-MM-DD format")
):
    """Get competitive fare data from Google Flights via SerpAPI."""
    service = get_external_service()
    result = await service.serp.get_competitive_fares(origin, destination, departure_date)
    return result


@app.get("/api/live/intelligence/{origin}/{destination}")
async def get_live_route_intelligence(
    origin: str,
    destination: str,
    departure_date: Optional[str] = None,
    include_trends: bool = False
):
    """Get comprehensive route intelligence from all external sources."""
    service = get_external_service()
    result = await service.get_route_intelligence(origin, destination, departure_date, include_trends)
    return result


# ==================== Google Events Endpoints ====================

@app.get("/api/live/events/{airport_code}")
async def get_events_for_airport(
    airport_code: str,
    city: str = Query(..., description="City name (e.g., Miami)"),
    state: str = Query(..., description="State name (e.g., Florida)"),
    event_type: str = Query("events", enum=["events", "concerts", "sports"])
):
    """
    Get events for a city/airport location via Google Events API.

    This powers demand signals for route analysis.
    """
    service = get_external_service()
    result = await service.events.get_events_for_city(city, state, event_type)
    return result


@app.get("/api/live/events/search")
async def search_events(
    query: str = Query(..., description="Search query (e.g., 'Taylor Swift Miami')"),
    location: Optional[str] = Query(None, description="Location (e.g., 'Miami, Florida')")
):
    """
    Search for specific events using Google Events API.
    """
    service = get_external_service()
    result = await service.events.get_events(query, location=location)
    return result


@app.get("/api/live/events/high-impact")
async def get_high_impact_events(
    cities: str = Query(..., description="Comma-separated city names (e.g., 'Miami,Orlando,Las Vegas')")
):
    """
    Get high-impact events across multiple cities.

    Useful for network-wide demand forecasting.
    """
    city_list = [c.strip() for c in cities.split(',')]
    if len(city_list) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 cities per request")

    service = get_external_service()
    result = await service.events.get_high_impact_events(city_list)
    return result


# ==================== Google Trends Endpoints ====================

@app.get("/api/trends/destination/{destination}")
async def get_destination_trends(
    destination: str,
    query_type: str = Query("flights", enum=["flights", "vacation", "hotels", "travel"])
):
    """
    Get Google Trends search interest for a destination.

    Args:
        destination: Airport IATA code
        query_type: Type of search query to analyze
    """
    service = get_external_service()
    result = await service.trends.get_destination_interest(destination, query_type=query_type)
    return result


@app.get("/api/trends/route/{origin}/{destination}")
async def get_route_trends(origin: str, destination: str):
    """
    Get Google Trends demand signal for a specific route.

    Returns search interest analysis that indicates demand strength.
    """
    service = get_external_service()
    result = await service.trends.get_route_demand_signal(origin, destination)
    return result


@app.get("/api/trends/compare")
async def compare_destination_trends(
    destinations: str = Query(..., description="Comma-separated airport codes (e.g., MIA,CUN,SJU)"),
    query_type: str = Query("flights", enum=["flights", "vacation", "hotels", "travel"])
):
    """
    Compare search interest across multiple destinations.

    Args:
        destinations: Comma-separated airport codes
        query_type: Type of search query to analyze
    """
    dest_list = [d.strip().upper() for d in destinations.split(',')]
    if len(dest_list) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 destinations")
    if len(dest_list) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 destinations")

    service = get_external_service()
    result = await service.trends.compare_destinations(dest_list, query_type=query_type)
    return result


@app.get("/api/trends/query")
async def get_trends_for_query(
    query: str = Query(..., description="Search query to analyze"),
    geo: str = Query("US", description="Geographic region (US, US-NY, etc.)"),
    time_range: str = Query("today 3-m", description="Time range (today 3-m, today 12-m, etc.)")
):
    """
    Get Google Trends interest over time for any search query.

    This is the raw trends API - use /api/trends/route for demand signals.
    """
    service = get_external_service()
    result = await service.trends.get_interest_over_time(query, geo=geo, time_range=time_range)
    return result


# ==================== Network Intelligence Endpoints ====================

@app.get("/api/intelligence/position")
async def get_network_position():
    """Get NK's overall network competitive position."""
    if data_store['network_intelligence'] is None:
        raise HTTPException(status_code=400, detail="Network intelligence not initialized")

    position = data_store['network_intelligence'].get_network_position()
    return {
        'total_markets': position.total_markets,
        'overlap_markets': position.overlap_markets,
        'nk_only_markets': position.nk_only_markets,
        'f9_only_markets': position.f9_only_markets,
        'total_nk_passengers': position.total_nk_passengers,
        'total_f9_passengers': position.total_f9_passengers,
        'avg_nk_market_share': round(position.avg_nk_market_share * 100, 1),
        'fare_advantage_markets': position.fare_advantage_markets,
        'fare_disadvantage_markets': position.fare_disadvantage_markets
    }


@app.get("/api/intelligence/markets")
async def get_market_intelligence(limit: int = Query(50, ge=1, le=200)):
    """Get competitive intelligence for all markets."""
    if data_store['network_intelligence'] is None:
        raise HTTPException(status_code=400, detail="Network intelligence not initialized")

    markets = data_store['network_intelligence'].get_market_competitive_position()

    # Convert to list and sort by total passengers
    market_list = []
    for key, mi in markets.items():
        market_list.append({
            'market_key': mi.market_key,
            'origin': mi.origin,
            'destination': mi.destination,
            'total_passengers': mi.nk_passengers + mi.f9_passengers,
            'nk_passengers': mi.nk_passengers,
            'f9_passengers': mi.f9_passengers,
            'nk_market_share': round(mi.nk_market_share * 100, 1),
            'nk_avg_fare': round(mi.nk_avg_fare, 2) if mi.nk_avg_fare else None,
            'f9_avg_fare': round(mi.f9_avg_fare, 2) if mi.f9_avg_fare else None,
            'fare_advantage': round(mi.fare_advantage, 1),
            'competitive_intensity': mi.competitive_intensity,
            'distance': mi.distance
        })

    market_list.sort(key=lambda x: x['total_passengers'], reverse=True)
    return market_list[:limit]


@app.get("/api/intelligence/market/{market_key}")
async def get_single_market_intelligence(market_key: str):
    """Get detailed intelligence for a specific market."""
    if data_store['insight_engine'] is None:
        raise HTTPException(status_code=400, detail="Insight engine not initialized")

    # Parse market key to get origin/destination
    parts = market_key.split('_')
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid market key format. Use ORIGIN_DEST")

    result = data_store['insight_engine'].generate_route_insights(parts[0], parts[1])
    return convert_numpy(result)


@app.get("/api/intelligence/opportunities")
async def get_market_opportunities():
    """Get market growth opportunities."""
    if data_store['network_intelligence'] is None:
        raise HTTPException(status_code=400, detail="Network intelligence not initialized")

    opportunities = data_store['network_intelligence'].get_market_opportunities()
    return opportunities


@app.get("/api/intelligence/fares")
async def get_fare_intelligence(market: Optional[str] = None):
    """Get comprehensive fare analysis."""
    if data_store['network_intelligence'] is None:
        raise HTTPException(status_code=400, detail="Network intelligence not initialized")

    result = data_store['network_intelligence'].get_fare_analysis(market)
    return convert_numpy(result)


@app.get("/api/intelligence/rankings")
async def get_intelligent_rankings(limit: int = Query(50, ge=1, le=200)):
    """Get route rankings with competitive context."""
    if data_store['network_intelligence'] is None:
        raise HTTPException(status_code=400, detail="Network intelligence not initialized")

    rankings = data_store['network_intelligence'].get_route_ranking_intelligence(limit)
    return rankings


@app.get("/api/intelligence/insights")
async def get_executive_insights():
    """Get top executive-level actionable insights."""
    if data_store['insight_engine'] is None:
        raise HTTPException(status_code=400, detail="Insight engine not initialized")

    insights = data_store['insight_engine'].generate_executive_insights()
    return insights


# ==================== Cross-Domain Intelligence Endpoints ====================

@app.get("/api/intelligence/fleet-alignment")
async def get_fleet_alignment():
    """Analyze fleet alignment with network needs."""
    if data_store['cross_domain'] is None:
        raise HTTPException(status_code=400, detail="Cross-domain intelligence not initialized")

    result = data_store['cross_domain'].get_fleet_network_alignment()
    return convert_numpy(result)


@app.get("/api/intelligence/crew-alignment")
async def get_crew_alignment():
    """Analyze crew alignment with network needs."""
    if data_store['cross_domain'] is None:
        raise HTTPException(status_code=400, detail="Cross-domain intelligence not initialized")

    result = data_store['cross_domain'].get_crew_network_alignment()
    return convert_numpy(result)


@app.get("/api/intelligence/mro-impact")
async def get_mro_network_impact():
    """Analyze MRO impact on network operations."""
    if data_store['cross_domain'] is None:
        raise HTTPException(status_code=400, detail="Cross-domain intelligence not initialized")

    result = data_store['cross_domain'].get_mro_network_impact()
    return convert_numpy(result)


@app.get("/api/intelligence/equipment-recommendations")
async def get_equipment_recommendations():
    """Get route-level equipment recommendations."""
    if data_store['cross_domain'] is None:
        raise HTTPException(status_code=400, detail="Cross-domain intelligence not initialized")

    result = data_store['cross_domain'].get_route_equipment_recommendations()
    return result


# ==================== Booking Curve Endpoints ====================

@app.get("/api/booking-curve/{origin}/{destination}")
async def get_booking_curve(origin: str, destination: str):
    """Get booking curve for a route based on segment decomposition."""
    if data_store['decomposer'] is None:
        raise HTTPException(status_code=400, detail="No network data loaded")

    if data_store['booking_curve_analyzer'] is None:
        raise HTTPException(status_code=400, detail="Booking curve analyzer not initialized")

    # Get segment mix for the route
    decomposition = data_store['decomposer'].decompose_route(origin.upper(), destination.upper())

    if 'error' in decomposition:
        raise HTTPException(status_code=404, detail=decomposition['error'])

    segment_mix = decomposition.get('segment_mix', {})

    # Generate booking curve
    curve = data_store['booking_curve_analyzer'].generate_booking_curve(segment_mix)
    pricing_windows = data_store['booking_curve_analyzer'].get_optimal_pricing_windows(segment_mix)

    return {
        'route': f"{origin.upper()}-{destination.upper()}",
        'segment_mix': segment_mix,
        'booking_curve': curve,
        'pricing_recommendations': pricing_windows
    }


# ==================== Route P&L Calculator ====================

@app.get("/api/route-pnl/{origin}/{destination}")
async def get_route_pnl(origin: str, destination: str):
    """Calculate estimated route P&L with cross-domain data."""
    if data_store['network_intelligence'] is None:
        raise HTTPException(status_code=400, detail="Network intelligence not initialized")

    market_key = '_'.join(sorted([origin.upper(), destination.upper()]))
    markets = data_store['network_intelligence'].get_market_competitive_position()
    mi = markets.get(market_key)

    if not mi:
        raise HTTPException(status_code=404, detail=f"No data for market {market_key}")

    # Get segment decomposition if available
    segment_mix = {}
    if data_store['decomposer']:
        decomp = data_store['decomposer'].decompose_route(origin.upper(), destination.upper())
        if 'segment_mix' in decomp:
            segment_mix = decomp['segment_mix']

    # Calculate estimated P&L components
    avg_fare = mi.nk_avg_fare if mi.nk_avg_fare > 0 else 100  # Default if no fare data
    annual_pax = mi.nk_passengers

    # Estimated costs per passenger-mile (industry averages for ULCCs)
    casm = 0.08  # 8 cents per ASM
    rasm = avg_fare / mi.distance if mi.distance > 0 else 0.12

    estimated_revenue = annual_pax * avg_fare
    estimated_cost = annual_pax * mi.distance * casm

    pnl = {
        'route': f"{origin.upper()}-{destination.upper()}",
        'market_key': market_key,
        'distance_miles': mi.distance,
        'annual_passengers': annual_pax,
        'avg_fare': round(avg_fare, 2),
        'segment_mix': segment_mix,
        'estimated_annual_revenue': round(estimated_revenue),
        'estimated_annual_cost': round(estimated_cost),
        'estimated_profit': round(estimated_revenue - estimated_cost),
        'profit_margin_pct': round((estimated_revenue - estimated_cost) / estimated_revenue * 100, 1) if estimated_revenue > 0 else 0,
        'rasm_cents': round(rasm * 100, 2),
        'casm_cents': round(casm * 100, 2),
        'competitive_context': {
            'f9_passengers': mi.f9_passengers,
            'market_share': round(mi.nk_market_share * 100, 1),
            'fare_vs_f9': round(mi.fare_advantage, 1)
        }
    }

    return pnl


# Run with: uvicorn main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
