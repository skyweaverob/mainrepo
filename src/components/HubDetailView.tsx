'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Calendar, Users, Plane } from 'lucide-react';
import { formatCurrency, formatRASM, formatPassengers, formatRelativeTime } from '@/lib/formatters';
import { RevenueMetricCard } from './RevenueMetricCard';
import { LiveDot } from './LiveFeedIndicator';
import * as api from '@/lib/api';

interface HubDetailViewProps {
  hubCode: string;
  hubName: string;
  onBack: () => void;
  onRouteClick: (origin: string, destination: string) => void;
}

interface RouteData {
  origin: string;
  destination: string;
  dailyRevenue: number;
  rasmCents: number;
  dailyPassengers: number;
  contributionMargin: number;
  avgFare: number;
}

interface DemandSignal {
  type: 'event' | 'competitor' | 'booking' | 'weather';
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
}

/**
 * HubDetailView - Detailed view of a single hub
 *
 * Shows:
 * - Hub KPIs (revenue, RASM, yield, rev/departure)
 * - Most/Least profitable routes
 * - Demand signals (events, competitors, booking pace)
 */
export function HubDetailView({
  hubCode,
  hubName,
  onBack,
  onRouteClick,
}: HubDetailViewProps) {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Mock hub metrics (in real app, fetch from API)
  const hubMetrics = useMemo(() => ({
    dailyRevenue: 2412847,
    previousRevenue: 2314000,
    rasmCents: 12.41,
    previousRasm: 12.11,
    yieldCents: 14.23,
    previousYield: 13.43,
    revPerDeparture: 18247,
    previousRevPerDeparture: 17835,
  }), []);

  // Fetch routes for this hub
  useEffect(() => {
    async function fetchHubRoutes() {
      setLoading(true);
      try {
        const [routesData, marketData] = await Promise.all([
          api.getRoutes({ hub: hubCode, limit: 100 }),
          api.getMarketIntelligence(100),
        ]);

        // Combine data to get revenue metrics
        const enrichedRoutes: RouteData[] = routesData.map((route) => {
          const market = marketData.find(
            (m) =>
              (m.origin === route.origin && m.destination === route.destination) ||
              (m.origin === route.destination && m.destination === route.origin)
          );

          // Calculate daily values
          const annualPax = route.total_pax || 0;
          const dailyPax = annualPax / 365;
          const avgFare = route.avg_fare || market?.nk_avg_fare || 120;
          const dailyRevenue = dailyPax * avgFare;
          const distance = market?.distance || 1000;
          const rasmCents = (avgFare / distance) * 100;

          // Simple contribution margin (revenue - estimated costs)
          const costPerMile = 0.08; // 8 cents per seat mile as estimate
          const seatsPerFlight = 180;
          const flightsPerDay = dailyPax / (seatsPerFlight * 0.85); // assume 85% LF
          const dailyCost = flightsPerDay * distance * seatsPerFlight * costPerMile;
          const contributionMargin = dailyRevenue - dailyCost;

          return {
            origin: route.origin,
            destination: route.destination,
            dailyRevenue,
            rasmCents,
            dailyPassengers: dailyPax,
            contributionMargin,
            avgFare,
          };
        });

        // Sort by contribution margin
        enrichedRoutes.sort((a, b) => b.contributionMargin - a.contributionMargin);
        setRoutes(enrichedRoutes);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch hub routes:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchHubRoutes();
  }, [hubCode]);

  // Split into profitable and unprofitable
  const profitableRoutes = routes.filter((r) => r.contributionMargin > 0).slice(0, 5);
  const unprofitableRoutes = routes.filter((r) => r.contributionMargin <= 0).slice(0, 5);

  // Mock demand signals
  const demandSignals: DemandSignal[] = [
    {
      type: 'event',
      icon: '🎵',
      title: 'Concert: Beyoncé at local venue 2/28',
      description: 'Demand lift +23% expected',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      type: 'competitor',
      icon: '✈️',
      title: `F9 dropped fares on ${hubCode}-MCO by $28`,
      description: 'Our fare: $127',
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
    },
    {
      type: 'booking',
      icon: '📊',
      title: `${hubCode}-MCO Feb 14: 34% ahead of pace`,
      description: "Valentine's weekend surge",
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
    },
  ];

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{hubCode} Hub Performance</h1>
            <p className="text-sm text-slate-400">{hubName}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LiveDot lastUpdate={lastUpdate} isConnected={true} />
            <span className="text-xs text-slate-500">
              Updated {formatRelativeTime(lastUpdate)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RevenueMetricCard
            title="Daily Revenue"
            value={hubMetrics.dailyRevenue}
            previousValue={hubMetrics.previousRevenue}
            metricType="currency"
            subtitle="vs last Tuesday"
            isLive
            lastUpdate={lastUpdate}
          />
          <RevenueMetricCard
            title="RASM"
            value={hubMetrics.rasmCents}
            previousValue={hubMetrics.previousRasm}
            metricType="rasm"
            subtitle="vs last Tuesday"
            isLive
            lastUpdate={lastUpdate}
            showAbsoluteDelta={false}
          />
          <RevenueMetricCard
            title="Yield"
            value={hubMetrics.yieldCents}
            previousValue={hubMetrics.previousYield}
            metricType="yield"
            subtitle="vs last Tuesday"
            isLive
            lastUpdate={lastUpdate}
            showAbsoluteDelta={false}
          />
          <RevenueMetricCard
            title="Rev/Departure"
            value={hubMetrics.revPerDeparture}
            previousValue={hubMetrics.previousRevPerDeparture}
            metricType="currency"
            subtitle="vs last Tuesday"
            isLive
            lastUpdate={lastUpdate}
          />
        </div>

        {/* Routes Section */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Most Profitable */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Most Profitable Routes
              </h3>
              <span className="text-xs text-slate-500">Click for detail</span>
            </div>
            <div className="divide-y divide-slate-700/50">
              {loading ? (
                <div className="p-4 text-center text-slate-500">Loading...</div>
              ) : profitableRoutes.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No routes found</div>
              ) : (
                profitableRoutes.map((route, i) => (
                  <RouteRow
                    key={`${route.origin}-${route.destination}`}
                    rank={i + 1}
                    route={route}
                    onClick={() => onRouteClick(route.origin, route.destination)}
                    variant="profitable"
                  />
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-700">
              <button className="text-xs text-blue-400 hover:text-blue-300">
                View all {routes.filter((r) => r.contributionMargin > 0).length} routes →
              </button>
            </div>
          </div>

          {/* Least Profitable */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                Least Profitable Routes
              </h3>
              <span className="text-xs text-slate-500">Click for detail</span>
            </div>
            <div className="divide-y divide-slate-700/50">
              {loading ? (
                <div className="p-4 text-center text-slate-500">Loading...</div>
              ) : unprofitableRoutes.length === 0 ? (
                <div className="p-4 text-center text-slate-500">All routes profitable!</div>
              ) : (
                unprofitableRoutes.map((route, i) => (
                  <RouteRow
                    key={`${route.origin}-${route.destination}`}
                    rank={i + 1}
                    route={route}
                    onClick={() => onRouteClick(route.origin, route.destination)}
                    variant="unprofitable"
                  />
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-700">
              <button className="text-xs text-blue-400 hover:text-blue-300">
                View all {routes.filter((r) => r.contributionMargin <= 0).length} routes →
              </button>
            </div>
          </div>
        </div>

        {/* Demand Signals */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              {hubCode} Demand Signals
            </h3>
          </div>
          <div className="divide-y divide-slate-700/50">
            {demandSignals.map((signal, i) => (
              <div
                key={i}
                className="px-4 py-3 flex items-start gap-3 hover:bg-slate-700/30 transition-colors"
              >
                <span className="text-lg">{signal.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{signal.title}</p>
                  <p className="text-xs text-slate-400">{signal.description}</p>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {formatRelativeTime(signal.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RouteRow - Single route in the list
 */
function RouteRow({
  rank,
  route,
  onClick,
  variant,
}: {
  rank: number;
  route: RouteData;
  onClick: () => void;
  variant: 'profitable' | 'unprofitable';
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/30 transition-colors text-left"
    >
      <span className="text-xs text-slate-500 w-4">{rank}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {route.origin}→{route.destination}
          </span>
          {variant === 'unprofitable' && (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          )}
        </div>
      </div>
      <div className="text-right">
        <div
          className={`text-sm font-medium ${
            variant === 'profitable' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {formatCurrency(route.contributionMargin, { compact: true, showSign: true })}/day
        </div>
        <div className="text-xs text-slate-500">{formatRASM(route.rasmCents)} RASM</div>
      </div>
    </button>
  );
}

export default HubDetailView;
