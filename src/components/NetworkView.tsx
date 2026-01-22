'use client';

import { useEffect, useState, useMemo } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { RouteTable } from './RouteTable';
import { RouteDetail } from './RouteDetail';
import { HubSelector } from './HubSelector';
import { NetworkMap } from './NetworkMap';
import { RevenueMetricGrid } from './RevenueMetricCard';
import { LiveDot } from './LiveFeedIndicator';
import { useLiveDataStore } from '@/lib/liveDataStore';
import { formatRelativeTime } from '@/lib/formatters';
import * as api from '@/lib/api';

interface NetworkViewProps {
  initialData?: {
    stats: any;
    hubs: any;
    routes: any[];
  };
  onHubClick?: (hubCode: string) => void;
}

export function NetworkView({ initialData, onHubClick }: NetworkViewProps) {
  const [networkStats, setNetworkStats] = useState<any>(initialData?.stats || null);
  const [hubSummary, setHubSummary] = useState<any>(initialData?.hubs || null);
  const [routes, setRoutes] = useState<any[]>(initialData?.routes || []);
  const [marketIntelligence, setMarketIntelligence] = useState<any[]>([]);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<{ origin: string; destination: string } | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [routeDecompositions, setRouteDecompositions] = useState<Record<string, any>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { feeds, networkHealth, alerts, apiBudget } = useLiveDataStore();

  // Fetch initial data
  useEffect(() => {
    if (initialData) return;

    async function fetchData() {
      try {
        const [stats, hubs, routesData, intelligence] = await Promise.all([
          api.getNetworkStats(),
          api.getHubSummary(),
          api.getRoutes({ limit: 100 }),
          api.getMarketIntelligence(100),
        ]);

        setNetworkStats(stats);
        setHubSummary(hubs);
        setRoutes(routesData);
        setMarketIntelligence(intelligence);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch network data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [initialData]);

  // Fetch routes when hub changes
  useEffect(() => {
    async function fetchFilteredRoutes() {
      try {
        const routesData = await api.getRoutes({
          limit: 100,
          hub: selectedHub || undefined,
        });
        setRoutes(routesData);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch filtered routes:', error);
      }
    }

    if (!loading) {
      fetchFilteredRoutes();
    }
  }, [selectedHub, loading]);

  // Fetch segment decompositions for visible routes
  useEffect(() => {
    async function fetchDecompositions() {
      const routesToFetch = routes.filter(r => !routeDecompositions[r.route_key]).slice(0, 20);

      for (const route of routesToFetch) {
        try {
          const decomp = await api.getRouteDecomposition(route.origin, route.destination);
          setRouteDecompositions(prev => ({
            ...prev,
            [route.route_key]: decomp,
          }));
        } catch (error) {
          // Silently fail for individual routes
        }
      }
    }

    if (routes.length > 0) {
      fetchDecompositions();
    }
  }, [routes]);

  // Calculate revenue metrics from market intelligence
  const revenueMetrics = useMemo(() => {
    if (marketIntelligence.length === 0) {
      // No data available - return null to show loading/empty state
      return null;
    }

    // Calculate from actual data
    const totalAnnualPax = marketIntelligence.reduce((sum, m) => sum + (m.nk_passengers || 0), 0);
    const avgFare = marketIntelligence.reduce((sum, m) => sum + (m.nk_avg_fare || 0), 0) / marketIntelligence.length;
    const avgDistance = marketIntelligence.reduce((sum, m) => sum + (m.distance || 0), 0) / marketIntelligence.length;

    if (!avgFare || !avgDistance) return null;

    const dailyPax = totalAnnualPax / 365;
    const dailyRevenue = dailyPax * avgFare;
    const rasmCents = (avgFare / avgDistance) * 100;
    const yieldCents = rasmCents * 1.14; // Yield is typically ~14% higher than RASM
    const flightsPerDay = dailyPax / (170 * 0.85); // ~170 seats, 85% load factor
    const revPerDeparture = flightsPerDay > 0 ? dailyRevenue / flightsPerDay : 0;

    return {
      dailyRevenue,
      rasmCents,
      yieldCents,
      revPerDeparture,
    };
  }, [marketIntelligence]);

  // Prepare hub data for map
  const hubMapData = useMemo(() => {
    const hubs = ['DTW', 'MCO', 'FLL', 'LAS', 'EWR'];
    const RASM_ALERT_THRESHOLD = 10; // Alert if RASM below 10 cents

    return hubs.map(code => {
      const hubRoutes = marketIntelligence.filter(
        m => m.origin === code || m.destination === code
      );
      const totalPax = hubRoutes.reduce((sum, r) => sum + (r.nk_passengers || 0), 0);
      const avgFare = hubRoutes.length > 0
        ? hubRoutes.reduce((sum, r) => sum + (r.nk_avg_fare || 0), 0) / hubRoutes.length
        : 0;
      const avgDistance = hubRoutes.length > 0
        ? hubRoutes.reduce((sum, r) => sum + (r.distance || 0), 0) / hubRoutes.length
        : 0;

      const rasmCents = avgDistance > 0 ? (avgFare / avgDistance) * 100 : 0;

      return {
        code,
        dailyRevenue: avgFare > 0 ? (totalPax * avgFare) / 365 : 0,
        rasmCents,
        isProfitable: rasmCents >= RASM_ALERT_THRESHOLD,
        hasAlert: rasmCents > 0 && rasmCents < RASM_ALERT_THRESHOLD, // Alert on low RASM, not hardcoded
        routeCount: hubRoutes.length,
        dailyFlights: totalPax > 0 ? Math.round(totalPax / 365 / 150) : 0,
      };
    });
  }, [marketIntelligence]);

  // Add segment_mix and revenue data to routes
  const routesWithData = useMemo(() => {
    return routes.map(route => {
      const market = marketIntelligence.find(
        m => (m.origin === route.origin && m.destination === route.destination) ||
             (m.origin === route.destination && m.destination === route.origin)
      );
      const decomp = routeDecompositions[route.route_key];

      const avgFare = route.avg_fare || market?.nk_avg_fare || 120;
      const dailyPax = (route.total_pax || 0) / 365;
      const dailyRevenue = dailyPax * avgFare;
      const distance = market?.distance || 1000;
      const rasmCents = (avgFare / distance) * 100;

      return {
        ...route,
        segment_mix: decomp?.segment_mix,
        daily_revenue: dailyRevenue,
        rasm_cents: rasmCents,
        contribution_margin: dailyRevenue * 0.15, // Estimate 15% margin
      };
    });
  }, [routes, routeDecompositions, marketIntelligence]);

  // Prepare hub data for selector
  const hubData = hubSummary
    ? Object.entries(hubSummary).map(([name, data]: [string, any]) => ({
        name,
        flights: data.total_flights,
        pax: data.total_pax,
      }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#002855] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-100">
      {/* Header - McKinsey navy */}
      <div className="bg-[#002855] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Network Overview</h1>
              <p className="text-sm text-blue-200 mt-1">
                Real-time network performance across {networkStats?.unique_routes || 0} routes
              </p>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded border border-white/20">
              <LiveDot lastUpdate={lastUpdate} isConnected={true} />
              <span className="text-xs text-emerald-300">
                Updated {formatRelativeTime(lastUpdate)}
              </span>
            </div>
          </div>
          <HubSelector
            hubs={hubData}
            selectedHub={selectedHub}
            onSelect={setSelectedHub}
          />
        </div>
      </div>

      {/* Revenue Metrics - RASM is north star */}
      <div className="px-6 py-4 flex-shrink-0 bg-white border-b border-slate-200">
        {revenueMetrics ? (
          <RevenueMetricGrid
            dailyRevenue={revenueMetrics.dailyRevenue}
            rasmCents={revenueMetrics.rasmCents}
            yieldCents={revenueMetrics.yieldCents}
            revPerDeparture={revenueMetrics.revPerDeparture}
            previousDailyRevenue={null}
            previousRasm={null}
            previousYield={null}
            previousRevPerDeparture={null}
            lastUpdate={lastUpdate}
            isLive
          />
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {['Daily Revenue', 'RASM', 'Yield', 'Rev/Departure'].map((title) => (
              <div key={title} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{title}</div>
                <div className="text-lg font-medium text-slate-400">Loading...</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map + Table Layout */}
      <div className="flex-1 flex min-h-0 px-6 pb-6 pt-4 gap-6 overflow-hidden">
        {/* Left: Map + Alerts (when no route selected) */}
        {!selectedRoute && (
          <div className="w-2/5 flex flex-col gap-4 min-h-0">
            {/* Network Map */}
            <div className="flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <NetworkMap
                hubs={hubMapData}
                selectedHub={selectedHub}
                onHubClick={onHubClick}
                height={300}
              />
            </div>

            {/* Live Fare Alerts - from SerpAPI */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  Live Fare Alerts
                </h3>
                <span className="text-xs text-slate-400">
                  API: {apiBudget.remaining}/{apiBudget.limit}
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                {alerts.filter(a => a.type === 'competitor_fare').length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <div className="text-slate-500 text-sm mb-2">
                      {apiBudget.remaining === 0 ? 'API budget exhausted' : 'No fare alerts'}
                    </div>
                    <p className="text-xs text-slate-400">
                      {apiBudget.remaining > 0
                        ? 'Fare alerts appear when competitors change prices significantly.'
                        : 'Budget resets at midnight.'}
                    </p>
                  </div>
                ) : (
                  alerts
                    .filter(a => a.type === 'competitor_fare')
                    .slice(0, 5)
                    .map((alert) => (
                      <AlertRow
                        key={alert.id}
                        type={alert.severity}
                        message={alert.message}
                        time={formatRelativeTime(alert.timestamp)}
                      />
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Route Table */}
        <div className={`${selectedRoute ? 'w-1/2' : 'w-3/5'} flex flex-col min-h-0 transition-all duration-300`}>
          <RouteTable
            routes={routesWithData}
            onRouteSelect={setSelectedRoute}
            selectedRoute={selectedRoute}
          />
        </div>

        {/* Route Detail Panel */}
        {selectedRoute && (
          <div className="w-1/2 flex flex-col min-h-0">
            <RouteDetail
              origin={selectedRoute.origin}
              destination={selectedRoute.destination}
              onClose={() => setSelectedRoute(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * AlertRow - Single alert in the live alerts section
 */
function AlertRow({
  type,
  message,
  time,
}: {
  type: 'warning' | 'critical' | 'info';
  message: string;
  time: string;
}) {
  const iconClass = type === 'critical' ? 'text-red-500' : type === 'warning' ? 'text-amber-500' : 'text-blue-500';

  return (
    <div className="px-4 py-2.5 flex items-start gap-2 hover:bg-slate-50 transition-colors">
      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconClass}`} />
      <p className="text-sm text-slate-700 flex-1">{message}</p>
      <span className="text-xs text-slate-400 whitespace-nowrap">{time}</span>
    </div>
  );
}

export default NetworkView;
