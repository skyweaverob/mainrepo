'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  WifiOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { DataHealthStatus } from '@/types';

interface DataHealthBadgeProps {
  feeds: DataHealthStatus[];
  compact?: boolean;
}

const STATUS_CONFIG: Record<DataHealthStatus['status'], {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}> = {
  live: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Live',
  },
  aging: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Aging',
  },
  stale: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Stale',
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100',
    label: 'Disconnected',
  },
};

/**
 * DataHealthBadge - Shows feed freshness and data quality indicators
 * Flags invalid metrics and out-of-bounds values
 */
export function DataHealthBadge({ feeds, compact = false }: DataHealthBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate overall health
  const liveCount = feeds.filter((f) => f.status === 'live').length;
  const staleCount = feeds.filter((f) => f.status === 'stale' || f.status === 'disconnected').length;
  const totalOutOfBounds = feeds.reduce((sum, f) => sum + f.outOfBoundsCount, 0);

  const overallStatus: DataHealthStatus['status'] =
    staleCount > 0 ? 'stale' :
    feeds.some((f) => f.status === 'aging') ? 'aging' : 'live';

  const overallConfig = STATUS_CONFIG[overallStatus];
  const OverallIcon = overallConfig.icon;

  // Format age
  const formatAge = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (compact) {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${overallConfig.bgColor} ${overallConfig.color}`}
      >
        <OverallIcon className="w-3 h-3" />
        <span className="font-medium">{liveCount}/{feeds.length} feeds</span>
        {totalOutOfBounds > 0 && (
          <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold">
            {totalOutOfBounds}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
          overallStatus === 'live'
            ? 'border-emerald-200 bg-emerald-50'
            : overallStatus === 'aging'
            ? 'border-amber-200 bg-amber-50'
            : 'border-red-200 bg-red-50'
        }`}
      >
        <Activity className={`w-4 h-4 ${overallConfig.color}`} />
        <span className={`text-sm font-medium ${overallConfig.color}`}>
          Data Health
        </span>
        {totalOutOfBounds > 0 && (
          <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold">
            {totalOutOfBounds} issues
          </span>
        )}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-lg z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-800">Data Feeds</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${overallConfig.bgColor} ${overallConfig.color}`}>
                {overallConfig.label.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Feed List */}
          <div className="divide-y divide-slate-100 max-h-64 overflow-auto">
            {feeds.map((feed) => {
              const config = STATUS_CONFIG[feed.status];
              const Icon = config.icon;

              return (
                <div key={feed.feedName} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className="text-sm font-medium text-slate-800">
                        {feed.feedName}
                      </span>
                    </div>
                    <span className={`text-xs ${config.color}`}>
                      {formatAge(feed.ageSeconds)}
                    </span>
                  </div>

                  {feed.outOfBoundsCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{feed.outOfBoundsCount} out-of-bounds values</span>
                    </div>
                  )}

                  {feed.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">
                      {feed.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 rounded-b-lg border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {liveCount} live, {feeds.length - liveCount} degraded
              </span>
              <button className="flex items-center gap-1 text-[#002855] hover:underline">
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DataQualityFlag - Inline flag for invalid data
 * Use this when a specific metric is out of bounds
 */
export function DataQualityFlag({ message }: { message?: string }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
      <AlertTriangle className="w-3 h-3" />
      <span>{message || 'Data quality issue'}</span>
    </div>
  );
}

export default DataHealthBadge;
