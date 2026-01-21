'use client';

import { useMemo } from 'react';
import { Lock, Bell, Settings, Plane } from 'lucide-react';
import { useLiveDataStore } from '@/lib/liveDataStore';
import { LiveFeedIndicator, LiveStatusBadge } from './LiveFeedIndicator';
import { HubHealthBar } from './HubHealthBar';
import { formatTimestamp } from '@/lib/formatters';

interface GlobalHeaderProps {
  onHubClick?: (hubCode: string) => void;
  onSettingsClick?: () => void;
  onAlertsClick?: () => void;
  selectedHub?: string | null;
}

/**
 * GlobalHeader - The persistent 120px header showing:
 * Row 1: Logo + Tagline + Security
 * Row 2: Live feed status
 * Row 3: Hub health bar
 * Row 4: Alerts + Settings
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

  const allFeedsConnected = connectedFeedsCount === 4;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[120px] bg-slate-900 border-b border-slate-700">
      {/* Row 1: Brand + Security (32px) */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-slate-800">
        {/* Logo + Tagline */}
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Plane className="w-4 h-4 text-white transform -rotate-45" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              SkyWeave
            </span>
          </div>

          {/* Tagline */}
          <span className="text-xs text-slate-400 hidden md:block">
            Turn your schedule into a revenue instrument
          </span>
        </div>

        {/* Security Badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/50 cursor-pointer hover:bg-slate-700/50 transition-colors"
          title="Your data is encrypted end-to-end and isolated from other customers. SOC 2 Type II compliant."
        >
          <Lock className="w-3 h-3 text-emerald-400" />
          <span className="text-xs text-slate-400">Secure</span>
        </div>
      </div>

      {/* Row 2: Live Feed Status (28px) */}
      <div className="h-7 flex items-center justify-between px-4 bg-slate-800/30 border-b border-slate-800">
        {/* Live status badge */}
        <LiveStatusBadge
          isLive={allFeedsConnected}
          feedsConnected={connectedFeedsCount}
          totalFeeds={4}
        />

        {/* Individual feed indicators */}
        <div className="flex items-center gap-3">
          <FeedIndicatorCompact
            name="Fares"
            lastUpdate={feeds.fares.lastUpdate}
            isConnected={feeds.fares.isConnected}
          />
          <FeedIndicatorCompact
            name="Flights"
            lastUpdate={feeds.flights.lastUpdate}
            isConnected={feeds.flights.isConnected}
          />
          <FeedIndicatorCompact
            name="Bookings"
            lastUpdate={feeds.bookings.lastUpdate}
            isConnected={feeds.bookings.isConnected}
          />
          <FeedIndicatorCompact
            name="Events"
            lastUpdate={feeds.events.lastUpdate}
            isConnected={feeds.events.isConnected}
          />
        </div>

        {/* Last update timestamp */}
        <div className="text-xs text-slate-500 font-mono hidden lg:block">
          Last update: {formatTimestamp(lastGlobalUpdate)}
        </div>
      </div>

      {/* Row 3: Hub Health Bar (36px) */}
      <div className="h-9">
        {networkHealth && (
          <HubHealthBar
            hubs={networkHealth.hubs}
            totalRevenue={networkHealth.totalDailyRevenue}
            revenueDelta={networkHealth.revenueDelta}
            onHubClick={onHubClick}
            selectedHub={selectedHub}
          />
        )}
      </div>

      {/* Row 4: Alerts + Settings (24px) */}
      <div className="h-6 flex items-center justify-end px-4 gap-3 bg-slate-800/20">
        {/* Alert bell */}
        <button
          onClick={onAlertsClick}
          className="relative flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-700/50 transition-colors"
        >
          <Bell className="w-3.5 h-3.5 text-slate-400" />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {alerts.length > 0 ? `${alerts.length} Alerts` : 'No Alerts'}
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-700/50 transition-colors"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Settings</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Compact feed indicator for the header
 */
function FeedIndicatorCompact({
  name,
  lastUpdate,
  isConnected,
}: {
  name: string;
  lastUpdate: Date | null;
  isConnected: boolean;
}) {
  const ageSeconds = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : Infinity;

  const dotClass = useMemo(() => {
    if (!isConnected) return 'bg-slate-500';
    if (ageSeconds < 30) return 'bg-emerald-500 animate-pulse';
    if (ageSeconds < 120) return 'bg-amber-500';
    return 'bg-red-500';
  }, [isConnected, ageSeconds]);

  const timeDisplay = useMemo(() => {
    if (!lastUpdate) return '-';
    if (ageSeconds < 60) return `${ageSeconds}s`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m`;
    return `${Math.floor(ageSeconds / 3600)}h`;
  }, [lastUpdate, ageSeconds]);

  return (
    <div
      className="flex items-center gap-1.5"
      title={`${name}: Last updated ${lastUpdate?.toLocaleString() || 'never'}`}
    >
      <span className="text-xs text-slate-500">{name}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span className="text-xs font-mono text-slate-400">{timeDisplay}</span>
    </div>
  );
}

export default GlobalHeader;
