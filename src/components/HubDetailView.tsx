'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { formatCurrency, formatRASM, formatRelativeTime } from '@/lib/formatters';
import { RevenueMetricCard } from './RevenueMetricCard';
import { LiveDot } from './LiveFeedIndicator';
import { useLiveDataStore } from '@/lib/liveDataStore';
import * as api from '@/lib/api';
import * as fareService from '@/lib/fareService';
import * as eventsService from '@/lib/eventsService';

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

  // Calculate hub metrics from actual route data
  const hubMetrics = useMemo(() => {
    if (routes.length === 0) {
      return null; // No data state
    }

    const dailyRevenue = routes.reduce((sum, r) => sum + r.dailyRevenue, 0);
    const totalDailyPax = routes.reduce((sum, r) => sum + r.dailyPassengers, 0);
    const avgFare = routes.reduce((sum, r) => sum + r.avgFare, 0) / routes.length;

    // Weighted average RASM across routes
    const totalRevenue = routes.reduce((sum, r) => sum + r.dailyRevenue, 0);
    const weightedRasm = routes.reduce((sum, r) => sum + (r.rasmCents * r.dailyRevenue), 0) / (totalRevenue || 1);

    // Yield is typically ~14% higher than RASM for ULCC
    const yieldCents = weightedRasm * 1.14;

    // Estimate departures: assume 170 seats, 85% load factor
    const dailyDepartures = totalDailyPax / (170 * 0.85);
    const revPerDeparture = dailyDepartures > 0 ? dailyRevenue / dailyDepartures : 0;

    return {
      dailyRevenue,
      previousRevenue: null, // No historical comparison without API
      rasmCents: weightedRasm,
      previousRasm: null,
      yieldCents,
      previousYield: null,
      revPerDeparture,
      previousRevPerDeparture: null,
    };
  }, [routes]);

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

  // Live fares from store
  const { liveFares, apiBudget } = useLiveDataStore();
  const [fareSignals, setFareSignals] = useState<DemandSignal[]>([]);
  const [eventSignals, setEventSignals] = useState<DemandSignal[]>([]);
  const [loadingFares, setLoadingFares] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Fetch live fares for top routes in this hub (rate-limited)
  useEffect(() => {
    async function fetchLiveFaresForHub() {
      if (routes.length === 0) return;

      // Only fetch if we have budget
      if (!fareService.hasBudget()) {
        return;
      }

      setLoadingFares(true);
      const signals: DemandSignal[] = [];

      // Get top 3 routes by traffic for this hub
      const topRoutes = routes.slice(0, 3);

      for (const route of topRoutes) {
        try {
          const fareData = await fareService.fetchLiveFares(route.origin, route.destination);

          if (fareData.success && fareData.minFare !== null) {
            // Check fare positioning
            if (fareData.nkFare !== null && fareData.fareAdvantage !== null) {
              if (fareData.fareAdvantage < -20) {
                // We're more expensive than market
                signals.push({
                  type: 'competitor',
                  icon: '💰',
                  title: `${route.origin}-${route.destination}: NK $${fareData.nkFare} vs market $${fareData.minFare}`,
                  description: `$${Math.abs(fareData.fareAdvantage).toFixed(0)} above lowest competitor`,
                  timestamp: fareData.fetchedAt,
                });
              } else if (fareData.fareAdvantage > 10) {
                // We're cheaper than market
                signals.push({
                  type: 'competitor',
                  icon: '✅',
                  title: `${route.origin}-${route.destination}: Fare advantage $${fareData.fareAdvantage.toFixed(0)}`,
                  description: `NK at $${fareData.nkFare} vs market min $${fareData.minFare}`,
                  timestamp: fareData.fetchedAt,
                });
              }
            }

            // Show competitor activity
            if (fareData.competitorFares.length > 0) {
              const cheapest = fareData.competitorFares[0];
              signals.push({
                type: 'competitor',
                icon: '✈️',
                title: `${cheapest.airline} lowest on ${route.origin}-${route.destination}`,
                description: `$${cheapest.minFare} (${fareData.totalOptions} total options)`,
                timestamp: fareData.fetchedAt,
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch fares for route:', error);
        }
      }

      setFareSignals(signals);
      setLoadingFares(false);
    }

    // Delay fare fetch slightly to not conflict with initial load
    const timer = setTimeout(fetchLiveFaresForHub, 1000);
    return () => clearTimeout(timer);
  }, [routes]);

  // Fetch events for this hub city
  useEffect(() => {
    async function fetchEventsForHub() {
      if (!eventsService.hasEventsBudget()) {
        return;
      }

      setLoadingEvents(true);
      try {
        const locationEvents = await eventsService.fetchEventsForAirport(hubCode);
        const signals = eventsService.generateEventSignals(locationEvents, hubCode);

        // Convert to DemandSignal format
        const demandSignals: DemandSignal[] = signals.map(s => ({
          type: 'event' as const,
          icon: s.icon,
          title: s.title,
          description: s.description,
          timestamp: s.timestamp,
        }));

        setEventSignals(demandSignals);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoadingEvents(false);
      }
    }

    // Fetch events after a short delay
    const timer = setTimeout(fetchEventsForHub, 500);
    return () => clearTimeout(timer);
  }, [hubCode]);

  // Combine all demand signals - events first (more relevant for demand), then fares
  const demandSignals: DemandSignal[] = [...eventSignals, ...fareSignals];

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
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 p-4 animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-24 mb-2" />
                  <div className="h-8 bg-slate-700 rounded w-32" />
                </div>
              ))}
            </>
          ) : !hubMetrics ? (
            <>
              {['Daily Revenue', 'RASM', 'Yield', 'Rev/Departure'].map((title) => (
                <div key={title} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <div className="text-xs text-slate-500 mb-1">{title}</div>
                  <div className="text-lg font-medium text-slate-500">No data</div>
                </div>
              ))}
            </>
          ) : (
            <>
              <RevenueMetricCard
                title="Daily Revenue"
                value={hubMetrics.dailyRevenue}
                previousValue={hubMetrics.previousRevenue}
                metricType="currency"
                subtitle="calculated from routes"
                isLive
                lastUpdate={lastUpdate}
              />
              <RevenueMetricCard
                title="RASM"
                value={hubMetrics.rasmCents}
                previousValue={hubMetrics.previousRasm}
                metricType="rasm"
                subtitle="weighted avg"
                isLive
                lastUpdate={lastUpdate}
                showAbsoluteDelta={false}
              />
              <RevenueMetricCard
                title="Yield"
                value={hubMetrics.yieldCents}
                previousValue={hubMetrics.previousYield}
                metricType="yield"
                subtitle="estimated"
                isLive
                lastUpdate={lastUpdate}
                showAbsoluteDelta={false}
              />
              <RevenueMetricCard
                title="Rev/Departure"
                value={hubMetrics.revPerDeparture}
                previousValue={hubMetrics.previousRevPerDeparture}
                metricType="currency"
                subtitle="estimated"
                isLive
                lastUpdate={lastUpdate}
              />
            </>
          )}
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

        {/* Demand Signals - Live from SerpAPI and Events API */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              {hubCode} Demand Signals
            </h3>
            <div className="flex items-center gap-2">
              {(loadingFares || loadingEvents) && (
                <span className="text-xs text-blue-400">
                  {loadingEvents ? 'Events...' : 'Fares...'}
                </span>
              )}
              <span className="text-xs text-slate-500">
                Fares: {apiBudget.remaining}/{apiBudget.limit}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-700/50">
            {(loadingFares && loadingEvents) ? (
              <div className="px-4 py-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-2" />
                <div className="text-slate-500 text-sm">Fetching demand signals...</div>
              </div>
            ) : demandSignals.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="text-slate-500 text-sm mb-2">
                  {apiBudget.remaining === 0
                    ? 'Daily API budget exhausted'
                    : 'No demand signals for this hub'}
                </div>
                <p className="text-xs text-slate-600">
                  {apiBudget.remaining === 0
                    ? 'Budget resets at midnight. Cached data may be available.'
                    : 'Events and fares are within normal range.'}
                </p>
              </div>
            ) : (
              demandSignals.map((signal, i) => (
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
              ))
            )}
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
