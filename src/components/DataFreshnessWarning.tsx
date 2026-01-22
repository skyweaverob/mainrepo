'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw, X, Info } from 'lucide-react';

interface DataSourceStatus {
  name: string;
  lastUpdate: Date | null;
  staleThresholdMinutes: number;
  criticalThresholdMinutes: number;
}

interface DataFreshnessWarningProps {
  sources?: DataSourceStatus[];
  onRefresh?: () => void;
  dismissable?: boolean;
  position?: 'top' | 'inline' | 'floating';
}

const DEFAULT_SOURCES: DataSourceStatus[] = [
  { name: 'Schedule Data', lastUpdate: null, staleThresholdMinutes: 30, criticalThresholdMinutes: 120 },
  { name: 'Market Intelligence', lastUpdate: null, staleThresholdMinutes: 60, criticalThresholdMinutes: 240 },
  { name: 'Fleet Status', lastUpdate: null, staleThresholdMinutes: 15, criticalThresholdMinutes: 60 },
  { name: 'Optimizer Model', lastUpdate: null, staleThresholdMinutes: 60, criticalThresholdMinutes: 180 },
];

type FreshnessLevel = 'fresh' | 'stale' | 'critical' | 'unknown';

function calculateFreshness(source: DataSourceStatus): FreshnessLevel {
  if (!source.lastUpdate) return 'unknown';

  const ageMinutes = (Date.now() - source.lastUpdate.getTime()) / (1000 * 60);

  if (ageMinutes >= source.criticalThresholdMinutes) return 'critical';
  if (ageMinutes >= source.staleThresholdMinutes) return 'stale';
  return 'fresh';
}

function formatAge(lastUpdate: Date | null): string {
  if (!lastUpdate) return 'Never updated';

  const ageMs = Date.now() - lastUpdate.getTime();
  const minutes = Math.floor(ageMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function DataFreshnessWarning({
  sources = DEFAULT_SOURCES,
  onRefresh,
  dismissable = true,
  position = 'inline'
}: DataFreshnessWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Simulate fetching actual data freshness
  const [sourcesWithData, setSourcesWithData] = useState<DataSourceStatus[]>(sources);

  useEffect(() => {
    // In a real app, this would fetch actual timestamps from the API
    // For demo, we'll simulate some data
    const simulated = sources.map((s, i) => ({
      ...s,
      lastUpdate: new Date(Date.now() - (i * 15 + Math.random() * 30) * 60 * 1000)
    }));
    setSourcesWithData(simulated);
  }, [sources]);

  const freshnessLevels = sourcesWithData.map(s => calculateFreshness(s));
  const hasCritical = freshnessLevels.includes('critical');
  const hasStale = freshnessLevels.includes('stale');
  const hasUnknown = freshnessLevels.includes('unknown');

  // Don't show if all data is fresh
  const shouldShow = hasCritical || hasStale || hasUnknown;

  if (!shouldShow || dismissed) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    // Simulate refresh completing
    setTimeout(() => {
      setSourcesWithData(sources.map(s => ({
        ...s,
        lastUpdate: new Date()
      })));
      setIsRefreshing(false);
    }, 1500);
  };

  const severity = hasCritical ? 'critical' : hasUnknown ? 'unknown' : 'stale';

  const baseStyles = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    stale: 'bg-amber-50 border-amber-200 text-amber-800',
    unknown: 'bg-slate-100 border-slate-300 text-slate-700',
  };

  const iconStyles = {
    critical: 'text-red-500',
    stale: 'text-amber-500',
    unknown: 'text-slate-500',
  };

  const positionStyles = {
    top: 'fixed top-0 left-0 right-0 z-50 rounded-none border-x-0 border-t-0',
    inline: 'rounded-lg',
    floating: 'fixed bottom-4 right-4 z-50 rounded-lg shadow-lg max-w-md',
  };

  const Icon = severity === 'critical' ? AlertTriangle : severity === 'unknown' ? Info : Clock;

  return (
    <div className={`border p-3 ${baseStyles[severity]} ${positionStyles[position]}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[severity]}`} />

        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {severity === 'critical' ? 'Critical: Data may be outdated' :
             severity === 'unknown' ? 'Data freshness unknown' :
             'Some data sources are stale'}
          </div>

          <div className="text-sm mt-1 opacity-80">
            {hasCritical
              ? 'Some data sources have not been updated recently. Recommendations may not reflect current conditions.'
              : hasUnknown
              ? 'Unable to verify data freshness for some sources.'
              : 'Data is older than recommended. Consider refreshing for accurate analysis.'}
          </div>

          {/* Expandable details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm underline mt-2 hover:no-underline"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>

          {showDetails && (
            <div className="mt-3 space-y-2">
              {sourcesWithData.map((source, i) => {
                const level = freshnessLevels[i];
                return (
                  <div
                    key={source.name}
                    className={`flex items-center justify-between text-sm py-1.5 px-2 rounded ${
                      level === 'critical' ? 'bg-red-100/50' :
                      level === 'stale' ? 'bg-amber-100/50' :
                      level === 'unknown' ? 'bg-slate-200/50' : 'bg-white/50'
                    }`}
                  >
                    <span>{source.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${
                        level === 'critical' ? 'text-red-600' :
                        level === 'stale' ? 'text-amber-600' :
                        level === 'unknown' ? 'text-slate-500' : 'text-emerald-600'
                      }`}>
                        {formatAge(source.lastUpdate)}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${
                        level === 'critical' ? 'bg-red-500' :
                        level === 'stale' ? 'bg-amber-500' :
                        level === 'unknown' ? 'bg-slate-400' : 'bg-emerald-500'
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                severity === 'critical'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : severity === 'stale'
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-slate-600 text-white hover:bg-slate-700'
              } disabled:opacity-50`}
            >
              {isRefreshing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </button>
          )}

          {dismissable && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded hover:bg-black/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact inline badge version
export function DataFreshnessBadge({
  lastUpdate,
  staleMinutes = 30,
  criticalMinutes = 120,
  label = 'Data'
}: {
  lastUpdate: Date | null;
  staleMinutes?: number;
  criticalMinutes?: number;
  label?: string;
}) {
  if (!lastUpdate) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
        <Clock className="w-3 h-3" />
        <span>{label}: Unknown</span>
      </div>
    );
  }

  const ageMinutes = (Date.now() - lastUpdate.getTime()) / (1000 * 60);
  const isCritical = ageMinutes >= criticalMinutes;
  const isStale = ageMinutes >= staleMinutes;

  if (!isStale) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-100 rounded text-xs text-emerald-700">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>{label}: Live</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
      isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {isCritical ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      <span>{label}: {formatAge(lastUpdate)}</span>
    </div>
  );
}

export default DataFreshnessWarning;
