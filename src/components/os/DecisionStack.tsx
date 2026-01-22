'use client';

import { useState } from 'react';
import { Layers, ChevronRight, Filter } from 'lucide-react';
import { DecisionTile, DecisionStatus, DecisionPriority, DecisionCategory } from './DecisionTile';
import { formatCurrency } from '@/lib/formatters';

export interface Decision {
  id: string;
  title: string;
  description: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  status: DecisionStatus;
  revenueImpact: number;
  rasmImpact: number;
  currentState: string;
  proposedState: string;
  constraints?: string[];
  risks?: string[];
  owner?: string;
  dueDate?: Date;
}

interface DecisionStackProps {
  title: string;
  subtitle?: string;
  decisions: Decision[];
  onDecisionApprove?: (id: string) => void;
  onDecisionReject?: (id: string) => void;
  onDecisionSimulate?: (id: string) => void;
  onDecisionExecute?: (id: string) => void;
  maxVisible?: number;
  showSummary?: boolean;
  sortBy?: 'priority' | 'impact' | 'date';
  filterStatus?: DecisionStatus[];
}

/**
 * DecisionStack - A grouped collection of related decisions
 * Shows aggregate impact and allows batch operations
 */
export function DecisionStack({
  title,
  subtitle,
  decisions,
  onDecisionApprove,
  onDecisionReject,
  onDecisionSimulate,
  onDecisionExecute,
  maxVisible = 5,
  showSummary = true,
  sortBy = 'impact',
  filterStatus,
}: DecisionStackProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<DecisionStatus | 'all'>('all');

  // Filter decisions
  const filteredDecisions = decisions.filter((d) => {
    if (filterStatus && !filterStatus.includes(d.status)) return false;
    if (selectedFilter !== 'all' && d.status !== selectedFilter) return false;
    return true;
  });

  // Sort decisions
  const sortedDecisions = [...filteredDecisions].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'impact':
        return Math.abs(b.revenueImpact) - Math.abs(a.revenueImpact);
      case 'date':
        return (b.dueDate?.getTime() || 0) - (a.dueDate?.getTime() || 0);
      default:
        return 0;
    }
  });

  // Visible decisions
  const visibleDecisions = showAll ? sortedDecisions : sortedDecisions.slice(0, maxVisible);
  const hasMore = sortedDecisions.length > maxVisible;

  // Calculate aggregate metrics
  const totalRevenue = sortedDecisions.reduce((sum, d) => sum + d.revenueImpact, 0);
  const avgRasmImpact =
    sortedDecisions.length > 0
      ? sortedDecisions.reduce((sum, d) => sum + d.rasmImpact, 0) / sortedDecisions.length
      : 0;
  const pendingCount = sortedDecisions.filter((d) => d.status === 'proposed' || d.status === 'simulated').length;
  const criticalCount = sortedDecisions.filter((d) => d.priority === 'critical').length;

  // Status counts for filter
  const statusCounts = {
    all: decisions.length,
    proposed: decisions.filter((d) => d.status === 'proposed').length,
    simulated: decisions.filter((d) => d.status === 'simulated').length,
    approved: decisions.filter((d) => d.status === 'approved').length,
    executing: decisions.filter((d) => d.status === 'executing').length,
    completed: decisions.filter((d) => d.status === 'completed').length,
    rejected: decisions.filter((d) => d.status === 'rejected').length,
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#002855] to-[#003d7a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-white" />
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {subtitle && <p className="text-xs text-blue-200">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="text-xs font-bold px-2 py-1 bg-red-500 text-white rounded">
              {criticalCount} CRITICAL
            </span>
          )}
          <span className="text-xs text-white/70">{sortedDecisions.length} decisions</span>
        </div>
      </div>

      {/* Summary Metrics */}
      {showSummary && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Daily Impact</div>
            <div className={`text-lg font-bold ${totalRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalRevenue >= 0 ? '+' : ''}{formatCurrency(totalRevenue, { compact: true })}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Avg RASM Impact</div>
            <div className={`text-lg font-bold ${avgRasmImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {avgRasmImpact >= 0 ? '+' : ''}{avgRasmImpact.toFixed(2)}¢
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pending Actions</div>
            <div className="text-lg font-bold text-amber-600">{pendingCount}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Annual Potential</div>
            <div className={`text-lg font-bold ${totalRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalRevenue >= 0 ? '+' : ''}{formatCurrency(totalRevenue * 365, { compact: true })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        {(['all', 'proposed', 'simulated', 'approved', 'executing', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setSelectedFilter(status)}
            disabled={statusCounts[status] === 0}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap transition-colors ${
              selectedFilter === status
                ? 'bg-[#002855] text-white'
                : statusCounts[status] > 0
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Decision List */}
      <div className="divide-y divide-slate-100">
        {visibleDecisions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">No decisions match the current filter</p>
          </div>
        ) : (
          visibleDecisions.map((decision) => (
            <div key={decision.id} className="p-4">
              <DecisionTile
                {...decision}
                onApprove={onDecisionApprove ? () => onDecisionApprove(decision.id) : undefined}
                onReject={onDecisionReject ? () => onDecisionReject(decision.id) : undefined}
                onSimulate={onDecisionSimulate ? () => onDecisionSimulate(decision.id) : undefined}
                onExecute={onDecisionExecute ? () => onDecisionExecute(decision.id) : undefined}
              />
            </div>
          ))
        )}
      </div>

      {/* Show More */}
      {hasMore && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-2 text-sm text-[#002855] hover:text-[#001a3d] font-medium"
          >
            {showAll ? (
              <>Show Less</>
            ) : (
              <>
                Show {sortedDecisions.length - maxVisible} More
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default DecisionStack;
