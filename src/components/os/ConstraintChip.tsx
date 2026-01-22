'use client';

import { CheckCircle2, AlertTriangle, XCircle, Clock, Plane, Users, Wrench, DollarSign } from 'lucide-react';

export type ConstraintStatus = 'satisfied' | 'warning' | 'violated' | 'checking';
export type ConstraintType = 'fleet' | 'crew' | 'mro' | 'rasm' | 'capacity' | 'slot' | 'custom';

interface ConstraintChipProps {
  type: ConstraintType;
  label: string;
  status: ConstraintStatus;
  detail?: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

const TYPE_ICONS: Record<ConstraintType, React.ComponentType<{ className?: string }>> = {
  fleet: Plane,
  crew: Users,
  mro: Wrench,
  rasm: DollarSign,
  capacity: Plane,
  slot: Clock,
  custom: CheckCircle2,
};

const STATUS_CONFIG: Record<ConstraintStatus, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  satisfied: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  warning: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
  violated: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  checking: { color: 'text-slate-500', bgColor: 'bg-slate-50 border-slate-200', icon: Clock },
};

/**
 * ConstraintChip - Visual indicator for constraint status
 * Makes constraints visible and actionable
 */
export function ConstraintChip({
  type,
  label,
  status,
  detail,
  onClick,
  size = 'md',
}: ConstraintChipProps) {
  const TypeIcon = TYPE_ICONS[type];
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-[10px] gap-1'
    : 'px-3 py-1.5 text-xs gap-1.5';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center ${sizeClasses} rounded-full border ${statusConfig.bgColor} ${statusConfig.color} font-medium transition-all ${
        onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'
      } ${status === 'checking' ? 'animate-pulse' : ''}`}
      title={detail}
    >
      <TypeIcon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
      <StatusIcon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    </button>
  );
}

/**
 * ConstraintBar - A row of constraint chips
 */
interface ConstraintBarProps {
  constraints: Array<{
    type: ConstraintType;
    label: string;
    status: ConstraintStatus;
    detail?: string;
  }>;
  size?: 'sm' | 'md';
  onConstraintClick?: (type: ConstraintType) => void;
}

export function ConstraintBar({ constraints, size = 'md', onConstraintClick }: ConstraintBarProps) {
  const satisfiedCount = constraints.filter((c) => c.status === 'satisfied').length;
  const warningCount = constraints.filter((c) => c.status === 'warning').length;
  const violatedCount = constraints.filter((c) => c.status === 'violated').length;

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500 font-medium">Constraints:</span>
        <span className="text-emerald-600">{satisfiedCount} OK</span>
        {warningCount > 0 && <span className="text-amber-600">{warningCount} Warning</span>}
        {violatedCount > 0 && <span className="text-red-600">{violatedCount} Violated</span>}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {constraints.map((constraint, i) => (
          <ConstraintChip
            key={i}
            {...constraint}
            size={size}
            onClick={onConstraintClick ? () => onConstraintClick(constraint.type) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default ConstraintChip;
