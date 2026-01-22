/**
 * Metric Registry Service
 *
 * Per spec (Section 6.5):
 * Every metric displayed in the UI must be registered in a central Metric Registry.
 * This ensures consistency, enables tooltips, and prevents impossible values.
 */

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  numeratorDescription?: string;
  denominatorDescription?: string;
  unit: string;
  format: string;
  precision: number;
  minValidValue: number;
  maxValidValue: number;
  timeWindow?: string;
  dataSources: string[];
  refreshFrequency: 'real-time' | 'hourly' | 'daily' | 'weekly';
  owner: string;
  tags: string[];
}

export interface MetricValue {
  metricId: string;
  value: number;
  formattedValue: string;
  timeWindowStart: Date;
  timeWindowEnd: Date;
  lastCalculated: Date;
  dataFreshness: Date;
  confidenceScore: number;
  isAnomalous: boolean;
  anomalyReason?: string;
  comparisonValue?: number;
  comparisonDelta?: number;
  comparisonDeltaPercent?: number;
}

export interface ValidationResult {
  isValid: boolean;
  value: number;
  clampedValue?: number;
  error?: string;
  warning?: string;
}

// Central Metric Registry
export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // RASM - The North Star Metric
  rasm: {
    id: 'rasm',
    name: 'RASM',
    description: 'Revenue per Available Seat Mile - The primary metric airlines are measured on. Total operating revenue divided by available seat miles.',
    formula: 'Total Revenue / ASMs',
    numeratorDescription: 'Total operating revenue including passenger revenue and ancillaries',
    denominatorDescription: 'Available Seat Miles = Seats × Distance (miles)',
    unit: '¢',
    format: '0.00',
    precision: 2,
    minValidValue: 0,
    maxValidValue: 50, // Rarely exceeds 25¢ for US airlines
    timeWindow: 'trailing 30 days',
    dataSources: ['revenue_system', 'schedule_system'],
    refreshFrequency: 'daily',
    owner: 'Revenue Management',
    tags: ['commercial', 'financial', 'primary'],
  },

  // Market Share
  market_share: {
    id: 'market_share',
    name: 'Market Share',
    description: 'Airline\'s share of total passengers in an O&D market. Must be between 0% and 100%.',
    formula: 'Airline Passengers / Total Market Passengers × 100',
    numeratorDescription: 'Passengers carried by this airline in the market',
    denominatorDescription: 'Total passengers in the market across all carriers',
    unit: '%',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 100, // CRITICAL: Cannot exceed 100%
    timeWindow: 'trailing 12 months',
    dataSources: ['dot_db1b', 'internal_bookings'],
    refreshFrequency: 'weekly',
    owner: 'Network Planning',
    tags: ['commercial', 'competitive'],
  },

  // Load Factor
  load_factor: {
    id: 'load_factor',
    name: 'Load Factor',
    description: 'Capacity utilization - percentage of available seats that are filled with passengers.',
    formula: 'RPMs / ASMs × 100',
    numeratorDescription: 'Revenue Passenger Miles = Passengers × Distance',
    denominatorDescription: 'Available Seat Miles = Seats × Distance',
    unit: '%',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'flight or period',
    dataSources: ['reservation_system', 'dcs'],
    refreshFrequency: 'real-time',
    owner: 'Revenue Management',
    tags: ['commercial', 'operations'],
  },

  // On-Time Performance
  otp: {
    id: 'otp',
    name: 'On-Time Performance',
    description: 'Percentage of flights departing within 15 minutes of scheduled departure (D-15).',
    formula: 'D-15 On-time Flights / Total Flights × 100',
    unit: '%',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'trailing 30 days',
    dataSources: ['oooi_system', 'faa_aspm'],
    refreshFrequency: 'real-time',
    owner: 'Operations',
    tags: ['operations', 'performance'],
  },

  // Completion Factor
  completion_factor: {
    id: 'completion_factor',
    name: 'Completion Factor',
    description: 'Percentage of scheduled flights that were actually operated.',
    formula: 'Operated Flights / Scheduled Flights × 100',
    unit: '%',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'trailing 30 days',
    dataSources: ['schedule_system', 'oooi_system'],
    refreshFrequency: 'daily',
    owner: 'Operations',
    tags: ['operations', 'reliability'],
  },

  // Yield
  yield: {
    id: 'yield',
    name: 'Yield',
    description: 'Average revenue per passenger mile. Measures pricing efficiency.',
    formula: 'Passenger Revenue / RPMs',
    unit: '¢',
    format: '0.00',
    precision: 2,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'trailing 30 days',
    dataSources: ['revenue_system'],
    refreshFrequency: 'daily',
    owner: 'Revenue Management',
    tags: ['commercial', 'pricing'],
  },

  // CASM (Cost per Available Seat Mile)
  casm: {
    id: 'casm',
    name: 'CASM',
    description: 'Cost per Available Seat Mile - total operating costs divided by ASMs.',
    formula: 'Total Operating Costs / ASMs',
    unit: '¢',
    format: '0.00',
    precision: 2,
    minValidValue: 0,
    maxValidValue: 30,
    timeWindow: 'trailing 12 months',
    dataSources: ['finance_system'],
    refreshFrequency: 'weekly',
    owner: 'Finance',
    tags: ['financial', 'costs'],
  },

  // Spill Rate
  spill_rate: {
    id: 'spill_rate',
    name: 'Spill Rate',
    description: 'Percentage of demand that cannot be accommodated due to capacity constraints.',
    formula: 'Spilled Passengers / Total Demand × 100',
    unit: '%',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'trailing 30 days',
    dataSources: ['reservation_system', 'demand_forecast'],
    refreshFrequency: 'daily',
    owner: 'Revenue Management',
    tags: ['commercial', 'capacity'],
  },

  // Aircraft Utilization
  aircraft_utilization: {
    id: 'aircraft_utilization',
    name: 'Aircraft Utilization',
    description: 'Average block hours per aircraft per day.',
    formula: 'Total Block Hours / Aircraft Days',
    unit: 'hrs',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 18, // Max realistic utilization
    timeWindow: 'trailing 30 days',
    dataSources: ['oooi_system', 'fleet_system'],
    refreshFrequency: 'daily',
    owner: 'Network Planning',
    tags: ['operations', 'fleet'],
  },

  // Tail Health Score
  tail_health: {
    id: 'tail_health',
    name: 'Tail Health Score',
    description: 'Overall health score for an aircraft based on maintenance history, MEL items, and reliability.',
    formula: 'Composite score from MX factors',
    unit: '',
    format: '0',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'current',
    dataSources: ['mx_system', 'reliability_db'],
    refreshFrequency: 'real-time',
    owner: 'Maintenance',
    tags: ['maintenance', 'fleet'],
  },

  // Crew Legality Risk
  crew_legality_risk: {
    id: 'crew_legality_risk',
    name: 'Crew Legality Risk',
    description: 'Risk score for crew pairing approaching legality limits (FAR/CBA).',
    formula: 'Composite score from duty/rest/monthly limits',
    unit: '',
    format: '0',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'current pairing',
    dataSources: ['crew_system', 'pairing_optimizer'],
    refreshFrequency: 'real-time',
    owner: 'Crew Planning',
    tags: ['crew', 'operations'],
  },

  // Station Readiness
  station_readiness: {
    id: 'station_readiness',
    name: 'Station Readiness',
    description: 'Overall readiness score for a station including gates, staff, and equipment.',
    formula: 'Weighted average of resource availability',
    unit: '',
    format: '0',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'next 24 hours',
    dataSources: ['station_system', 'staffing_system'],
    refreshFrequency: 'hourly',
    owner: 'Ground Operations',
    tags: ['operations', 'station'],
  },

  // Revenue per Day
  revenue_per_day: {
    id: 'revenue_per_day',
    name: 'Daily Revenue',
    description: 'Total operating revenue per day.',
    formula: 'Sum of all revenue streams',
    unit: '$',
    format: '$0,000',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 100000000, // $100M max for a single day
    timeWindow: 'single day',
    dataSources: ['revenue_system'],
    refreshFrequency: 'daily',
    owner: 'Finance',
    tags: ['financial', 'commercial'],
  },

  // Profit per Day
  profit_per_day: {
    id: 'profit_per_day',
    name: 'Daily Profit',
    description: 'Net profit contribution per day.',
    formula: 'Revenue - Operating Costs',
    unit: '$',
    format: '$0,000',
    precision: 0,
    minValidValue: -50000000, // Can be negative
    maxValidValue: 50000000,
    timeWindow: 'single day',
    dataSources: ['revenue_system', 'finance_system'],
    refreshFrequency: 'daily',
    owner: 'Finance',
    tags: ['financial'],
  },

  // ASMs (Available Seat Miles)
  asms: {
    id: 'asms',
    name: 'ASMs',
    description: 'Available Seat Miles - total seats available multiplied by distance flown.',
    formula: 'Seats × Distance (miles)',
    unit: 'M',
    format: '0.0',
    precision: 1,
    minValidValue: 0,
    maxValidValue: 1000000000000, // Billions of ASMs
    timeWindow: 'period',
    dataSources: ['schedule_system'],
    refreshFrequency: 'daily',
    owner: 'Network Planning',
    tags: ['capacity', 'network'],
  },

  // Delay Minutes
  delay_minutes: {
    id: 'delay_minutes',
    name: 'Delay Minutes',
    description: 'Average departure delay in minutes.',
    formula: 'Actual Departure - Scheduled Departure',
    unit: 'min',
    format: '0',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 1440, // 24 hours max
    timeWindow: 'per flight or average',
    dataSources: ['oooi_system'],
    refreshFrequency: 'real-time',
    owner: 'Operations',
    tags: ['operations', 'performance'],
  },

  // Passengers
  passengers: {
    id: 'passengers',
    name: 'Passengers',
    description: 'Number of passengers.',
    formula: 'Count of booked/flown passengers',
    unit: '',
    format: '0,000',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 100000000,
    timeWindow: 'period',
    dataSources: ['reservation_system', 'dcs'],
    refreshFrequency: 'real-time',
    owner: 'Commercial',
    tags: ['commercial'],
  },

  // Confidence Score
  confidence: {
    id: 'confidence',
    name: 'Confidence Score',
    description: 'Confidence level in a prediction or recommendation.',
    formula: 'Model-specific calculation',
    unit: '%',
    format: '0',
    precision: 0,
    minValidValue: 0,
    maxValidValue: 100,
    timeWindow: 'current',
    dataSources: ['ml_models'],
    refreshFrequency: 'real-time',
    owner: 'Data Science',
    tags: ['analytics'],
  },
};

/**
 * Validate a metric value against its definition
 */
export function validateMetric(metricId: string, value: number): ValidationResult {
  const metric = METRIC_REGISTRY[metricId];

  if (!metric) {
    return {
      isValid: false,
      value,
      error: `Unknown metric: ${metricId}`,
    };
  }

  // Check for NaN or undefined
  if (value === undefined || value === null || isNaN(value)) {
    return {
      isValid: false,
      value: 0,
      error: `Invalid value for ${metric.name}: value is not a number`,
    };
  }

  // Check minimum
  if (value < metric.minValidValue) {
    return {
      isValid: false,
      value,
      clampedValue: metric.minValidValue,
      error: `${metric.name} value ${value}${metric.unit} is below minimum (${metric.minValidValue}${metric.unit})`,
    };
  }

  // Check maximum
  if (value > metric.maxValidValue) {
    return {
      isValid: false,
      value,
      clampedValue: metric.maxValidValue,
      error: `${metric.name} value ${value}${metric.unit} exceeds maximum (${metric.maxValidValue}${metric.unit}). This is a data quality issue.`,
    };
  }

  // Warn if value seems anomalous (e.g., very high but still valid)
  const range = metric.maxValidValue - metric.minValidValue;
  const threshold = metric.minValidValue + range * 0.9;
  if (value > threshold && metric.maxValidValue <= 100) {
    return {
      isValid: true,
      value,
      warning: `${metric.name} value ${value}${metric.unit} is unusually high`,
    };
  }

  return {
    isValid: true,
    value,
  };
}

/**
 * Format a metric value according to its definition
 */
export function formatMetricValue(metricId: string, value: number): string {
  const metric = METRIC_REGISTRY[metricId];

  if (!metric) {
    return String(value);
  }

  const rounded = Number(value.toFixed(metric.precision));

  switch (metric.unit) {
    case '¢':
      return `${rounded.toFixed(metric.precision)}¢`;
    case '%':
      return `${rounded.toFixed(metric.precision)}%`;
    case '$':
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${rounded.toLocaleString()}`;
    case 'hrs':
      return `${rounded.toFixed(metric.precision)} hrs`;
    case 'min':
      return `${rounded} min`;
    case 'M':
      return `${(value / 1000000).toFixed(1)}M`;
    default:
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return rounded.toLocaleString();
  }
}

/**
 * Get metric definition by ID
 */
export function getMetricDefinition(metricId: string): MetricDefinition | undefined {
  return METRIC_REGISTRY[metricId];
}

/**
 * Get all metrics by tag
 */
export function getMetricsByTag(tag: string): MetricDefinition[] {
  return Object.values(METRIC_REGISTRY).filter((m) => m.tags.includes(tag));
}

/**
 * Validate and clamp a value to valid range
 */
export function clampMetricValue(metricId: string, value: number): number {
  const metric = METRIC_REGISTRY[metricId];
  if (!metric) return value;

  return Math.max(metric.minValidValue, Math.min(metric.maxValidValue, value));
}

/**
 * Create a MetricValue object with validation
 */
export function createMetricValue(
  metricId: string,
  value: number,
  options?: {
    comparisonValue?: number;
    confidenceScore?: number;
    timeWindowStart?: Date;
    timeWindowEnd?: Date;
  }
): MetricValue | null {
  const validation = validateMetric(metricId, value);

  if (!validation.isValid && validation.clampedValue === undefined) {
    console.error(`Invalid metric value: ${validation.error}`);
    return null;
  }

  const finalValue = validation.clampedValue ?? value;
  const metric = METRIC_REGISTRY[metricId];

  const now = new Date();
  const metricValue: MetricValue = {
    metricId,
    value: finalValue,
    formattedValue: formatMetricValue(metricId, finalValue),
    timeWindowStart: options?.timeWindowStart ?? now,
    timeWindowEnd: options?.timeWindowEnd ?? now,
    lastCalculated: now,
    dataFreshness: now,
    confidenceScore: options?.confidenceScore ?? 100,
    isAnomalous: !validation.isValid || !!validation.warning,
    anomalyReason: validation.error ?? validation.warning,
  };

  if (options?.comparisonValue !== undefined) {
    metricValue.comparisonValue = options.comparisonValue;
    metricValue.comparisonDelta = finalValue - options.comparisonValue;
    metricValue.comparisonDeltaPercent =
      options.comparisonValue !== 0
        ? ((finalValue - options.comparisonValue) / options.comparisonValue) * 100
        : 0;
  }

  return metricValue;
}

export default METRIC_REGISTRY;
