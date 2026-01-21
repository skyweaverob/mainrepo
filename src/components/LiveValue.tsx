'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { formatRelativeTime, formatTimestamp } from '@/lib/formatters';

interface LiveValueProps {
  value: number | string;
  previousValue?: number | string;
  format?: (value: number | string) => string;
  showDelta?: boolean;
  isLive?: boolean;
  lastUpdate?: Date | null;
  source?: string;
  className?: string;
  deltaClassName?: string;
}

/**
 * LiveValue - A component that displays a value with live update animations
 *
 * Features:
 * - Flash blue briefly when value changes (200ms)
 * - Show ▲/▼ delta indicator for 3 seconds after change
 * - Pulsing dot if isLive
 * - Tooltip showing "Last updated: 12:34:02 PM | Source: Booking System"
 */
export function LiveValue({
  value,
  previousValue,
  format = (v) => String(v),
  showDelta = true,
  isLive = false,
  lastUpdate,
  source,
  className = '',
  deltaClassName = '',
}: LiveValueProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const [showDeltaIndicator, setShowDeltaIndicator] = useState(false);
  const prevValueRef = useRef(value);
  const deltaTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate delta
  const delta = useMemo(() => {
    if (typeof value === 'number' && typeof previousValue === 'number') {
      return value - previousValue;
    }
    if (typeof value === 'number' && typeof prevValueRef.current === 'number') {
      return value - prevValueRef.current;
    }
    return null;
  }, [value, previousValue]);

  // Trigger flash and delta display on value change
  useEffect(() => {
    if (prevValueRef.current !== value) {
      // Flash animation
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 200);

      // Show delta indicator
      if (showDelta && delta !== null && delta !== 0) {
        setShowDeltaIndicator(true);

        // Clear previous timeout
        if (deltaTimeoutRef.current) {
          clearTimeout(deltaTimeoutRef.current);
        }

        // Hide delta after 3 seconds
        deltaTimeoutRef.current = setTimeout(() => {
          setShowDeltaIndicator(false);
        }, 3000);
      }

      prevValueRef.current = value;
    }
  }, [value, delta, showDelta]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deltaTimeoutRef.current) {
        clearTimeout(deltaTimeoutRef.current);
      }
    };
  }, []);

  // Build tooltip text
  const tooltipText = useMemo(() => {
    const parts = [];
    if (lastUpdate) {
      parts.push(`Last updated: ${formatTimestamp(lastUpdate)}`);
    }
    if (source) {
      parts.push(`Source: ${source}`);
    }
    return parts.join(' | ');
  }, [lastUpdate, source]);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 transition-colors
        ${isFlashing ? 'bg-blue-500/30' : ''}
        ${className}
      `}
      title={tooltipText || undefined}
    >
      {/* Live dot */}
      {isLive && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}

      {/* Formatted value */}
      <span className={isFlashing ? 'text-blue-300' : ''}>
        {format(value)}
      </span>

      {/* Delta indicator */}
      {showDeltaIndicator && delta !== null && delta !== 0 && (
        <span
          className={`
            text-xs font-medium transition-opacity
            ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}
            ${deltaClassName}
          `}
        >
          {delta > 0 ? '▲' : '▼'}
          {typeof delta === 'number' ? Math.abs(delta).toLocaleString() : ''}
        </span>
      )}
    </span>
  );
}

/**
 * LiveCurrency - Specialized LiveValue for currency display
 */
export function LiveCurrency({
  value,
  previousValue,
  compact = false,
  showSign = false,
  ...props
}: Omit<LiveValueProps, 'format'> & {
  value: number;
  previousValue?: number;
  compact?: boolean;
  showSign?: boolean;
}) {
  const format = (v: number | string) => {
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '-';

    const sign = showSign && num > 0 ? '+' : '';
    const absValue = Math.abs(num);

    if (compact && absValue >= 1_000_000) {
      return `${sign}$${(num / 1_000_000).toFixed(1)}M`;
    }
    if (compact && absValue >= 1_000) {
      return `${sign}$${(num / 1_000).toFixed(0)}K`;
    }

    return `${sign}$${num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return <LiveValue value={value} previousValue={previousValue} format={format} {...props} />;
}

/**
 * LiveRASM - Specialized LiveValue for RASM display (cents)
 */
export function LiveRASM({
  value,
  previousValue,
  ...props
}: Omit<LiveValueProps, 'format'> & {
  value: number;
  previousValue?: number;
}) {
  const format = (v: number | string) => {
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '-';
    return `${num.toFixed(2)}¢`;
  };

  return <LiveValue value={value} previousValue={previousValue} format={format} {...props} />;
}

/**
 * LivePercentage - Specialized LiveValue for percentage display
 */
export function LivePercentage({
  value,
  previousValue,
  ...props
}: Omit<LiveValueProps, 'format'> & {
  value: number;
  previousValue?: number;
}) {
  const format = (v: number | string) => {
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '-';
    return `${num.toFixed(1)}%`;
  };

  return <LiveValue value={value} previousValue={previousValue} format={format} {...props} />;
}

/**
 * LiveCount - Specialized LiveValue for passenger/count display
 */
export function LiveCount({
  value,
  previousValue,
  compact = false,
  ...props
}: Omit<LiveValueProps, 'format'> & {
  value: number;
  previousValue?: number;
  compact?: boolean;
}) {
  const format = (v: number | string) => {
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '-';

    const rounded = Math.round(num);

    if (compact && rounded >= 1_000_000) {
      return `${(rounded / 1_000_000).toFixed(1)}M`;
    }
    if (compact && rounded >= 1_000) {
      return `${(rounded / 1_000).toFixed(0)}K`;
    }

    return rounded.toLocaleString('en-US');
  };

  return <LiveValue value={value} previousValue={previousValue} format={format} {...props} />;
}

export default LiveValue;
