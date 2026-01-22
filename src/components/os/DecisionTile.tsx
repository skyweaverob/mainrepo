'use client';

import { useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Play,
  ArrowLeftRight,
  TrendingDown,
  Minimize2,
  Maximize2,
  LogOut,
  Plus,
  Shuffle,
  DollarSign,
  XCircle,
} from 'lucide-react';
import { formatCurrencyDelta, formatRASMDelta } from '@/lib/formatters';
import { ConsumesDisplacesConflictsRow } from './ConsumesDisplacesConflicts';
import type {
  DecisionStatus,
  DecisionPriority,
  DecisionCategory,
  DecisionConsumption,
  DecisionConflicts,
  DecisionConstraint,
  DecisionEvidence,
} from '@/types';

// Re-export types for backwards compatibility
export type { DecisionStatus, DecisionPriority, DecisionCategory } from '@/types';

interface DecisionTileProps {
  id: string;
  title: string;
  description: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  status: DecisionStatus;

  // Impact metrics
  revenueImpact: number; // Daily $ impact
  rasmImpact: number; // Cents change
  asmDelta?: number; // ASM change

  // Current vs proposed
  currentState: string;
  proposedState: string;

  // OS Primitives: Resource consumption
  consumes?: DecisionConsumption;
  conflicts?: DecisionConflicts;
  osConstraints?: DecisionConstraint[];

  // Evidence
  evidence?: DecisionEvidence;

  // Confidence
  confidence?: 'high' | 'medium' | 'low';

  // Legacy: simple constraints and risks (for backwards compat)
  constraints?: string[];
  risks?: string[];

  // Ownership
  owner?: string;
  dueDate?: Date;

  // Actions
  onApprove?: () => void;
  onReject?: () => void;
  onSimulate?: () => void;
  onExecute?: () => void;
  onExpand?: () => void;

  // UI
  expanded?: boolean;
  showActions?: boolean;
}

const PRIORITY_CONFIG: Record<DecisionPriority, { color: string; bgColor: string; label: string }> = {
  critical: { color: 'text-red-700', bgColor: 'bg-red-100', label: 'CRITICAL' },
  high: { color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'HIGH' },
  medium: { color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'MEDIUM' },
  low: { color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'LOW' },
};

const STATUS_CONFIG: Record<DecisionStatus, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  proposed: { color: 'text-slate-600', bgColor: 'bg-slate-100', icon: Clock },
  simulated: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Play },
  approved: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircle2 },
  queued: { color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Clock },
  executing: { color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Play },
  implemented: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircle2 },
  completed: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: CheckCircle2 },
  validated: { color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: CheckCircle2 },
  rejected: { color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle },
  rolled_back: { color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertTriangle },
};

// New OS taxonomy with icons (no emojis for professional look)
const CATEGORY_CONFIG: Record<DecisionCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  capacity_reallocation: { label: 'Reallocation', icon: ArrowLeftRight },
  frequency_reduction: { label: 'Freq Reduction', icon: TrendingDown },
  downgauge: { label: 'Downgauge', icon: Minimize2 },
  upgauge: { label: 'Upgauge', icon: Maximize2 },
  retiming: { label: 'Retiming', icon: Clock },
  market_exit: { label: 'Market Exit', icon: LogOut },
  market_entry: { label: 'Market Entry', icon: Plus },
  tail_swap: { label: 'Tail Swap', icon: Shuffle },
  rm_action: { label: 'RM Action', icon: DollarSign },
  do_not_do: { label: 'Do Not Do', icon: XCircle },
};

/**
 * DecisionTile - The atomic unit of the decision OS
 * Each tile represents a single actionable decision with clear impact metrics
 */
export function DecisionTile({
  id,
  title,
  description,
  category,
  priority,
  status,
  revenueImpact,
  rasmImpact,
  asmDelta,
  currentState,
  proposedState,
  consumes,
  conflicts,
  osConstraints,
  evidence,
  confidence,
  constraints = [],
  risks = [],
  owner,
  dueDate,
  onApprove,
  onReject,
  onSimulate,
  onExecute,
  onExpand,
  expanded = false,
  showActions = true,
}: DecisionTileProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const priorityConfig = PRIORITY_CONFIG[priority];
  const statusConfig = STATUS_CONFIG[status];
  const categoryConfig = CATEGORY_CONFIG[category];
  const StatusIcon = statusConfig.icon;
  const CategoryIcon = categoryConfig.icon;

  const isPositiveImpact = revenueImpact > 0;
  const annualImpact = revenueImpact * 365;
  const hasOSPrimitives = consumes && conflicts && osConstraints;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    onExpand?.();
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-sm transition-all hover:shadow-md ${
        priority === 'critical' ? 'border-red-300' : 'border-slate-200'
      }`}
    >
      {/* Header - Priority Band */}
      <div className={`h-1 rounded-t-lg ${priorityConfig.bgColor}`} />

      {/* Main Content */}
      <div className="p-4">
        {/* Top Row: Category, Priority, Status, Confidence */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CategoryIcon className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {categoryConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {confidence && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {confidence.toUpperCase()} CONF
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
            <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-sm text-slate-600 mb-3">{description}</p>

        {/* Impact Metrics - THE KEY DIFFERENTIATOR */}
        <div className={`grid ${asmDelta !== undefined ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4`}>
          <div className={`p-3 rounded-lg ${isPositiveImpact ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Profit/Day</div>
            <div className={`text-xl font-bold ${isPositiveImpact ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrencyDelta(revenueImpact, { compact: true })}
            </div>
            <div className="text-[10px] text-slate-500">
              Annual: {formatCurrencyDelta(annualImpact, { compact: true })}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${rasmImpact >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">RASM Delta</div>
            <div className={`text-xl font-bold ${rasmImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatRASMDelta(rasmImpact)}
            </div>
            <div className="text-[10px] text-slate-500">per ASM</div>
          </div>
          {asmDelta !== undefined && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">ASM Delta</div>
              <div className="text-xl font-bold text-slate-700">
                {asmDelta >= 0 ? '+' : ''}{(asmDelta / 1000).toFixed(0)}K
              </div>
              <div className="text-[10px] text-slate-500">capacity change</div>
            </div>
          )}
        </div>

        {/* State Change */}
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm mb-3">
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 uppercase">Current</div>
            <div className="text-slate-700 font-medium">{currentState}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 text-right">
            <div className="text-[10px] text-slate-500 uppercase">Proposed</div>
            <div className="text-[#002855] font-medium">{proposedState}</div>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="border-t border-slate-100 pt-3 mt-3 space-y-3">
            {/* OS Primitives: Consumes/Displaces/Conflicts */}
            {hasOSPrimitives && (
              <ConsumesDisplacesConflictsRow
                consumes={consumes!}
                conflicts={conflicts!}
                constraints={osConstraints!}
              />
            )}

            {/* Evidence */}
            {evidence && (
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Evidence
                </div>
                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  {evidence.explanation}
                  {evidence.load_factor !== undefined && (
                    <span className="ml-2 text-slate-500">
                      • LF: {evidence.load_factor.toFixed(0)}%
                    </span>
                  )}
                  {evidence.spill_rate !== undefined && (
                    <span className="ml-2 text-slate-500">
                      • Spill: {evidence.spill_rate.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Legacy Constraints */}
            {constraints.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Constraints Validated
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {constraints.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {risks.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Risks to Monitor
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {risks.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded border border-amber-100"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Owner & Due */}
            {(owner || dueDate) && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                {owner && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{owner}</span>
                  </div>
                )}
                {dueDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Due: {dueDate.toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={toggleExpand}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isExpanded ? 'Less' : 'More'}
            </button>

            <div className="flex items-center gap-2">
              {status === 'proposed' && onSimulate && (
                <button
                  onClick={onSimulate}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Simulate
                </button>
              )}
              {(status === 'proposed' || status === 'simulated') && (
                <>
                  {onReject && (
                    <button
                      onClick={onReject}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                    >
                      Reject
                    </button>
                  )}
                  {onApprove && (
                    <button
                      onClick={onApprove}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#002855] rounded hover:bg-[#001a3d] transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Approve
                    </button>
                  )}
                </>
              )}
              {status === 'approved' && onExecute && (
                <button
                  onClick={onExecute}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Execute
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DecisionTile;
