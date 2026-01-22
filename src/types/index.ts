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

// ===========================================================================
// DECISION OS TYPES
// ===========================================================================

/**
 * Decision Taxonomy - 10 categories of airline network decisions
 */
export type DecisionCategory =
  | 'capacity_reallocation'  // Zero-net: move capacity from route X to Y
  | 'frequency_reduction'    // Cut frequency / day-of-week trims
  | 'downgauge'             // A321→A320
  | 'upgauge'               // A320→A321
  | 'retiming'              // Schedule shape / banking
  | 'market_exit'           // Exit market / seasonalize
  | 'market_entry'          // New route
  | 'tail_swap'             // Aircraft assignment within constraints
  | 'rm_action'             // Revenue management: fares, ancillaries, close-outs
  | 'do_not_do';            // Explicitly recommend against an action

export type DecisionStatus =
  | 'proposed'    // Generated by optimizer
  | 'simulated'   // User ran simulation
  | 'approved'    // User approved
  | 'queued'      // In implementation queue
  | 'executing'   // Currently being executed
  | 'implemented' // Sent to downstream systems
  | 'completed'   // Fully completed
  | 'validated'   // Post-implementation monitoring complete
  | 'rejected'    // User rejected
  | 'rolled_back';// Reverted due to issues

export type DecisionPriority = 'critical' | 'high' | 'medium' | 'low';

export type DecisionHorizon =
  | 'T0_T7'       // RM/IRROPS actions only
  | 'T7_T30'      // Gauge/frequency swaps
  | 'T30_T120'    // Schedule + fleet assignment
  | 'seasonal';   // Network design + fleet plan

export type ConstraintDomain = 'fleet' | 'crew' | 'mro' | 'rasm' | 'gate' | 'slot' | 'demand';

export type ConstraintSeverity = 'blocking' | 'warning' | 'ok';

/**
 * Resource consumption for a decision
 */
export interface DecisionConsumption {
  aircraftHoursPerDay: number;
  tailsRequired: number;
  crewPairingsPerDay: number;
  mroFeasibility: 'feasible' | 'requires_swap' | 'infeasible';
  gateMinutes?: number;
  slotRequired?: boolean;
}

/**
 * Constraint that may block or warn about a decision
 */
export interface DecisionConstraint {
  domain: ConstraintDomain;
  severity: ConstraintSeverity;
  binding: boolean;
  description: string;
  resolution?: string;
  impact?: string;
}

/**
 * Impact metrics for a decision
 */
export interface DecisionImpact {
  profitPerDay: number;
  rasmDeltaCents: number;
  asmDelta: number;
  revenuePerDay: number;
  costPerDay: number;
  loadFactorDelta?: number;
  spillReduction?: number;
}

/**
 * What this decision displaces/conflicts with
 */
export interface DecisionConflicts {
  displaces: string[];       // IDs of decisions that must be removed
  conflictsWith: string[];   // IDs of decisions that cannot co-exist
  requiresPrior: string[];   // IDs of decisions that must be approved first
}

/**
 * Evidence supporting the decision
 */
export interface DecisionEvidence {
  spill_rate?: number;
  load_factor?: number;
  fare_strength?: number;
  competitor_capacity_change?: number;
  search_trend?: number;
  event_driven?: string;
  explanation: string;
}

/**
 * Full Decision object for the Decision OS
 */
export interface OSDecision {
  id: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  status: DecisionStatus;

  // What the decision proposes
  title: string;
  description: string;
  route?: string;
  origin?: string;
  destination?: string;

  // Before/after state
  currentState: string;
  proposedState: string;

  // Impact
  impact: DecisionImpact;

  // Resource consumption
  consumes: DecisionConsumption;

  // Conflicts and dependencies
  conflicts: DecisionConflicts;

  // Constraints
  constraints: DecisionConstraint[];

  // Horizon eligibility
  eligibleHorizons: DecisionHorizon[];
  currentHorizon: DecisionHorizon;

  // Evidence
  evidence: DecisionEvidence;

  // Confidence
  confidence: 'high' | 'medium' | 'low';
  riskBand?: { low: number; mid: number; high: number };

  // Workflow
  owner?: string;
  approver?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  rationale?: string;
}

/**
 * Decision Log Entry for audit trail
 */
export interface DecisionLogEntry {
  id: string;
  decisionId: string;
  timestamp: string;
  fromStatus: DecisionStatus;
  toStatus: DecisionStatus;
  actor: string;
  action: string;
  notes?: string;
  impactActual?: DecisionImpact;  // For post-implementation validation
}

/**
 * Alert types for OS interrupts
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface OSAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  dollarLeakagePerDay?: number;
  deadline?: string;
  linkedDecisionIds: string[];
  acknowledged: boolean;
  createdAt: string;
  action?: {
    label: string;
    type: 'generate_decisions' | 'simulate' | 'approve' | 'assign_owner';
  };
}

/**
 * Data health indicator
 */
export interface DataHealthStatus {
  feedName: string;
  lastUpdate: string;
  ageSeconds: number;
  status: 'live' | 'aging' | 'stale' | 'disconnected';
  outOfBoundsCount: number;
  errorMessage?: string;
}

/**
 * RASM Control Panel settings
 */
export interface RASMGuardrails {
  minRASM: number;          // Minimum RASM in cents
  minMargin: number;        // Minimum margin percentage
  maxASMChangePct: number;  // Maximum ASM change percentage
  fleetSlack: number;       // Reserve tails
  crewSlack: number;        // Reserve pairings/OT tolerance
  mroBuffer: number;        // Maintenance buffer days
}

export type OptimizationObjective = 'rasm' | 'profit' | 'contribution_margin';

// Decision category labels
export const DECISION_CATEGORY_LABELS: Record<DecisionCategory, string> = {
  capacity_reallocation: 'Capacity Reallocation',
  frequency_reduction: 'Frequency Reduction',
  downgauge: 'Downgauge',
  upgauge: 'Upgauge',
  retiming: 'Retiming',
  market_exit: 'Market Exit',
  market_entry: 'Market Entry',
  tail_swap: 'Tail Swap',
  rm_action: 'RM Action',
  do_not_do: 'Do Not Do',
};

export const DECISION_CATEGORY_ICONS: Record<DecisionCategory, string> = {
  capacity_reallocation: 'ArrowLeftRight',
  frequency_reduction: 'TrendingDown',
  downgauge: 'Minimize2',
  upgauge: 'Maximize2',
  retiming: 'Clock',
  market_exit: 'LogOut',
  market_entry: 'Plus',
  tail_swap: 'Shuffle',
  rm_action: 'DollarSign',
  do_not_do: 'XCircle',
};

export const HORIZON_LABELS: Record<DecisionHorizon, string> = {
  T0_T7: 'T-0 to T-7',
  T7_T30: 'T-7 to T-30',
  T30_T120: 'T-30 to T-120',
  seasonal: 'Seasonal',
};

export const HORIZON_DESCRIPTIONS: Record<DecisionHorizon, string> = {
  T0_T7: 'RM actions, IRROPS swaps, equipment changes',
  T7_T30: 'Frequency tweaks, gauge shifts, schedule adjustments',
  T30_T120: 'Schedule changes, fleet assignment, market launches',
  seasonal: 'Network design, fleet plan, seasonal markets',
};
