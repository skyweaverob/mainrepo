'use client';

import { useMemo } from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatRASM, formatPercentage, formatDelta, formatRelativeTime } from '@/lib/formatters';
import { LiveDot } from './LiveFeedIndicator';

type MetricType = 'currency' | 'rasm' | 'yield' | 'percentage' | 'count';

interface RevenueMetricCardProps {
  title: string;
  value: number;
  previousValue?: number;
  metricType?: MetricType;
  subtitle?: string;
  icon?: LucideIcon;
  lastUpdate?: Date | null;
  isLive?: boolean;
  showAbsoluteDelta?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * RevenueMetricCard - Card component for displaying revenue-first metrics
 *
 * Features:
 * - Shows both percentage AND absolute dollar delta
 * - Flash animation on update
 * - Pulsing "LIVE" indicator
 * - Color coding: green (positive), red (negative), yellow (neutral)
 */
export function RevenueMetricCard({
  title,
  value,
  previousValue,
  metricType = 'currency',
  subtitle,
  icon: Icon,
  lastUpdate,
  isLive = false,
  showAbsoluteDelta = true,
  compact = false,
  onClick,
  className = '',
}: RevenueMetricCardProps) {
  // Calculate delta
  const delta = useMemo(() => {
    if (previousValue === undefined || previousValue === 0) return null;
    return {
      absolute: value - previousValue,
      percentage: ((value - previousValue) / Math.abs(previousValue)) * 100,
    };
  }, [value, previousValue]);

  // Format the main value
  const formattedValue = useMemo(() => {
    switch (metricType) {
      case 'currency':
        return formatCurrency(value, { compact: compact || value >= 1_000_000 });
      case 'rasm':
      case 'yield':
        return formatRASM(value);
      case 'percentage':
        return formatPercentage(value);
      case 'count':
        return value.toLocaleString('en-US');
      default:
        return value.toString();
    }
  }, [value, metricType, compact]);

  // Determine color based on value/delta
  const colorClass = useMemo(() => {
    if (delta === null) return 'text-white';
    if (delta.absolute > 0) return 'text-emerald-400';
    if (delta.absolute < 0) return 'text-red-400';
    return 'text-slate-400';
  }, [delta]);

  // Trend icon
  const TrendIcon = useMemo(() => {
    if (delta === null) return Minus;
    if (delta.absolute > 0) return TrendingUp;
    if (delta.absolute < 0) return TrendingDown;
    return Minus;
  }, [delta]);

  return (
    <div
      onClick={onClick}
      className={`
        bg-slate-800 rounded-lg border border-slate-700 p-4
        ${onClick ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''}
        ${className}
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            {title}
          </span>
        </div>

        {/* Live indicator */}
        {isLive && (
          <div className="flex items-center gap-1.5">
            <LiveDot lastUpdate={lastUpdate ?? null} isConnected={true} />
            <span className="text-[10px] text-emerald-400 font-bold uppercase">
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-bold ${colorClass}`}>
          {formattedValue}
        </span>

        {/* Trend icon */}
        {delta !== null && (
          <TrendIcon
            className={`w-4 h-4 ${
              delta.absolute > 0 ? 'text-emerald-400' : delta.absolute < 0 ? 'text-red-400' : 'text-slate-400'
            }`}
          />
        )}
      </div>

      {/* Delta row - shows both % and absolute */}
      {delta !== null && (
        <div className="flex items-center gap-2 mb-1">
          {/* Percentage delta */}
          <span
            className={`text-sm font-medium ${
              delta.percentage > 0 ? 'text-emerald-400' : delta.percentage < 0 ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            {delta.percentage > 0 ? '▲' : delta.percentage < 0 ? '▼' : ''}
            {Math.abs(delta.percentage).toFixed(1)}%
          </span>

          {/* Absolute delta (for currency types) */}
          {showAbsoluteDelta && metricType === 'currency' && (
            <span
              className={`text-xs ${
                delta.absolute > 0 ? 'text-emerald-400/70' : delta.absolute < 0 ? 'text-red-400/70' : 'text-slate-500'
              }`}
            >
              ({formatDelta(delta.absolute).text})
            </span>
          )}
        </div>
      )}

      {/* Subtitle / timestamp */}
      <div className="flex items-center justify-between">
        {subtitle && (
          <span className="text-xs text-slate-500">{subtitle}</span>
        )}
        {lastUpdate && (
          <span className="text-xs text-slate-600 font-mono">
            {formatRelativeTime(lastUpdate)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * RevenueMetricRow - Horizontal layout for metrics (good for inline display)
 */
export function RevenueMetricRow({
  title,
  value,
  metricType = 'currency',
  delta,
  isLive,
  lastUpdate,
}: {
  title: string;
  value: number;
  metricType?: MetricType;
  delta?: number;
  isLive?: boolean;
  lastUpdate?: Date | null;
}) {
  const formattedValue = useMemo(() => {
    switch (metricType) {
      case 'currency':
        return formatCurrency(value, { compact: value >= 1_000_000 });
      case 'rasm':
      case 'yield':
        return formatRASM(value);
      case 'percentage':
        return formatPercentage(value);
      default:
        return value.toLocaleString();
    }
  }, [value, metricType]);

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-2">
        {isLive && <LiveDot lastUpdate={lastUpdate ?? null} isConnected={true} />}
        <span className="text-sm text-slate-400">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{formattedValue}</span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={`text-xs ${
              delta > 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {delta > 0 ? '▲' : '▼'}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * RevenueMetricGrid - 4-card grid layout for key metrics
 */
export function RevenueMetricGrid({
  dailyRevenue,
  rasmCents,
  yieldCents,
  revPerDeparture,
  previousDailyRevenue,
  previousRasm,
  previousYield,
  previousRevPerDeparture,
  lastUpdate,
  isLive = false,
}: {
  dailyRevenue: number;
  rasmCents: number;
  yieldCents: number;
  revPerDeparture: number;
  previousDailyRevenue?: number;
  previousRasm?: number;
  previousYield?: number;
  previousRevPerDeparture?: number;
  lastUpdate?: Date | null;
  isLive?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <RevenueMetricCard
        title="Daily Revenue"
        value={dailyRevenue}
        previousValue={previousDailyRevenue}
        metricType="currency"
        subtitle="vs same day last week"
        isLive={isLive}
        lastUpdate={lastUpdate}
      />
      <RevenueMetricCard
        title="RASM"
        value={rasmCents}
        previousValue={previousRasm}
        metricType="rasm"
        subtitle="Revenue per ASM"
        isLive={isLive}
        lastUpdate={lastUpdate}
        showAbsoluteDelta={false}
      />
      <RevenueMetricCard
        title="Yield"
        value={yieldCents}
        previousValue={previousYield}
        metricType="yield"
        subtitle="Revenue per RPM"
        isLive={isLive}
        lastUpdate={lastUpdate}
        showAbsoluteDelta={false}
      />
      <RevenueMetricCard
        title="Rev/Departure"
        value={revPerDeparture}
        previousValue={previousRevPerDeparture}
        metricType="currency"
        subtitle="Per flight"
        isLive={isLive}
        lastUpdate={lastUpdate}
      />
    </div>
  );
}

export default RevenueMetricCard;
