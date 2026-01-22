'use client';

import { useMemo } from 'react';
import { Lock, Bell, Settings, Plane } from 'lucide-react';
import { useLiveDataStore } from '@/lib/liveDataStore';
import { formatTimestamp } from '@/lib/formatters';

interface GlobalHeaderProps {
  onHubClick?: (hubCode: string) => void;
  onSettingsClick?: () => void;
  onAlertsClick?: () => void;
  selectedHub?: string | null;
}

/**
 * GlobalHeader - McKinsey-style clean header
 * Navy blue brand bar with white content area
 */
export function GlobalHeader({
  onHubClick,
  onSettingsClick,
  onAlertsClick,
  selectedHub,
}: GlobalHeaderProps) {
  const {
    feeds,
    isConnected,
    networkHealth,
    alerts,
    unreadAlertCount,
    lastGlobalUpdate,
  } = useLiveDataStore();

  const connectedFeedsCount = useMemo(() => {
    return Object.values(feeds).filter((f) => f.isConnected).length;
  }, [feeds]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[120px] bg-white border-b border-slate-200 shadow-sm">
      {/* Row 1: Navy Brand Bar (40px) */}
      <div className="h-10 bg-[#002855] flex items-center justify-between px-6">
        {/* Logo + Tagline */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
              <Plane className="w-4 h-4 text-white transform -rotate-45" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              SkyWeave
            </span>
          </div>
          <span className="text-xs text-blue-200 hidden md:block">
            Turn your schedule into a revenue instrument
          </span>
        </div>

        {/* Security + Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/10">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            <span className="text-xs text-blue-200">
              {connectedFeedsCount}/4 feeds
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-blue-200">Secure</span>
          </div>
        </div>
      </div>

      {/* Row 2: Hub Performance Bar (50px) */}
      <div className="h-[50px] flex items-center px-6 gap-4 bg-slate-50 border-b border-slate-200">
        {/* Network RASM */}
        <div className="flex items-center gap-3">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">RASM</span>
            <span className="ml-2 text-xl font-bold text-[#002855]">
              {networkHealth?.hubs?.[0]?.rasmCents?.toFixed(1) || '13.4'}¢
            </span>
          </div>
          <div className="h-6 w-px bg-slate-300" />
          <div>
            <span className="text-xs text-slate-500">Daily</span>
            <span className="ml-2 text-sm font-semibold text-slate-700">
              ${((networkHealth?.totalDailyRevenue || 2900000) / 1000000).toFixed(1)}M
            </span>
          </div>
        </div>

        {/* Hub Pills */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {(networkHealth?.hubs || [
            { code: 'DTW', rasmCents: 8.8, dailyRevenue: 303000, name: 'Detroit', revenueDelta: null },
            { code: 'MCO', rasmCents: 9.4, dailyRevenue: 739000, name: 'Orlando', revenueDelta: null },
            { code: 'FLL', rasmCents: 13.5, dailyRevenue: 180000, name: 'Fort Lauderdale', revenueDelta: null },
            { code: 'LAS', rasmCents: 28.9, dailyRevenue: 540000, name: 'Las Vegas', revenueDelta: null },
            { code: 'EWR', rasmCents: 11.4, dailyRevenue: 32000, name: 'Newark', revenueDelta: null },
            { code: 'P2P', rasmCents: 9.8, dailyRevenue: 1100000, name: 'Point-to-Point', revenueDelta: null },
          ]).map((hub) => (
            <button
              key={hub.code}
              onClick={() => onHubClick?.(hub.code)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                selectedHub === hub.code
                  ? 'bg-[#002855] text-white border-[#002855]'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#002855] hover:bg-blue-50'
              }`}
            >
              <span className="font-semibold text-sm">{hub.code}</span>
              <span className={`text-xs ${selectedHub === hub.code ? 'text-blue-200' : 'text-slate-500'}`}>
                {hub.rasmCents?.toFixed(1) || '0.0'}¢
              </span>
              <span className={`text-xs ${selectedHub === hub.code ? 'text-blue-300' : 'text-slate-400'}`}>
                ${((hub.dailyRevenue || 0) / 1000).toFixed(0)}K
              </span>
            </button>
          ))}
        </div>

        {/* Alerts + Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAlertsClick}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-4 h-4 text-slate-500" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
              </span>
            )}
            <span className="text-xs text-slate-600">{alerts.length} Alerts</span>
          </button>
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-600">Settings</span>
          </button>
        </div>
      </div>

      {/* Row 3: Feed Status Bar (30px) */}
      <div className="h-[30px] flex items-center justify-between px-6 bg-white">
        <div className="flex items-center gap-4 text-xs">
          <FeedStatus name="Fares" feed={feeds.fares} />
          <FeedStatus name="Flights" feed={feeds.flights} />
          <FeedStatus name="Bookings" feed={feeds.bookings} />
          <FeedStatus name="Events" feed={feeds.events} />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Last update: {formatTimestamp(lastGlobalUpdate)}
        </div>
      </div>
    </header>
  );
}

function FeedStatus({ name, feed }: { name: string; feed: { lastUpdate: Date | null; isConnected: boolean } }) {
  const ageSeconds = feed.lastUpdate
    ? Math.floor((Date.now() - feed.lastUpdate.getTime()) / 1000)
    : Infinity;

  const status = !feed.isConnected ? 'offline' : ageSeconds < 60 ? 'live' : ageSeconds < 300 ? 'stale' : 'old';
  const colors = {
    live: 'bg-emerald-500',
    stale: 'bg-amber-500',
    old: 'bg-red-500',
    offline: 'bg-slate-400',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">{name}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      <span className="text-slate-400 font-mono">
        {feed.lastUpdate ? `${ageSeconds}s` : '-'}
      </span>
    </div>
  );
}

export default GlobalHeader;
