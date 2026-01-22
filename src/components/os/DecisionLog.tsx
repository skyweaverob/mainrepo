'use client';

import { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  Play,
  Clock,
  User,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { formatCurrencyDelta, formatRASMDelta, formatRelativeTime } from '@/lib/formatters';

export type LogEntryType = 'proposed' | 'simulated' | 'approved' | 'rejected' | 'executed' | 'validated' | 'reverted';

interface LogEntry {
  id: string;
  decisionId: string;
  decisionTitle: string;
  type: LogEntryType;
  timestamp: Date;
  actor: string;
  note?: string;
  revenueImpact?: number;
  rasmImpact?: number;
  validationStatus?: 'success' | 'underperformed' | 'overperformed';
}

interface DecisionLogProps {
  entries: LogEntry[];
  maxVisible?: number;
  showFilters?: boolean;
  title?: string;
}

const TYPE_CONFIG: Record<LogEntryType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  proposed: { label: 'Proposed', icon: Clock, color: 'text-slate-600', bgColor: 'bg-slate-100' },
  simulated: { label: 'Simulated', icon: Play, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  executed: { label: 'Executed', icon: Play, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  validated: { label: 'Validated', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  reverted: { label: 'Reverted', icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100' },
};

/**
 * DecisionLog - Audit trail of all decision actions
 * Provides accountability and learning from past decisions
 */
export function DecisionLog({
  entries,
  maxVisible = 10,
  showFilters = true,
  title = 'Decision Log',
}: DecisionLogProps) {
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<LogEntryType | 'all'>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Filter entries
  const filteredEntries = entries.filter((e) => filterType === 'all' || e.type === filterType);

  // Sort by timestamp (newest first)
  const sortedEntries = [...filteredEntries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Visible entries
  const visibleEntries = showAll ? sortedEntries : sortedEntries.slice(0, maxVisible);
  const hasMore = sortedEntries.length > maxVisible;

  // Calculate stats
  const stats = {
    total: entries.length,
    approved: entries.filter((e) => e.type === 'approved').length,
    rejected: entries.filter((e) => e.type === 'rejected').length,
    executed: entries.filter((e) => e.type === 'executed').length,
    validated: entries.filter((e) => e.type === 'validated').length,
  };

  const totalRevenueImpact = entries
    .filter((e) => e.type === 'validated' && e.revenueImpact)
    .reduce((sum, e) => sum + (e.revenueImpact || 0), 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#002855] to-[#003d7a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-white" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">{title}</span>
        </div>
        <span className="text-xs text-white/70">{entries.length} entries</span>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Approved:</span>
          <span className="font-medium text-emerald-600">{stats.approved}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Rejected:</span>
          <span className="font-medium text-red-600">{stats.rejected}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Executed:</span>
          <span className="font-medium text-purple-600">{stats.executed}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Net Impact:</span>
          <span className={`font-bold ${totalRevenueImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrencyDelta(totalRevenueImpact, { compact: true })}
          </span>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {(['all', 'proposed', 'approved', 'rejected', 'executed', 'validated'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`text-xs px-2 py-1 rounded whitespace-nowrap transition-colors ${
                filterType === type ? 'bg-[#002855] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {type === 'all' ? 'All' : TYPE_CONFIG[type]?.label || type}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="divide-y divide-slate-100">
        {visibleEntries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-500">No log entries</p>
          </div>
        ) : (
          visibleEntries.map((entry) => {
            const config = TYPE_CONFIG[entry.type];
            const Icon = config.icon;
            const isExpanded = expandedEntry === entry.id;

            return (
              <div
                key={entry.id}
                className="px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-full ${config.bgColor} flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 truncate">{entry.decisionTitle}</p>

                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500">{entry.actor}</span>

                      {entry.revenueImpact && (
                        <span className={`text-xs font-medium ${entry.revenueImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {entry.revenueImpact >= 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                          {' '}{formatCurrencyDelta(entry.revenueImpact, { compact: true })}
                        </span>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-2">
                        {entry.note && (
                          <p className="text-slate-600">{entry.note}</p>
                        )}
                        {entry.rasmImpact && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">RASM Impact:</span>
                            <span className={entry.rasmImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                              {formatRASMDelta(entry.rasmImpact)}
                            </span>
                          </div>
                        )}
                        {entry.validationStatus && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">Outcome:</span>
                            <span className={
                              entry.validationStatus === 'success' ? 'text-emerald-600' :
                              entry.validationStatus === 'overperformed' ? 'text-blue-600' :
                              'text-amber-600'
                            }>
                              {entry.validationStatus === 'success' ? 'Met expectations' :
                               entry.validationStatus === 'overperformed' ? 'Exceeded expectations' :
                               'Underperformed'}
                            </span>
                          </div>
                        )}
                        <div className="text-slate-400">
                          {entry.timestamp.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expand indicator */}
                  <div className="flex-shrink-0 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Show More */}
      {hasMore && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-2 text-sm text-[#002855] hover:text-[#001a3d] font-medium"
          >
            {showAll ? 'Show Less' : `Show ${sortedEntries.length - maxVisible} More`}
          </button>
        </div>
      )}
    </div>
  );
}

export default DecisionLog;
