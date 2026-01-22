// Number formatting utilities for SkyWeave
// Following strict formatting standards from architecture spec
// CRITICAL: Prevents bugs like "+$-986" or ">100% share"

/**
 * Validate and clamp a number to prevent impossible values
 */
export function validateNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return null;
  }
  return value;
}

/**
 * Validate market share - must be 0-100%
 * Returns null if invalid (shows "Data quality issue" in UI)
 */
export function validateMarketShare(value: number | null | undefined): number | null {
  const validated = validateNumber(value);
  if (validated === null) return null;
  if (validated < 0 || validated > 100) return null; // Invalid share
  return validated;
}

/**
 * Format currency delta values - PROPERLY handles negatives
 * FIXES: "+$-986" bug by properly handling the sign
 * @returns Formatted string like "+$1,234" or "-$1,234" (NEVER "+$-")
 */
export function formatCurrencyDelta(
  value: number | null | undefined,
  options: { compact?: boolean; suffix?: string } = {}
): string {
  const validated = validateNumber(value);
  if (validated === null) return '-';

  const { compact = false, suffix = '' } = options;
  const absValue = Math.abs(validated);
  const sign = validated >= 0 ? '+' : '-';

  let formatted: string;
  if (compact && absValue >= 1_000_000) {
    formatted = `${(absValue / 1_000_000).toFixed(1)}M`;
  } else if (compact && absValue >= 1_000) {
    formatted = `${(absValue / 1_000).toFixed(0)}K`;
  } else {
    formatted = absValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  return `${sign}$${formatted}${suffix}`;
}

/**
 * Format currency values
 * @param value - The numeric value to format
 * @param options - Formatting options
 * @returns Formatted string like "$1,234,567" or "$1.2M"
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { compact?: boolean; showSign?: boolean } = {}
): string {
  const validated = validateNumber(value);
  if (validated === null) return '-';

  const { compact = false, showSign = false } = options;

  // Use the delta formatter if sign is needed
  if (showSign) {
    return formatCurrencyDelta(validated, { compact });
  }

  const absValue = Math.abs(validated);

  if (compact && absValue >= 1_000_000) {
    const millions = validated / 1_000_000;
    return `$${millions.toFixed(1)}M`;
  }

  if (compact && absValue >= 1_000) {
    const thousands = validated / 1_000;
    return `$${thousands.toFixed(0)}K`;
  }

  // Standard format with commas
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(validated);
}

/**
 * Format RASM (Revenue per Available Seat Mile) in cents
 * Always shows exactly 2 decimal places with ¢ symbol
 * @param cents - The value in cents
 * @returns Formatted string like "12.34¢"
 */
export function formatRASM(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return '-';
  }
  return `${cents.toFixed(2)}¢`;
}

/**
 * Format Yield (Revenue per Revenue Passenger Mile) in cents
 * Always shows exactly 2 decimal places with ¢ symbol
 * @param cents - The value in cents
 * @returns Formatted string like "14.23¢"
 */
export function formatYield(cents: number | null | undefined): string {
  return formatRASM(cents); // Same format as RASM
}

/**
 * Format passenger counts
 * Whole numbers only with commas - NEVER decimals for people
 * @param count - The passenger count
 * @returns Formatted string like "1,234,567"
 */
export function formatPassengers(count: number | null | undefined): string {
  if (count === null || count === undefined || isNaN(count)) {
    return '-';
  }
  // Round to whole number - people are whole numbers
  return Math.round(count).toLocaleString('en-US');
}

/**
 * Format percentage with optional delta indicator
 * Shows one decimal place with ▲/▼ indicators for changes
 * @param value - The percentage value (e.g., 85.3 for 85.3%)
 * @param delta - Optional change value to show with arrow
 * @returns Formatted string like "85.3%" or "85.3% ▲2.1"
 */
export function formatPercentage(
  value: number | null | undefined,
  delta?: number | null
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  const formatted = `${value.toFixed(1)}%`;

  if (delta !== null && delta !== undefined && !isNaN(delta)) {
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
    const deltaFormatted = Math.abs(delta).toFixed(1);
    return `${formatted} ${arrow}${deltaFormatted}`;
  }

  return formatted;
}

/**
 * Format RASM delta with proper sign handling
 * @returns Formatted string like "+0.12¢" or "-0.12¢"
 */
export function formatRASMDelta(cents: number | null | undefined): string {
  const validated = validateNumber(cents);
  if (validated === null) return '-';

  const sign = validated >= 0 ? '+' : '-';
  const absValue = Math.abs(validated);
  return `${sign}${absValue.toFixed(2)}¢`;
}

/**
 * Format a delta (change) value with sign and color class
 * FIXES: Proper negative number handling (no "+$-" format)
 * @param value - The delta value
 * @param isRevenue - If true, positive is green; if false, positive might be red (like costs)
 * @returns Object with formatted string and color class
 */
export function formatDelta(
  value: number | null | undefined,
  isRevenue: boolean = true
): { text: string; colorClass: string } {
  const validated = validateNumber(value);
  if (validated === null) {
    return { text: '-', colorClass: 'text-slate-400' };
  }

  // Use the proper delta formatter that handles signs correctly
  const text = formatCurrencyDelta(validated, { compact: true });

  // Determine color based on direction and whether it's revenue
  let colorClass: string;
  if (validated > 0) {
    colorClass = isRevenue ? 'text-emerald-600' : 'text-red-600';
  } else if (validated < 0) {
    colorClass = isRevenue ? 'text-red-600' : 'text-emerald-600';
  } else {
    colorClass = 'text-slate-400';
  }

  return { text, colorClass };
}

/**
 * Format a timestamp as relative time ("2 min ago", "just now", etc.)
 * @param timestamp - The timestamp (Date object or ISO string)
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: Date | string | null | undefined): string {
  if (!timestamp) {
    return 'never';
  }

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 5) {
    return 'just now';
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Format a timestamp for display in tooltips
 * @param timestamp - The timestamp
 * @returns Formatted time like "12:34:02 PM"
 */
export function formatTimestamp(timestamp: Date | string | null | undefined): string {
  if (!timestamp) {
    return '-';
  }

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get freshness status based on age of data
 * @param timestamp - The last update timestamp
 * @param thresholds - Custom thresholds in seconds { fresh, aging }
 * @returns Status object with level and description
 */
export function getFreshnessStatus(
  timestamp: Date | string | null | undefined,
  thresholds: { fresh?: number; aging?: number } = {}
): {
  level: 'live' | 'aging' | 'stale' | 'disconnected';
  ageSeconds: number;
  description: string;
  colorClass: string;
} {
  if (!timestamp) {
    return {
      level: 'disconnected',
      ageSeconds: Infinity,
      description: 'No data',
      colorClass: 'text-slate-500',
    };
  }

  const { fresh = 30, aging = 120 } = thresholds; // defaults: 30s fresh, 2min aging

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const ageSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (ageSeconds < fresh) {
    return {
      level: 'live',
      ageSeconds,
      description: formatRelativeTime(date),
      colorClass: 'text-emerald-400',
    };
  }

  if (ageSeconds < aging) {
    return {
      level: 'aging',
      ageSeconds,
      description: formatRelativeTime(date),
      colorClass: 'text-amber-400',
    };
  }

  return {
    level: 'stale',
    ageSeconds,
    description: `STALE: ${formatRelativeTime(date)}`,
    colorClass: 'text-red-400',
  };
}

/**
 * Format flight number
 * @param carrier - Airline code
 * @param number - Flight number
 * @returns Formatted string like "NK847"
 */
export function formatFlightNumber(carrier: string, number: string | number): string {
  return `${carrier}${number}`;
}

/**
 * Format route display
 * @param origin - Origin airport code
 * @param destination - Destination airport code
 * @returns Formatted string like "DTW→MCO"
 */
export function formatRoute(origin: string, destination: string): string {
  return `${origin}→${destination}`;
}

/**
 * Format a large number compactly
 * @param value - The number to format
 * @returns Formatted string like "2.5M" or "847K"
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }

  return value.toLocaleString('en-US');
}
