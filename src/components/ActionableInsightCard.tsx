'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plane,
  Users,
  Calendar,
  DollarSign,
  Play,
  Eye,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

type Priority = 'high' | 'medium' | 'low';
type FeasibilityStatus = 'pass' | 'fail' | 'warning';

interface FeasibilityCheck {
  name: string;
  status: FeasibilityStatus;
  detail?: string;
}

interface ActionableInsightProps {
  // The specific action (e.g., "Downgauge FLL-ATL flight #NK847 from A321 to A319")
  action: string;

  // Specific timing (e.g., "For departures Feb 1-28")
  timing: string;

  // Impact in dollars
  annualImpact: number;

  // Optional additional impact info
  impactDescription?: string;

  // Priority level (determines border color)
  priority: Priority;

  // Feasibility checks
  feasibility: FeasibilityCheck[];

  // Callbacks
  onSimulate?: () => void;
  onViewDetail?: () => void;
  onDismiss?: () => void;

  // Optional metadata
  route?: string;
  category?: string;
  confidence?: number; // 0-100
}

/**
 * ActionableInsightCard - Displays a specific, actionable recommendation
 *
 * NO CONSULTANT-SPEAK ALLOWED. Every insight must have:
 * 1. SPECIFIC ACTION: What exactly to do
 * 2. SPECIFIC TIMING: When to do it
 * 3. SPECIFIC IMPACT: Dollar value
 * 4. FEASIBILITY: Can it actually be done?
 * 5. ONE-CLICK ACTION: Simulate button
 */
export function ActionableInsightCard({
  action,
  timing,
  annualImpact,
  impactDescription,
  priority,
  feasibility,
  onSimulate,
  onViewDetail,
  onDismiss,
  route,
  category,
  confidence,
}: ActionableInsightProps) {
  const borderClass = useMemo(() => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-amber-500';
      case 'low':
        return 'border-l-emerald-500';
    }
  }, [priority]);

  const priorityBadgeClass = useMemo(() => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
    }
  }, [priority]);

  const priorityLabel = useMemo(() => {
    switch (priority) {
      case 'high':
        return '>$500K impact';
      case 'medium':
        return '$100-500K impact';
      case 'low':
        return '<$100K impact';
    }
  }, [priority]);

  const allFeasible = feasibility.every((f) => f.status === 'pass');
  const hasBlockers = feasibility.some((f) => f.status === 'fail');

  return (
    <div
      className={`
        bg-slate-800 rounded-lg border border-slate-700 border-l-4 ${borderClass}
        overflow-hidden
      `}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Priority badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${priorityBadgeClass}`}>
            {priority}
          </span>

          {/* Category */}
          {category && (
            <span className="text-xs text-slate-500">{category}</span>
          )}

          {/* Route */}
          {route && (
            <span className="text-xs font-mono text-slate-400">{route}</span>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Dismiss this insight"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="p-4">
        {/* 1. SPECIFIC ACTION */}
        <div className="mb-3">
          <div className="flex items-start gap-2">
            <Plane className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium text-white leading-relaxed">
              {action}
            </p>
          </div>
        </div>

        {/* 2. SPECIFIC TIMING */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">{timing}</span>
          </div>
        </div>

        {/* 3. SPECIFIC IMPACT */}
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">
              Estimated Impact
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xl font-bold ${
                annualImpact > 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatCurrency(annualImpact, { showSign: true })}
            </span>
            <span className="text-sm text-slate-400">annual</span>
          </div>
          {impactDescription && (
            <p className="text-xs text-slate-500 mt-1">{impactDescription}</p>
          )}
        </div>

        {/* 4. FEASIBILITY CHECK */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">
              Feasibility Check
            </span>
            {allFeasible && (
              <span className="text-xs text-emerald-400">All clear</span>
            )}
            {hasBlockers && (
              <span className="text-xs text-red-400">Blockers found</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {feasibility.map((check, i) => (
              <FeasibilityBadge key={i} {...check} />
            ))}
          </div>
        </div>

        {/* Confidence score if provided */}
        {confidence !== undefined && (
          <div className="mb-4 text-xs text-slate-500">
            Confidence: {confidence}%
          </div>
        )}

        {/* 5. ACTION BUTTONS */}
        <div className="flex items-center gap-2">
          {/* Primary: Simulate button */}
          <button
            onClick={onSimulate}
            disabled={hasBlockers}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all
              ${
                hasBlockers
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'btn-simulate'
              }
            `}
          >
            <Play className="w-4 h-4" />
            Simulate This Change
          </button>

          {/* Secondary: View Detail */}
          {onViewDetail && (
            <button
              onClick={onViewDetail}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Detail
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * FeasibilityBadge - Shows pass/fail/warning for a single check
 */
function FeasibilityBadge({ name, status, detail }: FeasibilityCheck) {
  const Icon = status === 'pass' ? CheckCircle : status === 'fail' ? XCircle : AlertTriangle;

  const bgClass =
    status === 'pass'
      ? 'feasibility-pass'
      : status === 'fail'
      ? 'feasibility-fail'
      : 'feasibility-warning';

  return (
    <div className={`feasibility-badge ${bgClass}`} title={detail}>
      <Icon className="w-3 h-3" />
      <span>{name}</span>
    </div>
  );
}

/**
 * InsightsList - Container for multiple insight cards
 */
export function InsightsList({
  title,
  insights,
  maxVisible = 3,
  onViewAll,
}: {
  title: string;
  insights: ActionableInsightProps[];
  maxVisible?: number;
  onViewAll?: () => void;
}) {
  const visibleInsights = insights.slice(0, maxVisible);
  const hiddenCount = insights.length - maxVisible;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wide">
          {title}
        </h3>
        {hiddenCount > 0 && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View all {insights.length} →
          </button>
        )}
      </div>
      <div className="space-y-3">
        {visibleInsights.map((insight, i) => (
          <ActionableInsightCard key={i} {...insight} />
        ))}
      </div>
    </div>
  );
}

export default ActionableInsightCard;
