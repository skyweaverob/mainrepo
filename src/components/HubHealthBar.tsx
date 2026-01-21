'use client';

import { useMemo } from 'react';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { HubHealth } from '@/lib/liveDataStore';
import { AlertTriangle } from 'lucide-react';

interface HubHealthBarProps {
  hubs: HubHealth[];
  totalRevenue: number;
  revenueDelta: number;
  onHubClick?: (hubCode: string) => void;
  selectedHub?: string | null;
}

/**
 * HubHealthBar - Horizontal bar showing daily revenue per hub
 * Appears in the global header (Row 3)
 */
export function HubHealthBar({
  hubs,
  totalRevenue,
  revenueDelta,
  onHubClick,
  selectedHub,
}: HubHealthBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 border-y border-slate-700/50">
      {/* Network total */}
      <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
        <span className="text-xs text-slate-400 font-medium">Network:</span>
        <span className="text-sm font-bold text-white">
          {formatCurrency(totalRevenue, { compact: true })}
        </span>
        <span
          className={`text-xs font-medium ${
            revenueDelta > 0 ? 'text-emerald-400' : revenueDelta < 0 ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          {revenueDelta > 0 ? '▲' : revenueDelta < 0 ? '▼' : ''}
          {Math.abs(revenueDelta).toFixed(1)}%
        </span>
      </div>

      {/* Hub segments */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {hubs.map((hub) => (
          <HubSegment
            key={hub.code}
            hub={hub}
            onClick={() => onHubClick?.(hub.code)}
            isSelected={selectedHub === hub.code}
          />
        ))}
      </div>
    </div>
  );
}

interface HubSegmentProps {
  hub: HubHealth;
  onClick?: () => void;
  isSelected?: boolean;
}

function HubSegment({ hub, onClick, isSelected }: HubSegmentProps) {
  const colorClass = useMemo(() => {
    // Color based on RASM performance
    if (hub.rasmCents >= 12) return 'text-emerald-400';
    if (hub.rasmCents >= 10) return 'text-amber-400';
    return 'text-red-400';
  }, [hub.rasmCents]);

  const bgClass = useMemo(() => {
    if (isSelected) return 'bg-blue-500/20 border-blue-500/40';
    if (hub.hasAlert) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-slate-700/30 border-slate-600/30 hover:bg-slate-700/50';
  }, [isSelected, hub.hasAlert]);

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors
        ${bgClass}
      `}
      title={`${hub.name} - RASM: ${hub.rasmCents.toFixed(1)}¢`}
    >
      {/* Alert indicator */}
      {hub.hasAlert && (
        <AlertTriangle className="w-3 h-3 text-amber-400" />
      )}

      {/* Hub code */}
      <span className="text-xs font-bold text-white">
        {hub.code}
      </span>

      {/* Revenue */}
      <span className={`text-xs font-medium ${colorClass}`}>
        {formatCurrency(hub.dailyRevenue, { compact: true })}
      </span>

      {/* Delta indicator */}
      {hub.revenueDelta !== 0 && (
        <span
          className={`text-[10px] ${
            hub.revenueDelta > 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {hub.revenueDelta > 0 ? '▲' : '▼'}
        </span>
      )}
    </button>
  );
}

/**
 * Compact hub health indicator for use in tighter spaces
 */
export function HubHealthCompact({
  hubs,
  onHubClick,
}: {
  hubs: HubHealth[];
  onHubClick?: (hubCode: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {hubs.map((hub) => {
        const colorClass =
          hub.rasmCents >= 12
            ? 'bg-emerald-500'
            : hub.rasmCents >= 10
            ? 'bg-amber-500'
            : 'bg-red-500';

        return (
          <button
            key={hub.code}
            onClick={() => onHubClick?.(hub.code)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-700/50 transition-colors"
            title={`${hub.name}: ${formatCurrency(hub.dailyRevenue, { compact: true })} daily`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
            <span className="text-[10px] font-medium text-slate-400">
              {hub.code}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default HubHealthBar;
