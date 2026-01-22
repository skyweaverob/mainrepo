// API client for SkyWeave backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-9693.up.railway.app';

// Log the API base URL in development
if (typeof window !== 'undefined') {
  console.log('[SkyWeave] API Base URL:', API_BASE);
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// Data Status
export async function getStatus() {
  return fetchAPI<{
    network_loaded: boolean;
    network_rows: number;
    fleet_loaded: boolean;
    fleet_rows: number;
    crew_loaded: boolean;
    crew_rows: number;
    mro_loaded: boolean;
    mro_rows: number;
  }>('/api/status');
}

// Network endpoints
export async function getNetworkStats() {
  return fetchAPI<{
    total_records: number;
    unique_airports: number;
    unique_routes: number;
    total_pax: number;
    avg_load_factor: number | null;
    hub_distribution: Record<string, number>;
  }>('/api/network/stats');
}

export async function getHubSummary() {
  return fetchAPI<Record<string, {
    total_flights: number;
    unique_routes: number;
    total_pax: number;
    avg_load_factor: number | null;
  }>>('/api/network/hubs');
}

export async function getRoutes(params?: { limit?: number; hub?: string; scenario?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.hub) searchParams.set('hub', params.hub);
  if (params?.scenario) searchParams.set('scenario', params.scenario);

  const query = searchParams.toString();
  return fetchAPI<Array<{
    origin: string;
    destination: string;
    route_key: string;
    total_pax: number;
    avg_load_factor: number | null;
    avg_spill_rate: number | null;
    avg_fare: number | null;
  }>>(`/api/network/routes${query ? `?${query}` : ''}`);
}

export async function getRouteRankings(metric: string = 'pax', limit: number = 20) {
  return fetchAPI<Array<{
    route: string;
    origin: string;
    destination: string;
    value: number;
    metric: string;
  }>>(`/api/network/rankings?metric=${metric}&limit=${limit}`);
}

export async function getDirectionalAsymmetry(limit: number = 20) {
  return fetchAPI<Array<{
    market_pair: string;
    asymmetry_ratio: number;
    stronger_direction: string;
  }>>(`/api/network/asymmetry?limit=${limit}`);
}

// Demand Decomposition endpoints
export async function getRouteDecomposition(origin: string, destination: string) {
  return fetchAPI<{
    route: string;
    origin: string;
    destination: string;
    origin_categories: string[];
    destination_categories: string[];
    segment_mix: Record<string, number>;
    segment_metrics: Record<string, {
      share: number;
      est_pax: number;
      est_unconstrained_pax: number;
      est_revenue: number;
      price_sensitivity: string;
      date_flexibility: string;
      primary_drivers: string[];
    }>;
    total_records: number;
    dow_distribution: Record<number, number>;
    avg_load_factor: number | null;
    avg_spill_rate: number | null;
    avg_fare: number | null;
  }>(`/api/demand/route/${origin}/${destination}`);
}

export async function getSegmentProfile(origin: string, destination: string) {
  return fetchAPI<Record<string, number>>(`/api/demand/segment-profile?origin=${origin}&destination=${destination}`);
}

export async function getDowHeatmap(origin: string, destination: string) {
  return fetchAPI<Record<string, Record<number, number>>>(`/api/demand/dow-heatmap/${origin}/${destination}`);
}

export async function getAllRouteDecompositions(limit: number = 50) {
  return fetchAPI<Array<{
    route: string;
    origin: string;
    destination: string;
    segment_mix: Record<string, number>;
    segment_metrics: Record<string, any>;
    avg_load_factor: number | null;
    avg_fare: number | null;
  }>>(`/api/demand/all-routes?limit=${limit}`);
}

// External Signals endpoints
export async function getCruiseSignal(destination: string, dow: number) {
  return fetchAPI<{
    signal_strength: number;
    is_cruise_port: boolean;
    port_name?: string;
    ships_per_week?: number;
    explanation?: string;
  }>(`/api/signals/cruise/${destination}/${dow}`);
}

export async function getAllSignals(origin: string, destination: string, dow: number = 6, month: number = 1) {
  return fetchAPI<{
    route: string;
    signals: Record<string, any>;
    signal_count: number;
    primary_signal: any;
  }>(`/api/signals/all/${origin}/${destination}?dow=${dow}&month=${month}`);
}

// Fleet endpoints
export async function getFleetSummary() {
  return fetchAPI<{
    total_aircraft: number;
    by_type: Record<string, number>;
    by_base: Record<string, number>;
    by_status: Record<string, number>;
    avg_age: number | null;
    total_seats: number | null;
  }>('/api/fleet/summary');
}

export async function getFleetList(params?: { base?: string; aircraft_type?: string; status?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.base) searchParams.set('base', params.base);
  if (params?.aircraft_type) searchParams.set('aircraft_type', params.aircraft_type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchAPI<Array<Record<string, any>>>(`/api/fleet/aircraft${query ? `?${query}` : ''}`);
}

export async function getMaintenanceDue(days: number = 30) {
  return fetchAPI<Array<{
    aircraft_registration: string;
    aircraft_type: string;
    home_base: string;
    next_c_check_due: string;
  }>>(`/api/fleet/maintenance-due?days=${days}`);
}

// Crew endpoints
export async function getCrewSummary() {
  return fetchAPI<{
    total_crew: number;
    by_type: Record<string, number>;
    by_base: Record<string, number>;
    by_status: Record<string, number>;
    avg_total_hours: number | null;
    avg_30_day_hours: number | null;
  }>('/api/crew/summary');
}

export async function getCrewByBase(base: string) {
  return fetchAPI<{
    base: string;
    total: number;
    by_type: Record<string, number>;
    crew: Array<Record<string, any>>;
  }>(`/api/crew/by-base/${base}`);
}

export async function getTrainingDue(days: number = 30) {
  return fetchAPI<Array<{
    employee_id: string;
    crew_type: string;
    home_base: string;
    recurrent_training_due: string;
  }>>(`/api/crew/training-due?days=${days}`);
}

// MRO endpoints
export async function getMROSummary() {
  return fetchAPI<{
    total_work_orders: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    by_provider: Record<string, number>;
    total_cost: number | null;
    avg_downtime: number | null;
  }>('/api/mro/summary');
}

export async function getScheduledMaintenance(daysAhead: number = 30, aircraft?: string) {
  const params = new URLSearchParams();
  params.set('days_ahead', daysAhead.toString());
  if (aircraft) params.set('aircraft', aircraft);

  return fetchAPI<Array<Record<string, any>>>(`/api/mro/scheduled?${params.toString()}`);
}

// Scenario endpoints
export async function getScenarios() {
  return fetchAPI<Array<{ name: string; flights: number }>>('/api/scenarios');
}

export async function compareScenarios(scenario1: string, scenario2: string) {
  return fetchAPI<{
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
  }>(`/api/scenarios/compare?scenario1=${encodeURIComponent(scenario1)}&scenario2=${encodeURIComponent(scenario2)}`);
}

// File upload
export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail);
  }

  return response.json();
}

// ==================== Live External Data Endpoints ====================

export async function getLiveAirportInfo(iataCode: string) {
  return fetchAPI<{
    success: boolean;
    data: {
      name: string;
      iata_code: string;
      city: string;
      country: string;
      lat: number;
      lng: number;
    } | null;
    error?: string;
  }>(`/api/live/airport/${iataCode}`);
}

export async function getLiveAirlineInfo(iataCode: string) {
  return fetchAPI<{
    success: boolean;
    data: {
      name: string;
      iata_code: string;
      icao_code: string;
      country: string;
    } | null;
    error?: string;
  }>(`/api/live/airline/${iataCode}`);
}

export async function getLiveSchedules(origin: string, destination?: string) {
  const url = destination
    ? `/api/live/schedules/${origin}?destination=${destination}`
    : `/api/live/schedules/${origin}`;
  return fetchAPI<{
    success: boolean;
    data: Array<{
      flight_iata: string;
      airline_iata: string;
      dep_time: string;
      arr_time: string;
      status: string;
    }>;
    error?: string;
  }>(url);
}

export async function getLiveRoutes(origin: string) {
  return fetchAPI<{
    success: boolean;
    data: Array<{
      arr_iata: string;
      airline_iata: string;
    }>;
    error?: string;
  }>(`/api/live/routes/${origin}`);
}

export async function getLiveWeather(airport: string) {
  return fetchAPI<{
    success: boolean;
    airport: string;
    data: {
      temp: number;
      feels_like: number;
      humidity: number;
      description: string;
      wind_speed: number;
    } | null;
    error?: string;
  }>(`/api/live/weather/${airport}`);
}

export async function getLiveWeatherDifferential(origin: string, destination: string) {
  return fetchAPI<{
    success: boolean;
    origin: { airport: string; temp: number; description: string };
    destination: { airport: string; temp: number; description: string };
    differential: number;
    leisure_signal: 'strong' | 'moderate' | 'weak' | 'none';
    error?: string;
  }>(`/api/live/weather/differential/${origin}/${destination}`);
}

export async function getLiveFares(origin: string, destination: string, departureDate: string) {
  return fetchAPI<{
    success: boolean;
    route: string;
    date: string;
    min_fare: number | null;
    airline_analysis: Record<string, {
      min_fare: number;
      max_fare: number;
      avg_fare: number;
      flight_count: number;
    }>;
    total_options: number;
    error?: string;
  }>(`/api/live/fares/${origin}/${destination}?departure_date=${departureDate}`);
}

export async function getLiveRouteIntelligence(
  origin: string,
  destination: string,
  departureDate?: string
) {
  const url = departureDate
    ? `/api/live/intelligence/${origin}/${destination}?departure_date=${departureDate}`
    : `/api/live/intelligence/${origin}/${destination}`;
  return fetchAPI<{
    route: string;
    timestamp: string;
    schedules: { success: boolean; data: unknown[]; error?: string };
    weather: {
      success: boolean;
      differential: number;
      leisure_signal: string;
      error?: string;
    };
    competitive_fares?: { success: boolean; min_fare: number; error?: string };
  }>(url);
}

// ==================== Network Intelligence Endpoints ====================

export interface NetworkPosition {
  total_markets: number;
  overlap_markets: number;
  nk_only_markets: number;
  f9_only_markets: number;
  total_nk_passengers: number;
  total_f9_passengers: number;
  avg_nk_market_share: number;
  fare_advantage_markets: number;
  fare_disadvantage_markets: number;
}

export interface MarketIntelligence {
  market_key: string;
  origin: string;
  destination: string;
  total_passengers: number;
  nk_passengers: number;
  f9_passengers: number;
  nk_market_share: number;
  nk_avg_fare: number | null;
  f9_avg_fare: number | null;
  fare_advantage: number;
  competitive_intensity: 'low' | 'moderate' | 'high' | 'intense';
  distance: number;
}

export interface ExecutiveInsight {
  category: string;
  headline: string;
  detail: string;
  metric: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MarketOpportunity {
  market: string;
  type: 'share_opportunity' | 'pricing_opportunity';
  current_share?: number;
  total_market_size?: number;
  nk_passengers?: number;
  f9_passengers?: number;
  fare_advantage_pct?: number;
  fare_position?: string;
  priority: 'high' | 'medium' | 'low';
  insight: string;
}

export interface BookingCurvePoint {
  days_before_departure: number;
  cumulative_booked_pct: number;
  segment_breakdown: Record<string, number>;
}

export interface BookingCurveResponse {
  route: string;
  segment_mix: Record<string, number>;
  booking_curve: BookingCurvePoint[];
  pricing_recommendations: Array<{
    window: string;
    strategy: string;
    recommendation: string;
  }>;
}

export interface RoutePnL {
  route: string;
  market_key: string;
  distance_miles: number;
  annual_passengers: number;
  avg_fare: number;
  segment_mix: Record<string, number>;
  estimated_annual_revenue: number;
  estimated_annual_cost: number;
  estimated_profit: number;
  profit_margin_pct: number;
  rasm_cents: number;
  casm_cents: number;
  competitive_context: {
    f9_passengers: number;
    market_share: number;
    fare_vs_f9: number;
  };
}

export async function getNetworkPosition() {
  return fetchAPI<NetworkPosition>('/api/intelligence/position');
}

export async function getMarketIntelligence(limit: number = 50) {
  return fetchAPI<MarketIntelligence[]>(`/api/intelligence/markets?limit=${limit}`);
}

export async function getSingleMarketIntelligence(marketKey: string) {
  return fetchAPI<{
    route: string;
    market_key: string;
    summary: {
      total_market_size: number;
      nk_passengers: number;
      f9_passengers: number;
      nk_share: number;
      distance: number;
    };
    competitive_position: {
      intensity: string;
      nk_avg_fare: number;
      f9_avg_fare: number;
      fare_advantage_pct: number;
      price_position: string;
    };
    recommendations: Array<{
      type: string;
      priority: string;
      message: string;
    }>;
  }>(`/api/intelligence/market/${marketKey}`);
}

export async function getMarketOpportunities() {
  return fetchAPI<MarketOpportunity[]>('/api/intelligence/opportunities');
}

export async function getFareIntelligence(market?: string) {
  const url = market ? `/api/intelligence/fares?market=${market}` : '/api/intelligence/fares';
  return fetchAPI<{
    total_observations: number;
    markets_covered: number;
    date_range: { min: string; max: string };
    nk_metrics: { avg_fare: number; min_fare: number; max_fare: number; nonstop_pct: number };
    f9_metrics: { avg_fare: number; min_fare: number; max_fare: number; nonstop_pct: number };
    price_level_distribution: Record<string, number>;
    nk_win_rate?: number;
    avg_fare_difference?: number;
  }>(url);
}

export async function getIntelligentRankings(limit: number = 50) {
  return fetchAPI<Array<{
    rank: number;
    route: string;
    origin: string;
    destination: string;
    passengers: number;
    distance: number;
    months_served: number;
    competitive_context?: {
      f9_passengers: number;
      market_share: number;
      fare_advantage: number | null;
      competitive_intensity: string;
    };
    insight?: string;
  }>>(`/api/intelligence/rankings?limit=${limit}`);
}

export async function getExecutiveInsights() {
  return fetchAPI<ExecutiveInsight[]>('/api/intelligence/insights');
}

// Cross-Domain Intelligence
export async function getFleetAlignment() {
  return fetchAPI<{
    fleet_summary: { by_base?: Record<string, number> };
    base_analysis: Record<string, {
      aircraft: number;
      annual_passengers: number;
      pax_per_aircraft: number;
    }>;
    recommendations: Array<{
      type: string;
      base: string;
      message: string;
    }>;
  }>('/api/intelligence/fleet-alignment');
}

export async function getCrewAlignment() {
  return fetchAPI<{
    crew_summary: Record<string, unknown>;
    base_analysis: Record<string, {
      pilots: number;
      flight_attendants: number;
      fa_pilot_ratio: number;
    }>;
    training_alerts: Array<{
      base?: string;
      issue?: string;
      message?: string;
      type?: string;
      due_30_days?: number;
      due_60_days?: number;
      due_90_days?: number;
    }>;
  }>('/api/intelligence/crew-alignment');
}

export async function getMROImpact() {
  return fetchAPI<{
    mro_summary: {
      by_type?: Record<string, number>;
      by_status?: Record<string, number>;
    };
    upcoming_events: Array<{
      aircraft: string;
      base: string;
      maintenance_type: string;
      start_date: string;
      downtime_days: number;
    }>;
    network_impact: Array<{
      base: string;
      aircraft: string;
      impact: string;
      severity: string;
    }>;
  }>('/api/intelligence/mro-impact');
}

export async function getEquipmentRecommendations() {
  return fetchAPI<Array<{
    route: string;
    market_key: string;
    recommended_equipment: string;
    reason: string;
    estimated_daily_pax: number;
    competitive_intensity: string;
  }>>('/api/intelligence/equipment-recommendations');
}

// Booking Curve
export async function getBookingCurve(origin: string, destination: string) {
  return fetchAPI<BookingCurveResponse>(`/api/booking-curve/${origin}/${destination}`);
}

// Route P&L
export async function getRoutePnl(origin: string, destination: string) {
  return fetchAPI<RoutePnL>(`/api/route-pnl/${origin}/${destination}`);
}

// Alias for backwards compatibility
export const getRoutePnL = getRoutePnl;

// Market Intelligence Detail - wrapper around getSingleMarketIntelligence
export async function getMarketIntelligenceDetail(marketKey: string) {
  return getSingleMarketIntelligence(marketKey).catch(() => null);
}

// ==================== RASM Optimization Engine ====================

export interface OptimizerStatus {
  optimizer_available: boolean;
  features: {
    mathematical_optimization: boolean;
    ai_scoring: boolean;
    demand_forecasting: boolean;
    scenario_simulation: boolean;
  };
  solver: string | null;
}

export interface EquipmentOption {
  option: string;
  equipment: string;
  frequency: number;
  seats: number;
  daily_capacity: number;
  expected_pax: number;
  load_factor: number;
  revenue: number;
  cost: number;
  profit: number;
  rasm_cents: number;
  asm: number;
  delta_profit: number;
  delta_rasm: number;
  recommendation: string;
}

export interface AIRouteScore {
  route: string;
  overall_score: number;
  scores: {
    rasm_score: number;
    strategic_score: number;
    risk_score: number;
    growth_score: number;
  };
  recommendation: string;
  key_factors: string[];
}

export interface RouteOptimizationResult {
  route: string;
  distance_nm: number;
  stage_length_casm_cents: number;
  current_state: {
    equipment: string;
    frequency: number;
    fare: number;
    daily_demand: number;
    segment_mix: Record<string, number>;
  };
  equipment_analysis: {
    options: EquipmentOption[];
    recommended: EquipmentOption;
    rasm_improvement_cents: number;
  };
  demand_forecast: {
    predicted_demand: number;
    confidence_interval: [number, number];
    confidence_level: string;
    model_used: string;
  };
  price_elasticity: {
    elasticity: number;
    interpretation: string;
    pricing_recommendation: {
      action: string;
      suggested_change_pct: number;
      expected_revenue_change_pct: number;
    };
  };
  ai_route_score: AIRouteScore;
  recommendations: Array<{
    priority: number;
    category: string;
    action: string;
    impact: string;
    confidence: string;
  }>;
  optimization_summary: {
    potential_profit_increase: number;
    potential_rasm_increase: number;
    confidence: string;
  };
}

export interface ScenarioResult {
  scenario: string;
  frequency_change: number;
  before: {
    equipment: string;
    frequency: number;
    asm: number;
    revenue: number;
    cost: number;
    profit: number;
    rasm_cents: number;
  };
  after: {
    equipment: string;
    frequency: number;
    asm: number;
    revenue: number;
    cost: number;
    profit: number;
    rasm_cents: number;
  };
  impact: {
    delta_profit: number;
    delta_rasm: number;
    delta_capacity_pct: number;
  };
}

export async function getOptimizerStatus(): Promise<OptimizerStatus> {
  return fetchAPI<OptimizerStatus>('/api/optimizer/status');
}

export async function optimizeRoute(params: {
  origin: string;
  destination: string;
  distance_nm?: number;
  current_equipment?: string;
  current_frequency?: number;
  current_fare?: number;
  daily_demand?: number;
  segment_mix?: Record<string, number>;
}): Promise<RouteOptimizationResult> {
  return fetchAPI<RouteOptimizationResult>('/api/optimizer/route', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getQuickRouteOptimization(
  origin: string,
  destination: string,
  equipment: string = 'A320neo',
  frequency: number = 2
) {
  return fetchAPI<{
    route: string;
    distance_nm: number;
    stage_length_casm: number;
    current: EquipmentOption | null;
    options: EquipmentOption[];
    recommended: EquipmentOption;
    rasm_improvement_potential: number;
  }>(`/api/optimizer/route/${origin}/${destination}?equipment=${equipment}&frequency=${frequency}`);
}

export async function getStageLengthCasm(distance_nm: number) {
  return fetchAPI<{
    distance_nm: number;
    casm_cents: number;
    base_casm_cents: number;
    stage_length_premium_pct: number;
    explanation: string;
  }>(`/api/optimizer/casm/${distance_nm}`);
}

export async function getEquipmentSpecs() {
  return fetchAPI<Record<string, {
    seats: number;
    range_nm: number;
    fuel_burn_per_hour: number;
    hourly_cost: number;
    crew_required: { pilots: number; fas: number };
  }>>('/api/optimizer/equipment');
}

export async function getAIRouteScore(
  origin: string,
  destination: string,
  daily_demand: number = 200,
  avg_fare: number = 120,
  competitors: number = 2
): Promise<AIRouteScore> {
  return fetchAPI<AIRouteScore>(
    `/api/optimizer/ai-score/${origin}/${destination}?daily_demand=${daily_demand}&avg_fare=${avg_fare}&competitors=${competitors}`
  );
}

export async function runNetworkOptimization(objective: string = 'profit') {
  return fetchAPI<{
    optimization_result: {
      status: string;
      objective_value: number;
      total_revenue: number;
      total_asm: number;
      total_cost: number;
      solve_time: number;
    };
    route_scores: AIRouteScore[];
    decisions: {
      frequencies: Record<string, { total: number; by_equipment: Record<string, number> }>;
    };
    ai_recommendations: Array<{
      type: string;
      title: string;
      metrics?: Record<string, number>;
      routes?: Array<{ route: string; rasm: number; frequency: number }>;
    }>;
    network_health: {
      avg_route_score: number;
      routes_at_risk: number;
      high_performers: number;
    };
  }>('/api/optimizer/network', {
    method: 'POST',
    body: JSON.stringify({ objective }),
  });
}

export async function simulateEquipmentSwap(
  origin: string,
  destination: string,
  from_equipment: string = 'A320neo',
  to_equipment: string = 'A321neo',
  frequency_change: number = 0
): Promise<ScenarioResult> {
  return fetchAPI<ScenarioResult>(
    `/api/optimizer/scenario/equipment-swap?origin=${origin}&destination=${destination}&from_equipment=${from_equipment}&to_equipment=${to_equipment}&frequency_change=${frequency_change}`
  );
}

// =============================================================================
// DECISION OS API
// Per spec Section 10: Execution Layer
// =============================================================================

export interface Decision {
  id: string;
  category: string;
  title: string;
  description: string;
  route?: string;
  origin?: string;
  destination?: string;
  current_state: string;
  proposed_state: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  impact: {
    profit_per_day?: number;
    rasm_delta_cents?: number;
    asm_delta?: number;
    revenue_per_day?: number;
    cost_per_day?: number;
    load_factor_delta?: number;
    spill_reduction?: number;
  };
  constraints: Array<{
    domain: string;
    severity: string;
    binding: boolean;
    description: string;
  }>;
  evidence: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

export interface DecisionListResponse {
  success: boolean;
  data: Decision[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export async function listDecisions(filters?: {
  status?: string;
  category?: string;
  priority?: string;
  horizon?: string;
  limit?: number;
  offset?: number;
}): Promise<DecisionListResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.horizon) params.append('horizon', filters.horizon);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const query = params.toString();
  return fetchAPI<DecisionListResponse>(`/api/decisions${query ? `?${query}` : ''}`);
}

export async function createDecision(decision: {
  category: string;
  title: string;
  description: string;
  route?: string;
  origin?: string;
  destination?: string;
  current_state: string;
  proposed_state: string;
  priority?: string;
  impact?: Record<string, unknown>;
  constraints?: Array<Record<string, unknown>>;
  evidence?: Record<string, unknown>;
}): Promise<{ success: boolean; data: Decision }> {
  return fetchAPI('/api/decisions', {
    method: 'POST',
    body: JSON.stringify(decision),
  });
}

export async function getDecision(decisionId: string): Promise<{ success: boolean; data: Decision }> {
  return fetchAPI(`/api/decisions/${decisionId}`);
}

export async function updateDecision(
  decisionId: string,
  update: { status?: string; approver?: string; notes?: string }
): Promise<{ success: boolean; data: Decision }> {
  return fetchAPI(`/api/decisions/${decisionId}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  });
}

export async function simulateDecision(decisionId: string): Promise<{
  success: boolean;
  data: {
    decision: Decision;
    simulation: {
      feasibility: string;
      kpi_deltas: Record<string, { baseline: number; simulated: number; delta: number; delta_percent: number }>;
      constraint_status: Array<{ constraint: string; status: string; margin: number }>;
      risks: Array<{ type: string; description: string; probability: number }>;
      confidence_score: number;
    };
  };
}> {
  return fetchAPI(`/api/decisions/${decisionId}/simulate`, { method: 'POST' });
}

export async function approveDecision(
  decisionId: string,
  approval: {
    approved: boolean;
    approver_id: string;
    approver_name: string;
    comments?: string;
  }
): Promise<{ success: boolean; data: Decision }> {
  return fetchAPI(`/api/decisions/${decisionId}/approve`, {
    method: 'POST',
    body: JSON.stringify(approval),
  });
}

export async function executeDecision(decisionId: string): Promise<{ success: boolean; data: Decision }> {
  return fetchAPI(`/api/decisions/${decisionId}/execute`, { method: 'POST' });
}

export async function getDecisionAudit(decisionId: string): Promise<{
  success: boolean;
  data: {
    decision_id: string;
    audit_log: Array<{
      timestamp: string;
      actor: string;
      action: string;
      from_status?: string;
      to_status?: string;
      notes?: string;
    }>;
  };
}> {
  return fetchAPI(`/api/decisions/${decisionId}/audit`);
}

export async function getDecisionOutcomes(decisionId: string): Promise<{
  success: boolean;
  data: {
    decision_id: string;
    outcomes: {
      tracking_start: string;
      tracking_end: string;
      expected_vs_actual: Array<{
        metric: string;
        expected: number;
        actual: number;
        variance: number;
        variance_percent: number;
        within_tolerance: boolean;
      }>;
      learning_insights: string[];
    } | null;
  };
}> {
  return fetchAPI(`/api/decisions/${decisionId}/outcomes`);
}

// =============================================================================
// SIMULATION API
// Per spec Section 8: Simulation Layer
// =============================================================================

export interface DisruptionSimulationResult {
  success: boolean;
  data: {
    scenario: {
      airport: string;
      start_time: string;
      duration_hours: number;
      impact_type: string;
      delay_per_flight: number;
    };
    baseline: {
      completion_factor: number;
      otp: number;
      passengers_disrupted: number;
      recovery_time_hours: number;
      revenue_impact: number;
      rasm_impact: number;
    };
    scenario_impact: {
      completion_factor: number;
      otp: number;
      passengers_disrupted: number;
      recovery_time_hours: number;
      revenue_impact: number;
      rasm_impact: number;
    };
    affected_flights: {
      departures: number;
      arrivals: number;
      total: number;
    };
    vulnerable_flights: Array<{
      flight: string;
      route: string;
      time: string;
      passengers_affected: number;
      downstream_impact: string;
    }>;
    recommended_mitigations: string[];
    recovery_timeline: Array<{
      time: string;
      status: string;
      flights_affected: number;
    }>;
    confidence_score: number;
  };
}

export async function simulateDisruption(scenario: {
  airport: string;
  start_time: string;
  duration_hours: number;
  impact_type: string;
  delay_per_flight?: number;
}): Promise<DisruptionSimulationResult> {
  return fetchAPI('/api/simulate/disruption', {
    method: 'POST',
    body: JSON.stringify(scenario),
  });
}

export interface EquipmentSwapSimulationResult {
  success: boolean;
  data: {
    scenario: {
      route: string;
      current_equipment: string;
      proposed_equipment: string;
    };
    current_state: {
      seats: number;
      load_factor: number;
      yield: number;
      profit_per_day: number;
      rasm: number;
    };
    proposed_state: {
      seats: number;
      load_factor: number;
      yield: number;
      profit_per_day: number;
      rasm: number;
    };
    delta: {
      seats: number;
      load_factor: number;
      profit_per_day: number;
      rasm: number;
    };
    feasibility: {
      status: string;
      fleet_available: boolean;
      crew_compatible: boolean;
      gate_compatible: boolean;
      mx_clear: boolean;
    };
    annual_impact: number;
    confidence_score: number;
  };
}

export async function simulateEquipmentSwapV2(scenario: {
  origin: string;
  destination: string;
  current_equipment: string;
  proposed_equipment: string;
}): Promise<EquipmentSwapSimulationResult> {
  return fetchAPI('/api/simulate/equipment-swap', {
    method: 'POST',
    body: JSON.stringify(scenario),
  });
}

// =============================================================================
// DATA HEALTH API
// Per spec Section 6.4: Data Health Service
// =============================================================================

export interface DomainHealth {
  domain: string;
  score: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  last_refresh: string | null;
  record_count: number;
  completeness: number;
  issues: Array<{
    severity: 'WARNING' | 'ERROR' | 'CRITICAL';
    type: string;
    description: string;
  }>;
}

export interface DataHealthResponse {
  success: boolean;
  data: {
    overall_score: number;
    overall_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    last_updated: string;
    domains: DomainHealth[];
    active_issues: Array<{
      severity: string;
      type: string;
      description: string;
    }>;
    total_records: number;
  };
}

export async function getDataHealth(): Promise<DataHealthResponse> {
  return fetchAPI('/api/data-health');
}

export async function getDomainHealth(domain: string): Promise<{ success: boolean; data: DomainHealth }> {
  return fetchAPI(`/api/data-health/${domain}`);
}

// =============================================================================
// METRIC REGISTRY API
// Per spec Section 6.5
// =============================================================================

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  min_valid: number;
  max_valid: number;
  refresh_frequency: string;
  owner: string;
}

export async function getAllMetrics(): Promise<{ success: boolean; data: MetricDefinition[] }> {
  return fetchAPI('/api/metrics');
}

export async function getMetric(metricId: string): Promise<{
  success: boolean;
  data: MetricDefinition & {
    current_value: number;
    last_updated: string;
    confidence_score: number;
  };
}> {
  return fetchAPI(`/api/metrics/${metricId}`);
}

export async function validateMetricValue(
  metricId: string,
  value: number
): Promise<{
  success: boolean;
  data: {
    metric_id: string;
    value: number;
    is_valid: boolean;
    min_valid: number;
    max_valid: number;
    error?: string;
    clamped_value?: number;
  };
}> {
  return fetchAPI(`/api/metrics/validate?metric_id=${metricId}&value=${value}`, { method: 'POST' });
}

// =============================================================================
// TAIL HEALTH API
// =============================================================================

export interface TailHealth {
  tail: string;
  aircraft_type: string;
  base: string;
  rasm_cents: number;
  utilization_hours: number;
  daily_profit: number;
  status: string;
  trend: string;
}

export async function getTailHealth(): Promise<{
  success: boolean;
  data: {
    tails: TailHealth[];
    summary: {
      avg_rasm: number;
      avg_utilization: number;
      total_daily_profit: number;
    };
  };
}> {
  return fetchAPI('/api/tail-health');
}

// =============================================================================
// STATION READINESS API
// =============================================================================

export interface StationReadiness {
  station: string;
  overall_score: number;
  crew_readiness: number;
  gate_availability: number;
  ground_ops: number;
  weather_impact: number;
  status: string;
  active_flights: number;
  issues: string[];
}

export async function getStationReadiness(): Promise<{
  success: boolean;
  data: {
    stations: StationReadiness[];
    summary: {
      avg_readiness: number;
      stations_green: number;
      stations_yellow: number;
      stations_red: number;
    };
  };
}> {
  return fetchAPI('/api/stations/readiness');
}

// =============================================================================
// ACTIVE DISRUPTIONS API (Recovery Cockpit)
// =============================================================================

export interface ActiveDisruption {
  id: string;
  type: string;
  description: string;
  station: string;
  severity: string;
  started_at: string;
  flights_affected: number;
  pax_affected: number;
  estimated_resolution: string;
  recovery_actions: string[];
  revenue_impact: number;
}

export async function getActiveDisruptions(): Promise<{
  success: boolean;
  data: {
    disruptions: ActiveDisruption[];
    summary: {
      active_count: number;
      total_flights_affected: number;
      total_pax_affected: number;
      total_revenue_impact: number;
    };
  };
}> {
  return fetchAPI('/api/disruptions/active');
}

// =============================================================================
// OUTCOME TRACKING API
// =============================================================================

export interface TrackedOutcomeAPI {
  decision_id: string;
  decision_title: string;
  category: string;
  executed_at: string;
  tracking_period_days: number;
  predicted: { revenue_impact: number; rasm_impact: number };
  actual: { revenue_impact: number; rasm_impact: number };
  variance: { revenue: number; rasm: number };
  status: string;
}

export async function getTrackedOutcomes(): Promise<{
  success: boolean;
  data: {
    outcomes: TrackedOutcomeAPI[];
    summary: {
      total_tracked: number;
      validated: number;
      outperformed: number;
      underperformed: number;
      ml_accuracy: number;
    };
  };
}> {
  return fetchAPI('/api/outcomes');
}
