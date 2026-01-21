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

  const { feeds, networkHealth } = useLiveDataStore();

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
      return {
        dailyRevenue: networkHealth?.totalDailyRevenue || 13500000,
        rasmCents: 11.84,
        yieldCents: 13.52,
        revPerDeparture: 18247,
      };
    }

    // Calculate from actual data
    const totalAnnualPax = marketIntelligence.reduce((sum, m) => sum + (m.nk_passengers || 0), 0);
    const avgFare = marketIntelligence.reduce((sum, m) => sum + (m.nk_avg_fare || 0), 0) / marketIntelligence.length || 120;
    const avgDistance = marketIntelligence.reduce((sum, m) => sum + (m.distance || 0), 0) / marketIntelligence.length || 1000;

    const dailyPax = totalAnnualPax / 365;
    const dailyRevenue = dailyPax * avgFare;
    const rasmCents = (avgFare / avgDistance) * 100;
    const yieldCents = rasmCents * 1.14; // Yield is typically ~14% higher than RASM
    const flightsPerDay = dailyPax / (170 * 0.85); // ~170 seats, 85% load factor
    const revPerDeparture = dailyRevenue / flightsPerDay;

    return {
      dailyRevenue,
      rasmCents,
      yieldCents,
      revPerDeparture,
    };
  }, [marketIntelligence, networkHealth]);

  // Prepare hub data for map
  const hubMapData = useMemo(() => {
    const hubs = ['DTW', 'MCO', 'FLL', 'LAS', 'EWR'];
    return hubs.map(code => {
      const hubRoutes = marketIntelligence.filter(
        m => m.origin === code || m.destination === code
      );
      const totalPax = hubRoutes.reduce((sum, r) => sum + (r.nk_passengers || 0), 0);
      const avgFare = hubRoutes.length > 0
        ? hubRoutes.reduce((sum, r) => sum + (r.nk_avg_fare || 0), 0) / hubRoutes.length
        : 120;
      const avgDistance = hubRoutes.length > 0
        ? hubRoutes.reduce((sum, r) => sum + (r.distance || 0), 0) / hubRoutes.length
        : 1000;

      return {
        code,
        dailyRevenue: (totalPax * avgFare) / 365,
        rasmCents: (avgFare / avgDistance) * 100,
        isProfitable: true,
        hasAlert: code === 'FLL', // FLL has alert per spec
        routeCount: hubRoutes.length,
        dailyFlights: Math.round(totalPax / 365 / 150),
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Network Overview</h1>
              <p className="text-sm text-slate-400 mt-1">
                Real-time network performance across {networkStats?.unique_routes || 0} routes
              </p>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/30">
              <LiveDot lastUpdate={lastUpdate} isConnected={true} />
              <span className="text-xs text-emerald-400">
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

      {/* Revenue Metrics - NO LOAD FACTOR */}
      <div className="px-6 py-4 flex-shrink-0">
        <RevenueMetricGrid
          dailyRevenue={revenueMetrics.dailyRevenue}
          rasmCents={revenueMetrics.rasmCents}
          yieldCents={revenueMetrics.yieldCents}
          revPerDeparture={revenueMetrics.revPerDeparture}
          previousDailyRevenue={revenueMetrics.dailyRevenue * 0.98} // Mock 2% change
          previousRasm={revenueMetrics.rasmCents * 0.97}
          previousYield={revenueMetrics.yieldCents * 0.96}
          previousRevPerDeparture={revenueMetrics.revPerDeparture * 0.98}
          lastUpdate={lastUpdate}
          isLive
        />
      </div>

      {/* Map + Table Layout */}
      <div className="flex-1 flex min-h-0 px-6 pb-6 gap-6 overflow-hidden">
        {/* Left: Map + Alerts (when no route selected) */}
        {!selectedRoute && (
          <div className="w-2/5 flex flex-col gap-4 min-h-0">
            {/* Network Map */}
            <div className="flex-1 min-h-0">
              <NetworkMap
                hubs={hubMapData}
                selectedHub={selectedHub}
                onHubClick={onHubClick}
                height={300}
              />
            </div>

            {/* Live Demand Alerts */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex-shrink-0">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Live Demand Alerts
                </h3>
                <span className="text-xs text-slate-500">Last 24 hours</span>
              </div>
              <div className="divide-y divide-slate-700/50 max-h-[200px] overflow-y-auto">
                <AlertRow
                  type="warning"
                  message="FLL-BOS: Demand surge +34% (Taylor Swift concert Boston 2/14)"
                  time="2 min ago"
                />
                <AlertRow
                  type="warning"
                  message="DTW-MCO: Competitor F9 dropped fares 18% on 3 routes"
                  time="8 min ago"
                />
                <AlertRow
                  type="info"
                  message="LAS-LAX: Booking pace ahead of forecast +12%"
                  time="15 min ago"
                />
                <AlertRow
                  type="warning"
                  message="EWR-MIA: Cruise departure demand spike detected"
                  time="23 min ago"
                />
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
  const iconClass = type === 'critical' ? 'text-red-400' : type === 'warning' ? 'text-amber-400' : 'text-blue-400';

  return (
    <div className="px-4 py-2.5 flex items-start gap-2 hover:bg-slate-700/30 transition-colors">
      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconClass}`} />
      <p className="text-sm text-slate-300 flex-1">{message}</p>
      <span className="text-xs text-slate-500 whitespace-nowrap">{time}</span>
    </div>
  );
}

export default NetworkView;
