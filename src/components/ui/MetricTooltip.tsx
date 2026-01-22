'use client';

import { useState, useRef, useEffect } from 'react';
import { Info, AlertTriangle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getMetricDefinition, validateMetric, formatMetricValue, type MetricDefinition } from '@/lib/metricRegistry';

/**
 * MetricTooltip - Displays metric value with definition tooltip
 *
 * Per spec (Section 11.3):
 * Every metric displayed must have:
 * 1. Value - The number itself, properly formatted
 * 2. Definition Tooltip - What this metric means (on hover)
 * 3. Time Window - What period this covers
 * 4. Freshness Indicator - When data was last updated
 * 5. Confidence Score - How reliable this number is
 * 6. Trend - Direction compared to previous period (when applicable)
 */

interface MetricTooltipProps {
  metricId: string;
  value: number;
  comparisonValue?: number;
  confidenceScore?: number;
  lastUpdated?: Date;
  timeWindow?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTrend?: boolean;
  showConfidence?: boolean;
  className?: string;
}

export function MetricTooltip({
  metricId,
  value,
  comparisonValue,
  confidenceScore = 100,
  lastUpdated,
  timeWindow,
  size = 'md',
  showTrend = true,
  showConfidence = false,
  className = '',
}: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const metric = getMetricDefinition(metricId);
  const validation = validateMetric(metricId, value);
  const formattedValue = formatMetricValue(metricId, validation.clampedValue ?? value);

  // Calculate delta
  const delta = comparisonValue !== undefined ? value - comparisonValue : undefined;
  const deltaPercent =
    comparisonValue !== undefined && comparisonValue !== 0
      ? ((value - comparisonValue) / comparisonValue) * 100
      : undefined;

  // Format freshness
  const formatFreshness = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Position tooltip
  useEffect(() => {
    if (isOpen && containerRef.current && tooltipRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current.offsetHeight;
      const spaceBelow = window.innerHeight - containerRect.bottom;
      setPosition(spaceBelow < tooltipHeight + 20 ? 'top' : 'bottom');
    }
  }, [isOpen]);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  const getTrendIcon = () => {
    if (delta === undefined) return null;
    if (delta > 0) return <TrendingUp className="w-4 h-4" />;
    if (delta < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (delta === undefined) return 'text-slate-500';
    // For most metrics, up is good
    const upIsGood = !['casm', 'delay_minutes', 'spill_rate'].includes(metricId);
    if (delta > 0) return upIsGood ? 'text-emerald-600' : 'text-red-600';
    if (delta < 0) return upIsGood ? 'text-red-600' : 'text-emerald-600';
    return 'text-slate-500';
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-2 ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Value Display */}
      <div className="flex items-baseline gap-2">
        <span className={`font-bold ${sizeClasses[size]} ${!validation.isValid ? 'text-red-600' : 'text-slate-800'}`}>
          {formattedValue}
        </span>

        {/* Trend */}
        {showTrend && delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-sm font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            {deltaPercent !== undefined && (
              <span>{deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(1)}%</span>
            )}
          </span>
        )}

        {/* Confidence */}
        {showConfidence && (
          <span className="text-xs text-slate-400">
            {confidenceScore}% conf
          </span>
        )}

        {/* Warning indicator */}
        {!validation.isValid && (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        )}

        {/* Info icon */}
        <Info className="w-4 h-4 text-slate-400 cursor-help" />
      </div>

      {/* Tooltip */}
      {isOpen && metric && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-80 bg-white rounded-lg shadow-xl border border-slate-200 p-4 ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-0`}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-semibold text-slate-800">{metric.name}</h4>
              <p className="text-xs text-slate-500">{metric.id}</p>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
              <Clock className="w-3 h-3" />
              {timeWindow || metric.timeWindow || 'Current'}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 mb-3">{metric.description}</p>

          {/* Formula */}
          <div className="bg-slate-50 rounded p-2 mb-3">
            <div className="text-xs text-slate-500 mb-1">Formula</div>
            <code className="text-xs text-slate-700">{metric.formula}</code>
          </div>

          {/* Valid Range */}
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-500">Valid Range</span>
            <span className="font-mono text-slate-700">
              {metric.minValidValue}{metric.unit} – {metric.maxValidValue}{metric.unit}
            </span>
          </div>

          {/* Current Value Status */}
          {!validation.isValid && (
            <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
              <div className="flex items-center gap-2 text-red-700 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>{validation.error}</span>
              </div>
            </div>
          )}

          {validation.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
              <div className="flex items-center gap-2 text-amber-700 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>{validation.warning}</span>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Refresh</span>
              <span className="ml-2 text-slate-700">{metric.refreshFrequency}</span>
            </div>
            <div>
              <span className="text-slate-500">Owner</span>
              <span className="ml-2 text-slate-700">{metric.owner}</span>
            </div>
            {lastUpdated && (
              <div className="col-span-2">
                <span className="text-slate-500">Last Updated</span>
                <span className="ml-2 text-slate-700">{formatFreshness(lastUpdated)}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-3">
            {metric.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple metric display with validation
 */
interface MetricValueProps {
  metricId: string;
  value: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MetricValue({ metricId, value, size = 'md', className = '' }: MetricValueProps) {
  const validation = validateMetric(metricId, value);
  const formattedValue = formatMetricValue(metricId, validation.clampedValue ?? value);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <span className={`font-medium ${sizeClasses[size]} ${!validation.isValid ? 'text-red-600' : ''} ${className}`}>
      {formattedValue}
      {!validation.isValid && <AlertTriangle className="inline-block w-3 h-3 ml-1 text-red-500" />}
    </span>
  );
}

export default MetricTooltip;
