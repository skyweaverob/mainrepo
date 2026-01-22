'use client';

import { useMemo } from 'react';
import { Bell, Plane } from 'lucide-react';
import { useLiveDataStore } from '@/lib/liveDataStore';

interface GlobalHeaderProps {
  onHubClick?: (hubCode: string) => void;
  onAlertsClick?: () => void;
  selectedHub?: string | null;
}

export function GlobalHeader({ onHubClick, onAlertsClick, selectedHub }: GlobalHeaderProps) {
  const { feeds, isConnected, networkHealth, unreadAlertCount } = useLiveDataStore();

  const connectedFeedsCount = useMemo(() => {
    return Object.values(feeds).filter((f) => f.isConnected).length;
  }, [feeds]);

  const hubs = networkHealth?.hubs || [
    { code: 'DTW', rasmCents: 8.8, dailyRevenue: 303000 },
    { code: 'MCO', rasmCents: 9.4, dailyRevenue: 739000 },
    { code: 'FLL', rasmCents: 13.5, dailyRevenue: 180000 },
    { code: 'LAS', rasmCents: 28.9, dailyRevenue: 540000 },
    { code: 'EWR', rasmCents: 11.4, dailyRevenue: 32000 },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#002855] flex items-center justify-between px-4 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Plane className="w-5 h-5 text-white transform -rotate-45" />
          <span className="text-lg font-bold text-white">SkyWeave</span>
        </div>
        <div className="h-4 w-px bg-white/20" />
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
          <span className="text-xs text-blue-200">{connectedFeedsCount}/4</span>
        </div>
      </div>

      {/* RASM Hero + Hubs */}
      <div className="flex items-center gap-4">
        {/* RASM */}
        <div className="flex items-baseline gap-2 text-white">
          <span className="text-xs text-blue-200">RASM</span>
          <span className="text-xl font-bold">{networkHealth?.hubs?.[0]?.rasmCents?.toFixed(2) || '8.41'}¢</span>
          <span className="text-xs text-emerald-400">+9%</span>
        </div>

        <div className="h-6 w-px bg-white/20" />

        {/* Hubs */}
        <div className="flex gap-1">
          {hubs.map((hub) => (
            <button
              key={hub.code}
              onClick={() => onHubClick?.(hub.code)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedHub === hub.code
                  ? 'bg-white text-[#002855] font-semibold'
                  : 'text-blue-200 hover:bg-white/10'
              }`}
            >
              {hub.code} <span className="opacity-70">{hub.rasmCents?.toFixed(1)}¢</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-blue-200">
          <span>Rev: ${((networkHealth?.totalDailyRevenue || 3380000) / 1000000).toFixed(1)}M/day</span>
        </div>
        <button onClick={onAlertsClick} className="relative p-2 rounded hover:bg-white/10 transition-colors">
          <Bell className="w-4 h-4 text-white" />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export default GlobalHeader;
