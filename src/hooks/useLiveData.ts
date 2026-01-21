// Live Data Hook for SkyWeave
// Manages polling intervals, data freshness, and triggers updates

import { useEffect, useCallback, useRef } from 'react';
import { useLiveDataStore, FeedType, HubHealth, LiveFareData } from '@/lib/liveDataStore';
import * as api from '@/lib/api';
import * as fareService from '@/lib/fareService';

// Polling intervals in milliseconds
// Note: Fares are NOT polled on interval - they use rate-limited on-demand fetching
const POLLING_INTERVALS: Record<FeedType, number> = {
  fares: 300000,     // 5 minutes - just to check budget status, not fetch
  flights: 30000,    // 30 seconds for flight status
  bookings: 45000,   // 45 seconds for booking data
  events: 180000,    // 3 minutes for events (less frequent)
};

// Priority routes to fetch fares for (high-traffic, competitive markets)
const PRIORITY_ROUTES = [
  { origin: 'FLL', destination: 'BOS' },
  { origin: 'DTW', destination: 'MCO' },
  { origin: 'LAS', destination: 'LAX' },
  { origin: 'EWR', destination: 'MIA' },
  { origin: 'MCO', destination: 'DTW' },
];

// Hub codes to monitor
const HUB_CODES = ['DTW', 'MCO', 'FLL', 'LAS', 'EWR'];

interface UseLiveDataOptions {
  enabled?: boolean;
  onUpdate?: (feed: FeedType, data: unknown) => void;
  onError?: (feed: FeedType, error: Error) => void;
}

export function useLiveData(options: UseLiveDataOptions = {}) {
  const { enabled = true, onUpdate, onError } = options;

  const {
    feeds,
    setFeedStatus,
    updateFeedTimestamp,
    setIsConnected,
    incrementConnectionAttempts,
    resetConnectionAttempts,
    setNetworkHealth,
    setLastGlobalUpdate,
    isPolling,
    setIsPolling,
    addAlert,
    networkHealth,
    liveFares,
    setLiveFare,
    setApiBudget,
  } = useLiveDataStore();

  const intervalsRef = useRef<Record<FeedType, NodeJS.Timeout | null>>({
    fares: null,
    flights: null,
    bookings: null,
    events: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch fare data using rate-limited SerpAPI service
  const fetchFares = useCallback(async () => {
    try {
      // Update budget status
      const budget = fareService.getRemainingBudget();
      setApiBudget(budget);

      // Only fetch if we have budget
      if (!fareService.hasBudget()) {
        setFeedStatus('fares', {
          lastUpdate: new Date(),
          isConnected: true,
          recordCount: liveFares.size,
          error: 'Daily API budget exhausted (500 calls)',
        });
        return;
      }

      // Fetch fares for priority routes (max 5 at a time to conserve budget)
      const results = await fareService.fetchFaresForRoutes(PRIORITY_ROUTES, 5);

      let alertsGenerated = 0;
      results.forEach((data, route) => {
        // Store in live fares
        const fareData: LiveFareData = {
          route: data.route,
          minFare: data.minFare,
          nkFare: data.nkFare,
          fareAdvantage: data.fareAdvantage,
          competitorCount: data.competitorFares.length,
          fetchedAt: data.fetchedAt,
          isStale: data.isStale,
        };
        setLiveFare(route, fareData);

        // Check for alerts (compare with previous min fare if we have it)
        const prevFare = liveFares.get(route);
        const alert = fareService.detectFareAlert(data, prevFare?.minFare ?? null);

        if (alert?.hasAlert) {
          addAlert({
            type: 'competitor_fare',
            severity: alert.severity,
            title: `Fare Alert: ${route}`,
            message: alert.message,
            route,
            data: { ...data } as unknown as Record<string, unknown>,
          });
          alertsGenerated++;
        }
      });

      setFeedStatus('fares', {
        lastUpdate: new Date(),
        isConnected: true,
        recordCount: results.size,
        error: null,
      });

      onUpdate?.('fares', { routes: Array.from(results.keys()), alertsGenerated });
      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setFeedStatus('fares', { error: err.message, isConnected: false });
      onError?.('fares', err);
      throw error;
    }
  }, [setFeedStatus, setLiveFare, setApiBudget, addAlert, liveFares, onUpdate, onError]);

  // Fetch flight/schedule data
  const fetchFlights = useCallback(async () => {
    try {
      // Get network stats as a proxy for flight data
      const response = await api.getNetworkStats();

      setFeedStatus('flights', {
        lastUpdate: new Date(),
        isConnected: true,
        recordCount: response.total_records || 0,
        error: null,
      });

      onUpdate?.('flights', response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setFeedStatus('flights', { error: err.message, isConnected: false });
      onError?.('flights', err);
      throw error;
    }
  }, [setFeedStatus, onUpdate, onError]);

  // Fetch booking data
  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.getNetworkPosition();

      setFeedStatus('bookings', {
        lastUpdate: new Date(),
        isConnected: true,
        recordCount: response.total_nk_passengers || 0,
        error: null,
      });

      onUpdate?.('bookings', response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setFeedStatus('bookings', { error: err.message, isConnected: false });
      onError?.('bookings', err);
      throw error;
    }
  }, [setFeedStatus, onUpdate, onError]);

  // Fetch events/intelligence data
  const fetchEvents = useCallback(async () => {
    try {
      const response = await api.getExecutiveInsights();

      setFeedStatus('events', {
        lastUpdate: new Date(),
        isConnected: true,
        recordCount: response.length || 0,
        error: null,
      });

      // Check for high priority insights and create alerts
      const highPriorityInsights = response.filter(i => i.priority === 'high');
      highPriorityInsights.forEach(insight => {
        addAlert({
          type: 'event',
          severity: 'warning',
          title: insight.headline,
          message: insight.detail,
          data: insight as unknown as Record<string, unknown>,
        });
      });

      onUpdate?.('events', response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setFeedStatus('events', { error: err.message, isConnected: false });
      onError?.('events', err);
      throw error;
    }
  }, [setFeedStatus, addAlert, onUpdate, onError]);

  // Fetch hub health data for header
  const fetchHubHealth = useCallback(async () => {
    try {
      const [hubSummary, marketIntelligence] = await Promise.all([
        api.getHubSummary(),
        api.getMarketIntelligence(100),
      ]);

      // Calculate revenue per hub from market intelligence
      const hubRevenues: Record<string, number> = {};
      const hubRasm: Record<string, number> = {};

      HUB_CODES.forEach(hub => {
        const hubRoutes = marketIntelligence.filter(
          m => m.origin === hub || m.destination === hub
        );
        const totalPax = hubRoutes.reduce((sum, r) => sum + (r.nk_passengers || 0), 0);
        const avgFare = hubRoutes.length > 0
          ? hubRoutes.reduce((sum, r) => sum + (r.nk_avg_fare || 0), 0) / hubRoutes.length
          : 120; // default fare

        hubRevenues[hub] = totalPax * avgFare / 365; // daily revenue estimate
        hubRasm[hub] = avgFare / (hubRoutes[0]?.distance || 1000) * 100; // RASM in cents
      });

      // Calculate P2P (non-hub routes)
      const p2pRoutes = marketIntelligence.filter(
        m => !HUB_CODES.includes(m.origin) && !HUB_CODES.includes(m.destination)
      );
      const p2pPax = p2pRoutes.reduce((sum, r) => sum + (r.nk_passengers || 0), 0);
      hubRevenues['P2P'] = p2pPax * 100 / 365;
      hubRasm['P2P'] = 9.8;

      const totalRevenue = Object.values(hubRevenues).reduce((sum, r) => sum + r, 0);

      // Alert threshold: RASM below 10 cents indicates underperformance
      const RASM_ALERT_THRESHOLD = 10;

      const hubs: HubHealth[] = [
        ...HUB_CODES.map(code => {
          const rasm = hubRasm[code] || 0;
          return {
            code,
            name: getHubName(code),
            dailyRevenue: hubRevenues[code] || 0,
            revenueDelta: null, // No historical data available for comparison
            rasmCents: rasm,
            hasAlert: rasm > 0 && rasm < RASM_ALERT_THRESHOLD, // Alert on low RASM
            lastUpdate: new Date(),
          };
        }),
        {
          code: 'P2P',
          name: 'Point-to-Point',
          dailyRevenue: hubRevenues['P2P'] || 0,
          revenueDelta: null, // No historical data
          rasmCents: hubRasm['P2P'] || 0,
          hasAlert: false,
          lastUpdate: new Date(),
        },
      ];

      setNetworkHealth({
        totalDailyRevenue: totalRevenue,
        revenueDelta: null, // No historical data for network-wide delta
        hubs,
        lastUpdate: new Date(),
      });

      setLastGlobalUpdate(new Date());
      setIsConnected(true);
      resetConnectionAttempts();

    } catch (error) {
      incrementConnectionAttempts();
      console.error('Failed to fetch hub health:', error);
    }
  }, [setNetworkHealth, setLastGlobalUpdate, setIsConnected, resetConnectionAttempts, incrementConnectionAttempts]);

  // Start polling for all feeds
  const startPolling = useCallback(() => {
    if (isPolling) return;

    setIsPolling(true);

    // Initial fetch
    fetchFares().catch(console.error);
    fetchFlights().catch(console.error);
    fetchBookings().catch(console.error);
    fetchEvents().catch(console.error);
    fetchHubHealth().catch(console.error);

    // Set up intervals
    intervalsRef.current.fares = setInterval(fetchFares, POLLING_INTERVALS.fares);
    intervalsRef.current.flights = setInterval(fetchFlights, POLLING_INTERVALS.flights);
    intervalsRef.current.bookings = setInterval(fetchBookings, POLLING_INTERVALS.bookings);
    intervalsRef.current.events = setInterval(fetchEvents, POLLING_INTERVALS.events);

    // Hub health refresh every 30 seconds
    const hubInterval = setInterval(fetchHubHealth, 30000);

    // Store hub interval for cleanup
    (intervalsRef.current as Record<string, NodeJS.Timeout | null>)['hub'] = hubInterval;

  }, [isPolling, setIsPolling, fetchFares, fetchFlights, fetchBookings, fetchEvents, fetchHubHealth]);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);

    Object.values(intervalsRef.current).forEach(interval => {
      if (interval) clearInterval(interval);
    });

    intervalsRef.current = {
      fares: null,
      flights: null,
      bookings: null,
      events: null,
    };

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [setIsPolling]);

  // Manual refresh for a specific feed
  const refreshFeed = useCallback(async (feed: FeedType) => {
    switch (feed) {
      case 'fares':
        return fetchFares();
      case 'flights':
        return fetchFlights();
      case 'bookings':
        return fetchBookings();
      case 'events':
        return fetchEvents();
    }
  }, [fetchFares, fetchFlights, fetchBookings, fetchEvents]);

  // Fetch live fares for a specific route (on-demand, rate-limited)
  const fetchRouteFares = useCallback(async (origin: string, destination: string, forceFresh = false) => {
    const budget = fareService.getRemainingBudget();
    setApiBudget(budget);

    if (!fareService.hasBudget() && !forceFresh) {
      // Return cached data if available
      const cached = liveFares.get(`${origin}-${destination}`);
      return cached ?? null;
    }

    try {
      const data = await fareService.fetchLiveFares(origin, destination, undefined, forceFresh);

      const fareData: LiveFareData = {
        route: data.route,
        minFare: data.minFare,
        nkFare: data.nkFare,
        fareAdvantage: data.fareAdvantage,
        competitorCount: data.competitorFares.length,
        fetchedAt: data.fetchedAt,
        isStale: data.isStale,
      };
      setLiveFare(`${origin}-${destination}`, fareData);

      // Check for alert
      const prevFare = liveFares.get(`${origin}-${destination}`);
      const alert = fareService.detectFareAlert(data, prevFare?.minFare ?? null);

      if (alert?.hasAlert) {
        addAlert({
          type: 'competitor_fare',
          severity: alert.severity,
          title: `Fare Alert: ${origin}-${destination}`,
          message: alert.message,
          route: `${origin}-${destination}`,
          data: { ...data } as unknown as Record<string, unknown>,
        });
      }

      // Update budget after call
      setApiBudget(fareService.getRemainingBudget());

      return fareData;
    } catch (error) {
      console.error('Failed to fetch route fares:', error);
      return liveFares.get(`${origin}-${destination}`) ?? null;
    }
  }, [setLiveFare, setApiBudget, addAlert, liveFares]);

  // Get current API budget status
  const getApiBudget = useCallback(() => {
    return fareService.getRemainingBudget();
  }, []);

  // Effect to manage polling lifecycle
  // Using refs to avoid infinite loop from callback recreation
  const startPollingRef = useRef(startPolling);
  const stopPollingRef = useRef(stopPolling);
  startPollingRef.current = startPolling;
  stopPollingRef.current = stopPolling;

  useEffect(() => {
    if (enabled) {
      startPollingRef.current();
    }

    return () => {
      stopPollingRef.current();
    };
  }, [enabled]);

  return {
    feeds,
    networkHealth,
    liveFares,
    isPolling,
    startPolling,
    stopPolling,
    refreshFeed,
    refreshAll: fetchHubHealth,
    // Live fare functions
    fetchRouteFares,
    getApiBudget,
  };
}

// Helper to get hub display name
function getHubName(code: string): string {
  const names: Record<string, string> = {
    DTW: 'Detroit',
    MCO: 'Orlando',
    FLL: 'Fort Lauderdale',
    LAS: 'Las Vegas',
    EWR: 'Newark',
    P2P: 'Point-to-Point',
  };
  return names[code] || code;
}

// Hook to get freshness info for a specific value
export function useFreshness(lastUpdate: Date | null, thresholds?: { fresh?: number; aging?: number }) {
  const { fresh = 30, aging = 120 } = thresholds || {};

  if (!lastUpdate) {
    return {
      level: 'disconnected' as const,
      ageSeconds: Infinity,
      isLive: false,
      isStale: true,
    };
  }

  const ageSeconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  return {
    level: ageSeconds < fresh ? 'live' as const : ageSeconds < aging ? 'aging' as const : 'stale' as const,
    ageSeconds,
    isLive: ageSeconds < fresh,
    isStale: ageSeconds >= aging,
  };
}

// Hook for triggering flash animations on value changes
export function useValueFlash(value: unknown) {
  const prevValueRef = useRef(value);
  const hasChanged = prevValueRef.current !== value;

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  return hasChanged;
}
