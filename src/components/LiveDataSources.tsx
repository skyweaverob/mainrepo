'use client';

import { useEffect, useState } from 'react';
import {
  Database,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-9693.up.railway.app';

interface DataSource {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  lastFetch: Date | null;
  status: 'connected' | 'stale' | 'error' | 'loading';
  latency?: number;
  recordCount?: number;
}

interface LiveDataSourcesProps {
  compact?: boolean;
  onRefresh?: () => void;
}

const DATA_SOURCES_CONFIG = [
  { id: 'schedules', name: 'Schedule Data', description: 'Flight schedules and routes', endpoint: '/api/network/routes' },
  { id: 'fleet', name: 'Fleet Data', description: 'Aircraft and maintenance status', endpoint: '/api/fleet/summary' },
  { id: 'markets', name: 'Market Intelligence', description: 'Competitive fare and share data', endpoint: '/api/network/stats' },
  { id: 'optimizer', name: 'RASM Optimizer', description: 'ML optimization engine', endpoint: '/api/optimizer/status' },
  { id: 'crew', name: 'Crew Data', description: 'Crew assignments and pairings', endpoint: '/api/crew/summary' },
];

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function LiveDataSources({ compact = false, onRefresh }: LiveDataSourcesProps) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastGlobalRefresh, setLastGlobalRefresh] = useState<Date | null>(null);

  const checkDataSource = async (config: typeof DATA_SOURCES_CONFIG[0]): Promise<DataSource> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${API_BASE}${config.endpoint}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      const latency = Date.now() - startTime;

      if (!response.ok) {
        return {
          id: config.id,
          name: config.name,
          description: config.description,
          endpoint: config.endpoint,
          lastFetch: new Date(),
          status: 'error',
          latency,
        };
      }

      const data = await response.json();
      const recordCount = Array.isArray(data) ? data.length :
                         data?.total_aircraft || data?.length ||
                         (typeof data === 'object' ? Object.keys(data).length : 0);

      return {
        id: config.id,
        name: config.name,
        description: config.description,
        endpoint: config.endpoint,
        lastFetch: new Date(),
        status: 'connected',
        latency,
        recordCount,
      };
    } catch (error) {
      return {
        id: config.id,
        name: config.name,
        description: config.description,
        endpoint: config.endpoint,
        lastFetch: null,
        status: 'error',
        latency: Date.now() - startTime,
      };
    }
  };

  const refreshAllSources = async () => {
    setIsRefreshing(true);

    // Set all to loading first
    setSources(prev => prev.map(s => ({ ...s, status: 'loading' as const })));

    const results = await Promise.all(
      DATA_SOURCES_CONFIG.map(config => checkDataSource(config))
    );

    setSources(results);
    setLastGlobalRefresh(new Date());
    setIsRefreshing(false);
    onRefresh?.();
  };

  // Check for stale data periodically
  useEffect(() => {
    const checkStale = () => {
      setSources(prev => prev.map(source => {
        if (source.status === 'connected' && source.lastFetch) {
          const age = Date.now() - source.lastFetch.getTime();
          if (age > STALE_THRESHOLD_MS) {
            return { ...source, status: 'stale' as const };
          }
        }
        return source;
      }));
    };

    const interval = setInterval(checkStale, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Initial fetch
  useEffect(() => {
    // Initialize with loading state
    setSources(DATA_SOURCES_CONFIG.map(config => ({
      id: config.id,
      name: config.name,
      description: config.description,
      endpoint: config.endpoint,
      lastFetch: null,
      status: 'loading' as const,
    })));

    refreshAllSources();
  }, []);

  const getStatusIcon = (status: DataSource['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'stale':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'loading':
        return <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: DataSource['status']) => {
    switch (status) {
      case 'connected': return 'bg-emerald-500';
      case 'stale': return 'bg-amber-500';
      case 'error': return 'bg-red-500';
      case 'loading': return 'bg-slate-400';
    }
  };

  const formatTimestamp = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    return date.toLocaleTimeString();
  };

  const connectedCount = sources.filter(s => s.status === 'connected').length;
  const totalCount = sources.length;
  const healthPct = totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          {healthPct === 100 ? (
            <Wifi className="w-4 h-4 text-emerald-500" />
          ) : healthPct > 50 ? (
            <Wifi className="w-4 h-4 text-amber-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-sm text-slate-300">
            {connectedCount}/{totalCount} Sources
          </span>
        </div>
        <div className="flex gap-1">
          {sources.map(source => (
            <div
              key={source.id}
              className={`w-2 h-2 rounded-full ${getStatusColor(source.status)}`}
              title={`${source.name}: ${source.status}`}
            />
          ))}
        </div>
        <button
          onClick={refreshAllSources}
          disabled={isRefreshing}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Live Data Sources</h3>
            <div className="text-sm text-slate-500">
              {connectedCount} of {totalCount} connected
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Health indicator */}
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${
              healthPct === 100 ? 'text-emerald-500' :
              healthPct > 50 ? 'text-amber-500' : 'text-red-500'
            }`} />
            <span className={`text-sm font-medium ${
              healthPct === 100 ? 'text-emerald-600' :
              healthPct > 50 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {healthPct}% Health
            </span>
          </div>

          <button
            onClick={refreshAllSources}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Refresh All</span>
          </button>
        </div>
      </div>

      {/* Source List */}
      <div className="divide-y divide-slate-100">
        {sources.map(source => (
          <div key={source.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
            {/* Status indicator */}
            <div className={`w-2 h-8 rounded-full ${getStatusColor(source.status)}`} />

            {/* Source info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{source.name}</span>
                {getStatusIcon(source.status)}
              </div>
              <div className="text-sm text-slate-500">{source.description}</div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-6 text-sm">
              {source.recordCount !== undefined && source.status === 'connected' && (
                <div className="text-slate-600">
                  <span className="font-medium">{source.recordCount.toLocaleString()}</span>
                  <span className="text-slate-400 ml-1">records</span>
                </div>
              )}

              {source.latency !== undefined && (
                <div className={`${
                  source.latency < 200 ? 'text-emerald-600' :
                  source.latency < 500 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {source.latency}ms
                </div>
              )}

              <div className="flex items-center gap-1 text-slate-500 min-w-[80px]">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimestamp(source.lastFetch)}</span>
              </div>
            </div>

            {/* Status badge */}
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              source.status === 'connected' ? 'bg-emerald-100 text-emerald-700' :
              source.status === 'stale' ? 'bg-amber-100 text-amber-700' :
              source.status === 'error' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {source.status === 'connected' ? 'Live' :
               source.status === 'stale' ? 'Stale' :
               source.status === 'error' ? 'Error' : 'Loading'}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {lastGlobalRefresh && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last full refresh: {formatTimestamp(lastGlobalRefresh)}
        </div>
      )}
    </div>
  );
}

export default LiveDataSources;
