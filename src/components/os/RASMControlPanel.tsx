'use client';

import { useState } from 'react';
import { Target, TrendingUp, TrendingDown, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { formatRASM, formatCurrency } from '@/lib/formatters';

interface RASMControlPanelProps {
  currentRASM: number;
  targetRASM: number;
  floorRASM: number;
  ceilingRASM: number;
  onTargetChange?: (target: number) => void;
  onFloorChange?: (floor: number) => void;
  onCeilingChange?: (ceiling: number) => void;
  isLocked?: boolean;
  onLockToggle?: () => void;
  dailyRevenueImpact?: number;
}

/**
 * RASMControlPanel - The global RASM control interface
 * This is the "throttle" for the entire network's revenue optimization
 */
export function RASMControlPanel({
  currentRASM,
  targetRASM,
  floorRASM,
  ceilingRASM,
  onTargetChange,
  onFloorChange: _onFloorChange,
  onCeilingChange: _onCeilingChange,
  isLocked = false,
  onLockToggle,
  dailyRevenueImpact,
}: RASMControlPanelProps) {
  // Floor/ceiling changes reserved for future implementation
  void _onFloorChange;
  void _onCeilingChange;
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState(targetRASM);

  const rasmDelta = currentRASM - targetRASM;
  const isAboveTarget = rasmDelta > 0;
  const isAtRisk = currentRASM < floorRASM;
  const deltaPercent = ((rasmDelta / targetRASM) * 100).toFixed(1);

  // Visual position of current RASM on the gauge (0-100%)
  const gaugeRange = ceilingRASM - floorRASM;
  const gaugePosition = Math.max(0, Math.min(100, ((currentRASM - floorRASM) / gaugeRange) * 100));
  const targetPosition = Math.max(0, Math.min(100, ((targetRASM - floorRASM) / gaugeRange) * 100));

  const handleTargetSave = () => {
    if (onTargetChange && editTarget !== targetRASM) {
      onTargetChange(editTarget);
    }
    setIsEditing(false);
  };

  return (
    <div className={`bg-white rounded-lg border-2 ${isAtRisk ? 'border-red-300' : 'border-slate-200'} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#002855] to-[#003d7a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-white" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            RASM Control
          </span>
        </div>
        <button
          onClick={onLockToggle}
          className={`p-1.5 rounded transition-colors ${
            isLocked
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
          title={isLocked ? 'Unlock RASM controls' : 'Lock RASM controls'}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Display */}
      <div className="p-4">
        {/* Current RASM - Big Number */}
        <div className="text-center mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Network RASM</div>
          <div className={`text-4xl font-bold ${isAtRisk ? 'text-red-600' : 'text-slate-800'}`}>
            {formatRASM(currentRASM)}
          </div>
          <div className={`flex items-center justify-center gap-1 mt-1 text-sm ${
            isAboveTarget ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {isAboveTarget ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{isAboveTarget ? '+' : ''}{deltaPercent}% vs target</span>
          </div>
        </div>

        {/* Visual Gauge */}
        <div className="relative h-8 bg-slate-100 rounded-full overflow-hidden mb-4">
          {/* Red zone (below floor) */}
          <div
            className="absolute left-0 top-0 h-full bg-red-100"
            style={{ width: '10%' }}
          />
          {/* Green zone (above target) */}
          <div
            className="absolute right-0 top-0 h-full bg-emerald-100"
            style={{ width: `${100 - targetPosition}%` }}
          />
          {/* Target line */}
          <div
            className="absolute top-0 h-full w-0.5 bg-[#002855] z-10"
            style={{ left: `${targetPosition}%` }}
          />
          {/* Current position indicator */}
          <div
            className={`absolute top-1 h-6 w-6 rounded-full shadow-md z-20 flex items-center justify-center transition-all duration-500 ${
              isAtRisk ? 'bg-red-500' : isAboveTarget ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ left: `calc(${gaugePosition}% - 12px)` }}
          >
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          {/* Scale labels */}
          <div className="absolute bottom-0 left-2 text-[10px] text-slate-400">
            {formatRASM(floorRASM)}
          </div>
          <div className="absolute bottom-0 right-2 text-[10px] text-slate-400">
            {formatRASM(ceilingRASM)}
          </div>
        </div>

        {/* Target Controls */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Floor */}
          <div className="bg-red-50 rounded-lg p-2 border border-red-100">
            <div className="text-[10px] text-red-600 uppercase tracking-wider">Floor</div>
            <div className="text-sm font-semibold text-red-700">{formatRASM(floorRASM)}</div>
          </div>

          {/* Target */}
          <div
            className={`bg-[#002855]/5 rounded-lg p-2 border-2 border-[#002855]/20 ${!isLocked ? 'cursor-pointer hover:border-[#002855]/40' : ''}`}
            onClick={() => !isLocked && setIsEditing(true)}
          >
            <div className="text-[10px] text-[#002855] uppercase tracking-wider">Target</div>
            {isEditing && !isLocked ? (
              <input
                type="number"
                value={editTarget}
                onChange={(e) => setEditTarget(parseFloat(e.target.value))}
                onBlur={handleTargetSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTargetSave()}
                className="w-full text-center text-sm font-semibold bg-white border border-[#002855] rounded px-1"
                step="0.1"
                autoFocus
              />
            ) : (
              <div className="text-sm font-semibold text-[#002855]">{formatRASM(targetRASM)}</div>
            )}
          </div>

          {/* Ceiling */}
          <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
            <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Ceiling</div>
            <div className="text-sm font-semibold text-emerald-700">{formatRASM(ceilingRASM)}</div>
          </div>
        </div>

        {/* Revenue Impact */}
        {dailyRevenueImpact !== undefined && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
              Daily Revenue Impact
            </div>
            <div className={`text-lg font-bold ${dailyRevenueImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {dailyRevenueImpact >= 0 ? '+' : ''}{formatCurrency(dailyRevenueImpact, { compact: true })}
            </div>
          </div>
        )}

        {/* Risk Alert */}
        {isAtRisk && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-700">
              RASM below floor threshold. Immediate action required.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RASMControlPanel;
