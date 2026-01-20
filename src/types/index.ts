// Core types for SkyWeave

export type SegmentType = 'vfr' | 'leisure' | 'cruise' | 'business' | 'other';

export interface SegmentMix {
  vfr: number;
  leisure: number;
  cruise: number;
  business: number;
  other: number;
}

export interface SegmentMetrics {
  share: number;
  est_pax: number;
  est_unconstrained_pax: number;
  est_revenue: number;
  price_sensitivity: 'very_high' | 'high' | 'medium' | 'low';
  date_flexibility: 'zero' | 'low' | 'medium' | 'high';
  primary_drivers: string[];
}

export interface RouteDecomposition {
  route: string;
  origin: string;
  destination: string;
  origin_categories: string[];
  destination_categories: string[];
  segment_mix: SegmentMix;
  segment_metrics: Record<SegmentType, SegmentMetrics>;
  total_records: number;
  dow_distribution: Record<number, number>;
  avg_load_factor: number | null;
  avg_spill_rate: number | null;
  avg_fare: number | null;
}

export interface Route {
  origin: string;
  destination: string;
  route_key: string;
  total_pax: number;
  avg_load_factor: number | null;
  avg_spill_rate: number | null;
  avg_fare: number | null;
}

export interface HubSummary {
  [hub: string]: {
    total_flights: number;
    unique_routes: number;
    total_pax: number;
    avg_load_factor: number | null;
  };
}

export interface NetworkStats {
  total_records: number;
  unique_airports: number;
  unique_routes: number;
  total_pax: number;
  avg_load_factor: number | null;
  hub_distribution: Record<string, number>;
}

export interface FleetSummary {
  total_aircraft: number;
  by_type: Record<string, number>;
  by_base: Record<string, number>;
  by_status: Record<string, number>;
  avg_age: number | null;
  total_seats: number | null;
}

export interface CrewSummary {
  total_crew: number;
  by_type: Record<string, number>;
  by_base: Record<string, number>;
  by_status: Record<string, number>;
  avg_total_hours: number | null;
  avg_30_day_hours: number | null;
}

export interface MROSummary {
  total_work_orders: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_provider: Record<string, number>;
  total_cost: number | null;
  avg_downtime: number | null;
}

export interface CruiseSignal {
  signal_strength: number;
  is_cruise_port: boolean;
  port_name?: string;
  ships_per_week?: number;
  primary_departure_day?: number;
  days_before_departure?: number;
  explanation?: string;
}

export interface WeatherSignal {
  signal_strength: number;
  has_data: boolean;
  origin_temp?: number;
  destination_temp?: number;
  temp_differential?: number;
  explanation?: string;
  segment?: string;
}

export interface ExternalSignals {
  route: string;
  signals: {
    cruise?: CruiseSignal;
    weather?: WeatherSignal;
    seasonality?: {
      signal_strength: number;
      drivers: Array<{
        type: string;
        name: string;
        strength: number;
        segment: string;
        explanation: string;
      }>;
    };
  };
  signal_count: number;
  primary_signal: any;
}

export interface Scenario {
  name: string;
  flights: number;
}

export interface ScenarioComparison {
  scenario1: {
    name: string;
    flights: number;
    total_pax: number;
    avg_load_factor: number | null;
    total_revenue: number;
  };
  scenario2: {
    name: string;
    flights: number;
    total_pax: number;
    avg_load_factor: number | null;
    total_revenue: number;
  };
  delta: {
    flights: number;
    pax: number;
    load_factor: number;
    revenue: number;
  };
}

export interface DataStatus {
  network_loaded: boolean;
  network_rows: number;
  fleet_loaded: boolean;
  fleet_rows: number;
  crew_loaded: boolean;
  crew_rows: number;
  mro_loaded: boolean;
  mro_rows: number;
}

// Segment color mapping
export const SEGMENT_COLORS: Record<SegmentType, string> = {
  vfr: '#3b82f6',
  leisure: '#22c55e',
  cruise: '#f97316',
  business: '#6b7280',
  other: '#8b5cf6',
};

export const SEGMENT_LABELS: Record<SegmentType, string> = {
  vfr: 'VFR',
  leisure: 'Leisure',
  cruise: 'Cruise',
  business: 'Business',
  other: 'Other',
};
