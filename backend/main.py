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

# Import optimization engines
try:
    from rasm_optimizer import (
        quick_rasm_analysis,
        optimize_network,
        calculate_stage_length_casm,
        AIRCRAFT_SPECS,
        Route,
        Aircraft,
        CrewBase
    )
    from ai_optimizer import (
        AIOptimizer,
        ai_optimize_route,
        get_ai_score,
        ScenarioSimulator
    )
    OPTIMIZER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Optimization modules not available: {e}")
    OPTIMIZER_AVAILABLE = False


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


# ==================== RASM Optimization Engine ====================

class RouteOptimizationRequest(BaseModel):
    """Request for route optimization."""
    origin: str
    destination: str
    distance_nm: float = 500
    current_equipment: str = "A320neo"
    current_frequency: int = 2
    current_fare: float = 120
    daily_demand: float = 250
    segment_mix: Optional[Dict[str, float]] = None


class NetworkOptimizationRequest(BaseModel):
    """Request for network optimization."""
    objective: str = "profit"  # 'rasm', 'profit', 'revenue'


@app.get("/api/optimizer/status")
async def get_optimizer_status():
    """Check if optimization engine is available."""
    return {
        "optimizer_available": OPTIMIZER_AVAILABLE,
        "features": {
            "mathematical_optimization": OPTIMIZER_AVAILABLE,
            "ai_scoring": OPTIMIZER_AVAILABLE,
            "demand_forecasting": OPTIMIZER_AVAILABLE,
            "scenario_simulation": OPTIMIZER_AVAILABLE
        },
        "solver": "PuLP CBC (open source)" if OPTIMIZER_AVAILABLE else None
    }


@app.post("/api/optimizer/route")
async def optimize_route(request: RouteOptimizationRequest):
    """
    AI-enhanced route optimization.

    Returns equipment swap options, demand forecast, price elasticity,
    and AI recommendations.
    """
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    try:
        result = ai_optimize_route(
            origin=request.origin.upper(),
            destination=request.destination.upper(),
            distance_nm=request.distance_nm,
            current_equipment=request.current_equipment,
            current_frequency=request.current_frequency,
            current_fare=request.current_fare,
            daily_demand=request.daily_demand,
            segment_mix=request.segment_mix
        )
        return sanitize_for_json(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimizer/route/{origin}/{destination}")
async def get_route_optimization(
    origin: str,
    destination: str,
    equipment: str = "A320neo",
    frequency: int = 2,
    use_live_fares: bool = False,
    departure_date: Optional[str] = None
):
    """
    Quick route RASM analysis.

    Uses market data if available, enriched with live fares when requested.
    """
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    # Try to get market data
    distance_nm = 500  # default
    daily_demand = 200
    avg_fare = 120
    live_fare_data = None

    if data_store['network_intelligence']:
        market_key = '_'.join(sorted([origin.upper(), destination.upper()]))
        markets = data_store['network_intelligence'].get_market_competitive_position()
        mi = markets.get(market_key)
        if mi:
            distance_nm = mi.distance * 0.868976  # Convert statute to nautical miles
            daily_demand = mi.nk_passengers / 365 if mi.nk_passengers > 0 else 200
            avg_fare = mi.nk_avg_fare if mi.nk_avg_fare > 0 else 120

    # Fetch live fares from SerpAPI if requested
    if use_live_fares and departure_date:
        try:
            service = get_external_service()
            live_result = await service.serp.get_competitive_fares(
                origin.upper(), destination.upper(), departure_date
            )
            if live_result.get('success') and live_result.get('min_fare'):
                live_fare_data = live_result
                # Use live fare as current market fare
                avg_fare = live_result['min_fare']
        except Exception as e:
            live_fare_data = {'error': str(e)}

    try:
        result = quick_rasm_analysis(
            origin=origin.upper(),
            destination=destination.upper(),
            distance_nm=distance_nm,
            daily_demand=daily_demand,
            avg_fare=avg_fare,
            current_equipment=equipment,
            current_frequency=frequency
        )

        # Enrich result with live fare data
        if live_fare_data:
            result['live_fares'] = live_fare_data

        # Add data source transparency
        result['data_sources'] = {
            'fare_source': 'live_serpapi' if (use_live_fares and live_fare_data and live_fare_data.get('success')) else 'network_intelligence',
            'demand_source': 'network_intelligence' if data_store['network_intelligence'] else 'default_estimate',
            'distance_source': 'network_intelligence' if data_store['network_intelligence'] else 'default_estimate'
        }

        return sanitize_for_json(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimizer/casm/{distance_nm}")
async def get_stage_length_casm(distance_nm: float):
    """
    Calculate stage-length adjusted CASM.

    Shorter flights have higher unit costs due to fixed costs
    spread over fewer ASMs.
    """
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    casm = calculate_stage_length_casm(distance_nm)
    base_casm = 8.0

    return {
        "distance_nm": distance_nm,
        "casm_cents": round(casm, 2),
        "base_casm_cents": base_casm,
        "stage_length_premium_pct": round((casm / base_casm - 1) * 100, 1),
        "explanation": f"At {distance_nm}nm, CASM is {round(casm, 2)}¢ vs base of {base_casm}¢"
    }


@app.get("/api/optimizer/equipment")
async def get_equipment_specs():
    """Get aircraft specifications for optimization."""
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    return AIRCRAFT_SPECS


@app.get("/api/optimizer/ai-score/{origin}/{destination}")
async def get_ai_route_score(
    origin: str,
    destination: str,
    daily_demand: float = 200,
    avg_fare: float = 120,
    competitors: int = 2
):
    """
    Get AI-powered route score.

    Scores route on RASM potential, strategic fit, risk, and growth.
    """
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    # Try to get real market data
    distance_nm = 500
    if data_store['network_intelligence']:
        market_key = '_'.join(sorted([origin.upper(), destination.upper()]))
        markets = data_store['network_intelligence'].get_market_competitive_position()
        mi = markets.get(market_key)
        if mi:
            distance_nm = mi.distance * 0.868976
            if mi.nk_passengers > 0:
                daily_demand = mi.nk_passengers / 365
            if mi.nk_avg_fare > 0:
                avg_fare = mi.nk_avg_fare

    try:
        result = get_ai_score(
            origin=origin.upper(),
            destination=destination.upper(),
            distance_nm=distance_nm,
            daily_demand=daily_demand,
            avg_fare=avg_fare,
            competitors=competitors
        )
        return sanitize_for_json(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimizer/network")
async def run_network_optimization(request: NetworkOptimizationRequest):
    """
    Full network optimization with AI enhancements.

    Optimizes fleet assignment and frequency across all routes.
    """
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    # Build routes from available data
    routes = []
    if data_store['network_intelligence']:
        markets = data_store['network_intelligence'].get_market_competitive_position()
        for market_key, mi in markets.items():
            if mi.nk_passengers > 0:
                airports = market_key.split('_')
                if len(airports) == 2:
                    routes.append({
                        'origin': airports[0],
                        'destination': airports[1],
                        'distance_nm': mi.distance * 0.868976,
                        'daily_demand': mi.nk_passengers / 365,
                        'avg_fare': mi.nk_avg_fare if mi.nk_avg_fare > 0 else 100
                    })

    if not routes:
        # Use sample routes for demo
        routes = [
            {'origin': 'DTW', 'destination': 'MCO', 'distance_nm': 960, 'daily_demand': 350, 'avg_fare': 120},
            {'origin': 'DTW', 'destination': 'FLL', 'distance_nm': 1020, 'daily_demand': 280, 'avg_fare': 130},
            {'origin': 'DTW', 'destination': 'LAS', 'distance_nm': 1750, 'daily_demand': 200, 'avg_fare': 150},
            {'origin': 'EWR', 'destination': 'MCO', 'distance_nm': 850, 'daily_demand': 400, 'avg_fare': 110},
            {'origin': 'EWR', 'destination': 'FLL', 'distance_nm': 950, 'daily_demand': 320, 'avg_fare': 115},
        ]

    # Build fleet from available data, considering MRO schedule
    fleet = []
    # Get aircraft in maintenance from MRO data
    aircraft_in_maintenance = set()
    if data_store['mro'] is not None:
        mro_df = data_store['mro']
        if 'scheduled_start_date' in mro_df.columns and 'scheduled_end_date' in mro_df.columns:
            mro_df['start'] = pd.to_datetime(mro_df['scheduled_start_date'], errors='coerce')
            mro_df['end'] = pd.to_datetime(mro_df['scheduled_end_date'], errors='coerce')
            now = pd.Timestamp.now()
            # Find aircraft currently in maintenance
            in_mx = mro_df[(mro_df['start'] <= now) & (mro_df['end'] >= now)]
            if 'aircraft_registration' in in_mx.columns:
                aircraft_in_maintenance = set(in_mx['aircraft_registration'].dropna().str.upper())

    if data_store['fleet'] is not None:
        for _, row in data_store['fleet'].iterrows():
            reg = str(row.get('aircraft_registration', row.get('Aircraft Registration', f'N{len(fleet)+1:03d}NK')))
            # Check both fleet status and MRO schedule
            status = row.get('current_status', row.get('Current Status', 'Active'))
            is_active = str(status).upper() in ['ACTIVE', 'FLYING', 'AVAILABLE']
            not_in_mx = reg.upper() not in aircraft_in_maintenance
            fleet.append({
                'registration': reg,
                'aircraft_type': str(row.get('aircraft_type', row.get('Aircraft Type', 'A320neo'))),
                'home_base': str(row.get('home_base', row.get('Home Base', 'DTW'))),
                'available': is_active and not_in_mx
            })

    if not fleet:
        # Use sample fleet for demo
        fleet = [
            {'registration': 'N901NK', 'aircraft_type': 'A320neo', 'home_base': 'DTW', 'available': True},
            {'registration': 'N902NK', 'aircraft_type': 'A320neo', 'home_base': 'DTW', 'available': True},
            {'registration': 'N903NK', 'aircraft_type': 'A321neo', 'home_base': 'DTW', 'available': True},
            {'registration': 'N904NK', 'aircraft_type': 'A320neo', 'home_base': 'EWR', 'available': True},
            {'registration': 'N905NK', 'aircraft_type': 'A319', 'home_base': 'EWR', 'available': True},
        ]

    # Build crew bases from actual crew data
    crew = []
    if data_store['crew'] is not None:
        crew_df = data_store['crew']
        if 'home_base' in crew_df.columns and 'crew_type' in crew_df.columns:
            # Aggregate crew by base and type
            crew_counts = crew_df.groupby(['home_base', 'crew_type']).size().unstack(fill_value=0)
            for base in crew_counts.index:
                pilots = int(crew_counts.loc[base].get('PILOT', crew_counts.loc[base].get('pilot', 0)))
                fas = int(crew_counts.loc[base].get('FA', crew_counts.loc[base].get('fa', 0)))
                if pilots > 0 or fas > 0:
                    crew.append({
                        'base': str(base),
                        'pilots': pilots,
                        'fas': fas
                    })

    if not crew:
        # Fallback to sample crew for demo only if no real data
        crew = [
            {'base': 'DTW', 'pilots': 80, 'fas': 200},
            {'base': 'MCO', 'pilots': 60, 'fas': 150},
            {'base': 'FLL', 'pilots': 50, 'fas': 120},
            {'base': 'LAS', 'pilots': 40, 'fas': 100},
            {'base': 'EWR', 'pilots': 60, 'fas': 140},
        ]

    try:
        ai_optimizer = AIOptimizer()
        result = ai_optimizer.optimize_network(
            routes=routes,
            fleet=fleet,
            crew=crew,
            objective=request.objective
        )

        # Add data source audit trail
        result['data_sources_used'] = {
            'routes': {
                'source': 'network_intelligence' if data_store['network_intelligence'] and routes else 'sample_demo_data',
                'count': len(routes)
            },
            'fleet': {
                'source': 'fleet_csv' if data_store['fleet'] is not None else 'sample_demo_data',
                'count': len(fleet),
                'available_aircraft': sum(1 for f in fleet if f.get('available', True)),
                'mro_excluded': len(aircraft_in_maintenance) if 'aircraft_in_maintenance' in dir() else 0
            },
            'crew': {
                'source': 'crew_csv' if data_store['crew'] is not None else 'sample_demo_data',
                'bases': len(crew),
                'total_pilots': sum(c.get('pilots', 0) for c in crew),
                'total_fas': sum(c.get('fas', 0) for c in crew)
            },
            'mro_integration': data_store['mro'] is not None
        }

        return sanitize_for_json(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimizer/scenario/equipment-swap")
async def simulate_equipment_swap(
    origin: str,
    destination: str,
    from_equipment: str = "A320neo",
    to_equipment: str = "A321neo",
    frequency_change: int = 0
):
    """
    Simulate equipment swap scenario.

    Returns before/after comparison with RASM impact.
    """
    if not OPTIMIZER_AVAILABLE:
        raise HTTPException(status_code=503, detail="Optimization engine not available")

    # Get route data
    distance_nm = 500
    daily_demand = 200
    avg_fare = 120

    if data_store['network_intelligence']:
        market_key = '_'.join(sorted([origin.upper(), destination.upper()]))
        markets = data_store['network_intelligence'].get_market_competitive_position()
        mi = markets.get(market_key)
        if mi:
            distance_nm = mi.distance * 0.868976
            daily_demand = mi.nk_passengers / 365 if mi.nk_passengers > 0 else 200
            avg_fare = mi.nk_avg_fare if mi.nk_avg_fare > 0 else 120

    try:
        route = Route(
            origin=origin.upper(),
            destination=destination.upper(),
            distance_nm=distance_nm,
            daily_demand=daily_demand,
            avg_fare=avg_fare
        )

        simulator = ScenarioSimulator()
        result = simulator.simulate_equipment_change(
            route=route,
            from_equipment=from_equipment,
            to_equipment=to_equipment,
            frequency_change=frequency_change
        )
        return sanitize_for_json(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Data Audit Endpoint ====================

@app.get("/api/optimizer/data-audit")
async def get_optimizer_data_audit():
    """
    Comprehensive audit of all data sources feeding the optimizer.

    Microsoft-style debug: Shows exactly what data is connected.
    """
    audit = {
        'timestamp': datetime.now().isoformat(),
        'optimizer_available': OPTIMIZER_AVAILABLE,
        'data_sources': {},
        'connections': {},
        'gaps': [],
        'recommendations': []
    }

    # 1. Fleet Data Audit
    if data_store['fleet'] is not None:
        fleet_df = data_store['fleet']
        audit['data_sources']['fleet'] = {
            'status': 'CONNECTED',
            'rows': len(fleet_df),
            'columns': list(fleet_df.columns),
            'by_type': fleet_df['aircraft_type'].value_counts().to_dict() if 'aircraft_type' in fleet_df.columns else {},
            'by_base': fleet_df['home_base'].value_counts().to_dict() if 'home_base' in fleet_df.columns else {},
            'optimizer_uses': True
        }
    else:
        audit['data_sources']['fleet'] = {'status': 'NOT_LOADED', 'optimizer_uses': False}
        audit['gaps'].append('Fleet data not loaded - using demo data')

    # 2. Crew Data Audit
    if data_store['crew'] is not None:
        crew_df = data_store['crew']
        audit['data_sources']['crew'] = {
            'status': 'CONNECTED',
            'rows': len(crew_df),
            'columns': list(crew_df.columns),
            'by_type': crew_df['crew_type'].value_counts().to_dict() if 'crew_type' in crew_df.columns else {},
            'by_base': crew_df['home_base'].value_counts().to_dict() if 'home_base' in crew_df.columns else {},
            'optimizer_uses': True
        }
    else:
        audit['data_sources']['crew'] = {'status': 'NOT_LOADED', 'optimizer_uses': False}
        audit['gaps'].append('Crew data not loaded - using demo data')

    # 3. MRO Data Audit
    if data_store['mro'] is not None:
        mro_df = data_store['mro']
        # Check for currently in-maintenance aircraft
        in_mx_count = 0
        if 'scheduled_start_date' in mro_df.columns and 'scheduled_end_date' in mro_df.columns:
            mro_df_check = mro_df.copy()
            mro_df_check['start'] = pd.to_datetime(mro_df_check['scheduled_start_date'], errors='coerce')
            mro_df_check['end'] = pd.to_datetime(mro_df_check['scheduled_end_date'], errors='coerce')
            now = pd.Timestamp.now()
            in_mx_count = len(mro_df_check[(mro_df_check['start'] <= now) & (mro_df_check['end'] >= now)])

        audit['data_sources']['mro'] = {
            'status': 'CONNECTED',
            'rows': len(mro_df),
            'columns': list(mro_df.columns),
            'by_type': mro_df['maintenance_type'].value_counts().to_dict() if 'maintenance_type' in mro_df.columns else {},
            'aircraft_currently_in_mx': in_mx_count,
            'optimizer_uses': True,
            'integration': 'Reduces available fleet count'
        }
    else:
        audit['data_sources']['mro'] = {'status': 'NOT_LOADED', 'optimizer_uses': False}
        audit['gaps'].append('MRO data not loaded - all aircraft treated as available')

    # 4. Network Intelligence Audit
    if data_store['network_intelligence'] is not None:
        ni = data_store['network_intelligence']
        markets = ni.get_market_competitive_position()
        audit['data_sources']['network_intelligence'] = {
            'status': 'CONNECTED',
            'markets_loaded': len(markets),
            'data_files': {
                't100_loaded': ni.t100_df is not None,
                'db1b_loaded': ni.db1b_df is not None,
                'nk_routes_loaded': ni.nk_routes_df is not None,
                'f9_routes_loaded': ni.f9_routes_df is not None,
                'scraped_fares_loaded': ni.scraped_fares_df is not None
            },
            'optimizer_uses': True,
            'provides': ['distances', 'demand_estimates', 'historical_fares', 'competitor_data']
        }
    else:
        audit['data_sources']['network_intelligence'] = {'status': 'NOT_LOADED', 'optimizer_uses': False}
        audit['gaps'].append('Network intelligence not loaded - using default estimates')

    # 5. Live Data Services Audit
    try:
        service = get_external_service()
        audit['data_sources']['live_services'] = {
            'serpapi_fares': {
                'status': 'AVAILABLE' if service.serp.api_key else 'NO_API_KEY',
                'optimizer_uses': True,
                'how_to_use': 'Add ?use_live_fares=true&departure_date=YYYY-MM-DD to /api/optimizer/route/{o}/{d}'
            },
            'airlabs_schedules': {
                'status': 'AVAILABLE' if service.airlabs.api_key else 'NO_API_KEY',
                'optimizer_uses': False,
                'available_at': '/api/live/schedules/{origin}'
            },
            'google_events': {
                'status': 'AVAILABLE' if service.events.api_key else 'NO_API_KEY',
                'optimizer_uses': False,
                'available_at': '/api/live/events/{airport_code}'
            },
            'google_trends': {
                'status': 'AVAILABLE' if service.trends.api_key else 'NO_API_KEY',
                'optimizer_uses': False,
                'available_at': '/api/trends/route/{origin}/{destination}'
            },
            'weather': {
                'status': 'AVAILABLE' if service.weather.api_key else 'NO_API_KEY',
                'optimizer_uses': False,
                'available_at': '/api/live/weather/{airport}'
            }
        }
    except Exception as e:
        audit['data_sources']['live_services'] = {'status': 'ERROR', 'error': str(e)}

    # 6. Cross-Domain Intelligence Audit
    if data_store['cross_domain'] is not None:
        cd = data_store['cross_domain']
        audit['data_sources']['cross_domain_intelligence'] = {
            'status': 'CONNECTED',
            'fleet_linked': cd.fleet_df is not None,
            'crew_linked': cd.crew_df is not None,
            'mro_linked': cd.mro_df is not None,
            'provides': ['fleet_alignment', 'crew_alignment', 'mro_impact', 'equipment_recommendations']
        }
    else:
        audit['data_sources']['cross_domain_intelligence'] = {'status': 'NOT_INITIALIZED'}

    # Generate recommendations
    if not audit['gaps']:
        audit['recommendations'].append('All primary data sources connected - optimizer fully operational')
    else:
        audit['recommendations'].append(f'Upload missing data files to fully enable optimization: {audit["gaps"]}')

    live_svcs = audit['data_sources'].get('live_services', {})
    if live_svcs.get('serpapi_fares', {}).get('status') == 'NO_API_KEY':
        audit['recommendations'].append('Add SERP_API_KEY to .env for real-time Google Flights fare integration')
    if live_svcs.get('google_events', {}).get('status') == 'NO_API_KEY':
        audit['recommendations'].append('Add SEARCHAPI_KEY to .env for event-driven demand signals')

    return sanitize_for_json(audit)


# Run with: uvicorn main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
