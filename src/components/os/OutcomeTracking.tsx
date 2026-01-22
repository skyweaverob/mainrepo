'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Check, Clock } from 'lucide-react';
import { formatCurrencyDelta } from '@/lib/formatters';

export interface TrackedOutcome {
  decisionId: string;
  decisionTitle: string;
  executedAt: Date;
  trackingPeriodDays: number;
  predicted: {
    revenueImpact: number;
    rasmImpact: number;
  };
  actual: {
    revenueImpact: number;
    rasmImpact: number;
  };
  variance: {
    revenue: number; // percentage
    rasm: number; // percentage
  };
  status: 'tracking' | 'validated' | 'underperformed' | 'outperformed';
}

interface OutcomeTrackingProps {
  outcomes: TrackedOutcome[];
  compact?: boolean;
}

export function OutcomeTracking({ outcomes, compact = false }: OutcomeTrackingProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (outcomes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Outcome Tracking</h3>
        <p className="text-sm text-slate-400">No decisions completed for tracking yet.</p>
      </div>
    );
  }

  const stats = {
    totalTracked: outcomes.length,
    validated: outcomes.filter(o => o.status === 'validated').length,
    outperformed: outcomes.filter(o => o.status === 'outperformed').length,
    underperformed: outcomes.filter(o => o.status === 'underperformed').length,
    avgAccuracy: outcomes.length > 0
      ? Math.round(100 - outcomes.reduce((sum, o) => sum + Math.abs(o.variance.revenue), 0) / outcomes.length)
      : 0,
  };

  const getStatusConfig = (status: TrackedOutcome['status']) => {
    switch (status) {
      case 'outperformed':
        return { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Beat' };
      case 'validated':
        return { icon: Check, color: 'text-blue-600', bg: 'bg-blue-50', label: 'On Track' };
      case 'underperformed':
        return { icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Below' };
      case 'tracking':
      default:
        return { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Tracking' };
    }
  };

  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 uppercase">ML Accuracy</span>
          <span className="text-sm font-bold text-[#002855]">{stats.avgAccuracy}%</span>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-emerald-600">{stats.outperformed} beat</span>
          <span className="text-blue-600">{stats.validated} on-track</span>
          <span className="text-amber-600">{stats.underperformed} below</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Decision Outcomes</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{stats.totalTracked} tracked</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              stats.avgAccuracy >= 85 ? 'bg-emerald-100 text-emerald-700' :
              stats.avgAccuracy >= 70 ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {stats.avgAccuracy}% accuracy
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {outcomes.slice(0, 5).map((outcome) => {
          const config = getStatusConfig(outcome.status);
          const Icon = config.icon;
          const isExpanded = expanded === outcome.decisionId;

          return (
            <div key={outcome.decisionId}>
              <button
                onClick={() => setExpanded(isExpanded ? null : outcome.decisionId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">{outcome.decisionTitle}</p>
                    <p className="text-xs text-slate-500">
                      {outcome.trackingPeriodDays} days tracked
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${
                    outcome.variance.revenue > 0 ? 'text-emerald-600' :
                    outcome.variance.revenue < -10 ? 'text-red-600' :
                    'text-slate-600'
                  }`}>
                    {outcome.variance.revenue > 0 ? '+' : ''}{outcome.variance.revenue.toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-400">{config.label}</p>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-1 bg-slate-50">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 mb-1">Predicted</p>
                      <p className="font-medium">{formatCurrencyDelta(outcome.predicted.revenueImpact, { compact: true })}/day</p>
                      <p className="text-slate-500">{outcome.predicted.rasmImpact > 0 ? '+' : ''}{outcome.predicted.rasmImpact.toFixed(2)}¢ RASM</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">Actual</p>
                      <p className="font-medium">{formatCurrencyDelta(outcome.actual.revenueImpact, { compact: true })}/day</p>
                      <p className="text-slate-500">{outcome.actual.rasmImpact > 0 ? '+' : ''}{outcome.actual.rasmImpact.toFixed(2)}¢ RASM</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OutcomeTracking;
