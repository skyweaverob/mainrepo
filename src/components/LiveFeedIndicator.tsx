'use client';

import { useMemo } from 'react';
import { getFreshnessStatus, formatRelativeTime } from '@/lib/formatters';

interface LiveFeedIndicatorProps {
  feedName: string;
  lastUpdate: Date | null;
  isConnected?: boolean;
  recordCount?: number;
  showLabel?: boolean;
  compact?: boolean;
}

/**
 * LiveFeedIndicator - Shows the real-time status of a data feed
 *
 * States:
 * - LIVE (green pulsing): Data updated within 30 seconds
 * - AGING (yellow): Data 30s - 2min old
 * - STALE (red): Data > 2min old
 * - DISCONNECTED (gray): No connection or no data
 */
export function LiveFeedIndicator({
  feedName,
  lastUpdate,
  isConnected = true,
  recordCount,
  showLabel = true,
  compact = false,
}: LiveFeedIndicatorProps) {
  const status = useMemo(() => {
    if (!isConnected) {
      return {
        level: 'disconnected' as const,
        ageSeconds: Infinity,
        description: 'Reconnecting...',
        colorClass: 'text-slate-500',
      };
    }
    return getFreshnessStatus(lastUpdate);
  }, [lastUpdate, isConnected]);

  const dotClass = useMemo(() => {
    switch (status.level) {
      case 'live':
        return 'bg-emerald-500 animate-pulse';
      case 'aging':
        return 'bg-amber-500';
      case 'stale':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  }, [status.level]);

  const containerClass = useMemo(() => {
    switch (status.level) {
      case 'live':
        return 'bg-emerald-500/10 border-emerald-500/30';
      case 'aging':
        return 'bg-amber-500/10 border-amber-500/30';
      case 'stale':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-slate-500/10 border-slate-500/30';
    }
  }, [status.level]);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className="text-xs text-slate-400 font-mono">
          {formatRelativeTime(lastUpdate)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border ${containerClass}`}
      title={`Last updated: ${lastUpdate?.toLocaleString() || 'Never'}`}
    >
      {/* Pulsing dot */}
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />

      {/* Feed name */}
      {showLabel && (
        <span className="text-xs font-medium text-slate-300 capitalize">
          {feedName}
        </span>
      )}

      {/* Status badge */}
      {status.level === 'live' && (
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
          LIVE
        </span>
      )}

      {/* Time ago */}
      <span className={`text-xs font-mono ${status.colorClass}`}>
        {status.level === 'stale' ? status.description : formatRelativeTime(lastUpdate)}
      </span>

      {/* Record count (optional) */}
      {recordCount !== undefined && recordCount > 0 && (
        <span className="text-xs text-slate-500">
          ({recordCount.toLocaleString()})
        </span>
      )}
    </div>
  );
}

/**
 * Compact version showing just the dot and time for use in dense layouts
 */
export function LiveDot({
  lastUpdate,
  isConnected = true,
}: {
  lastUpdate: Date | null;
  isConnected?: boolean;
}) {
  const status = useMemo(() => {
    if (!isConnected) {
      return { level: 'disconnected' as const };
    }
    return getFreshnessStatus(lastUpdate);
  }, [lastUpdate, isConnected]);

  const dotClass = useMemo(() => {
    switch (status.level) {
      case 'live':
        return 'bg-emerald-500 animate-pulse';
      case 'aging':
        return 'bg-amber-500';
      case 'stale':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  }, [status.level]);

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${dotClass}`}
      title={`Last updated: ${lastUpdate?.toLocaleString() || 'Never'}`}
    />
  );
}

/**
 * Live status badge for showing "● LIVE" in headers
 */
export function LiveStatusBadge({
  isLive,
  feedsConnected,
  totalFeeds,
}: {
  isLive: boolean;
  feedsConnected: number;
  totalFeeds: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded">
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
        }`}
      />
      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
        LIVE
      </span>
      <span className="text-xs text-slate-400">
        Streaming {feedsConnected}/{totalFeeds} feeds
      </span>
    </div>
  );
}

export default LiveFeedIndicator;
