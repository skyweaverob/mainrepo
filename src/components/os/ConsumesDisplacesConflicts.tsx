'use client';

import { Plane, Users, Wrench, AlertTriangle, ArrowLeftRight, XCircle } from 'lucide-react';
import type { DecisionConsumption, DecisionConflicts, DecisionConstraint } from '@/types';

interface ConsumesDisplacesConflictsProps {
  consumes: DecisionConsumption;
  conflicts: DecisionConflicts;
  constraints: DecisionConstraint[];
  compact?: boolean;
}

/**
 * OS Primitive: Shows what a decision consumes, displaces, and conflicts with
 * This is critical for planners to understand resource tradeoffs
 */
export function ConsumesDisplacesConflictsRow({
  consumes,
  conflicts,
  constraints,
  compact = false,
}: ConsumesDisplacesConflictsProps) {
  const hasDisplacements = conflicts.displaces.length > 0;
  const hasConflicts = conflicts.conflictsWith.length > 0;
  const blockingConstraints = constraints.filter(c => c.severity === 'blocking');
  const warningConstraints = constraints.filter(c => c.severity === 'warning');

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {/* Consumes */}
        <div className="flex items-center gap-1">
          <Plane className="w-3 h-3" />
          <span>+{consumes.aircraftHoursPerDay.toFixed(1)}h/day</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>+{consumes.crewPairingsPerDay} pairs</span>
        </div>
        {hasDisplacements && (
          <div className="flex items-center gap-1 text-amber-600">
            <ArrowLeftRight className="w-3 h-3" />
            <span>Displaces {conflicts.displaces.length}</span>
          </div>
        )}
        {hasConflicts && (
          <div className="flex items-center gap-1 text-red-600">
            <XCircle className="w-3 h-3" />
            <span>Conflicts {conflicts.conflictsWith.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-3">
      {/* Consumes Section */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Consumes
        </div>
        <div className="grid grid-cols-4 gap-3">
          <ResourceChip
            icon={<Plane className="w-3.5 h-3.5" />}
            label="Aircraft"
            value={`+${consumes.aircraftHoursPerDay.toFixed(1)}h/day`}
          />
          <ResourceChip
            icon={<span className="text-xs font-bold">#</span>}
            label="Tails"
            value={`${consumes.tailsRequired} required`}
          />
          <ResourceChip
            icon={<Users className="w-3.5 h-3.5" />}
            label="Crew"
            value={`+${consumes.crewPairingsPerDay}/day`}
          />
          <ResourceChip
            icon={<Wrench className="w-3.5 h-3.5" />}
            label="MRO"
            value={consumes.mroFeasibility === 'feasible' ? 'OK' :
                   consumes.mroFeasibility === 'requires_swap' ? 'Swap' : 'Blocked'}
            status={consumes.mroFeasibility === 'feasible' ? 'ok' :
                    consumes.mroFeasibility === 'requires_swap' ? 'warning' : 'error'}
          />
        </div>
      </div>

      {/* Displaces Section */}
      {hasDisplacements && (
        <div>
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ArrowLeftRight className="w-3 h-3" />
            Displaces
          </div>
          <div className="flex flex-wrap gap-2">
            {conflicts.displaces.map((id, i) => (
              <span key={i} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts Section */}
      {hasConflicts && (
        <div>
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Conflicts With
          </div>
          <div className="flex flex-wrap gap-2">
            {conflicts.conflictsWith.map((id, i) => (
              <span key={i} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Constraints Section */}
      {(blockingConstraints.length > 0 || warningConstraints.length > 0) && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Constraints
          </div>
          <div className="space-y-1">
            {blockingConstraints.map((c, i) => (
              <ConstraintLine key={`block-${i}`} constraint={c} />
            ))}
            {warningConstraints.map((c, i) => (
              <ConstraintLine key={`warn-${i}`} constraint={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceChip({
  icon,
  label,
  value,
  status = 'ok',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status?: 'ok' | 'warning' | 'error';
}) {
  const statusColors = {
    ok: 'border-slate-200 text-slate-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 border rounded ${statusColors[status]}`}>
      <span className="text-slate-400">{icon}</span>
      <div className="text-xs">
        <div className="text-slate-500">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

function ConstraintLine({ constraint }: { constraint: DecisionConstraint }) {
  const isBlocking = constraint.severity === 'blocking';

  return (
    <div className={`flex items-start gap-2 text-xs p-2 rounded ${
      isBlocking ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
    }`}>
      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
        isBlocking ? 'text-red-500' : 'text-amber-500'
      }`} />
      <div className="flex-1">
        <div className="font-medium">{constraint.description}</div>
        {constraint.resolution && (
          <div className="text-slate-500 mt-0.5">
            Resolution: {constraint.resolution}
          </div>
        )}
      </div>
      {constraint.binding && (
        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-medium">
          BINDING
        </span>
      )}
    </div>
  );
}

export default ConsumesDisplacesConflictsRow;
