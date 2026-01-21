// Live Data Store for SkyWeave
// Manages real-time data feeds, connection status, and alerts

import { create } from 'zustand';

// Feed types that we track
export type FeedType = 'fares' | 'flights' | 'bookings' | 'events';

// Live fare data from SerpAPI
export interface LiveFareData {
  route: string;
  minFare: number | null;
  nkFare: number | null;
  fareAdvantage: number | null;
  competitorCount: number;
  fetchedAt: Date;
  isStale: boolean;
}

// API budget tracking
export interface ApiBudget {
  used: number;
  remaining: number;
  limit: number;
}

// Status of each feed
export interface FeedStatus {
  lastUpdate: Date | null;
  isConnected: boolean;
  recordCount: number;
  error: string | null;
}

// Real-time alert/notification
export interface LiveAlert {
  id: string;
  type: 'demand_surge' | 'competitor_fare' | 'booking_pace' | 'weather' | 'event' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  route?: string;
  hub?: string;
  timestamp: Date;
  isRead: boolean;
  data?: Record<string, unknown>;
}

// Hub health data for header display
export interface HubHealth {
  code: string;
  name: string;
  dailyRevenue: number;
  revenueDelta: number | null; // % change vs same day last week (null if no historical data)
  rasmCents: number;
  hasAlert: boolean;
  lastUpdate: Date | null;
}

// Network-wide metrics
export interface NetworkHealth {
  totalDailyRevenue: number;
  revenueDelta: number | null; // null if no historical data available
  hubs: HubHealth[];
  lastUpdate: Date | null;
}

// Store interface
interface LiveDataState {
  // Feed statuses
  feeds: Record<FeedType, FeedStatus>;
  setFeedStatus: (feed: FeedType, status: Partial<FeedStatus>) => void;
  updateFeedTimestamp: (feed: FeedType) => void;

  // Overall connection state
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  connectionAttempts: number;
  incrementConnectionAttempts: () => void;
  resetConnectionAttempts: () => void;

  // Alerts
  alerts: LiveAlert[];
  addAlert: (alert: Omit<LiveAlert, 'id' | 'timestamp' | 'isRead'>) => void;
  markAlertRead: (id: string) => void;
  dismissAlert: (id: string) => void;
  clearAllAlerts: () => void;
  unreadAlertCount: number;

  // Network health for header
  networkHealth: NetworkHealth | null;
  setNetworkHealth: (health: NetworkHealth) => void;

  // Last global update
  lastGlobalUpdate: Date | null;
  setLastGlobalUpdate: (date: Date) => void;

  // Polling control
  isPolling: boolean;
  setIsPolling: (polling: boolean) => void;

  // Live fares from SerpAPI
  liveFares: Map<string, LiveFareData>;
  setLiveFare: (route: string, data: LiveFareData) => void;
  getLiveFare: (route: string) => LiveFareData | undefined;
  clearLiveFares: () => void;

  // API budget tracking
  apiBudget: ApiBudget;
  setApiBudget: (budget: ApiBudget) => void;
}

// Default hub configuration (Spirit Airlines)
const DEFAULT_HUBS: HubHealth[] = [
  { code: 'DTW', name: 'Detroit', dailyRevenue: 0, revenueDelta: null, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'MCO', name: 'Orlando', dailyRevenue: 0, revenueDelta: null, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'FLL', name: 'Fort Lauderdale', dailyRevenue: 0, revenueDelta: null, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'LAS', name: 'Las Vegas', dailyRevenue: 0, revenueDelta: null, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'EWR', name: 'Newark', dailyRevenue: 0, revenueDelta: null, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'P2P', name: 'Point-to-Point', dailyRevenue: 0, revenueDelta: null, rasmCents: 0, hasAlert: false, lastUpdate: null },
];

// Default feed status
const defaultFeedStatus: FeedStatus = {
  lastUpdate: null,
  isConnected: false,
  recordCount: 0,
  error: null,
};

// Generate unique ID for alerts
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export const useLiveDataStore = create<LiveDataState>((set, get) => ({
  // Feed statuses
  feeds: {
    fares: { ...defaultFeedStatus },
    flights: { ...defaultFeedStatus },
    bookings: { ...defaultFeedStatus },
    events: { ...defaultFeedStatus },
  },

  setFeedStatus: (feed, status) =>
    set((state) => ({
      feeds: {
        ...state.feeds,
        [feed]: { ...state.feeds[feed], ...status },
      },
    })),

  updateFeedTimestamp: (feed) =>
    set((state) => ({
      feeds: {
        ...state.feeds,
        [feed]: { ...state.feeds[feed], lastUpdate: new Date(), isConnected: true },
      },
    })),

  // Connection state
  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),
  connectionAttempts: 0,
  incrementConnectionAttempts: () =>
    set((state) => ({ connectionAttempts: state.connectionAttempts + 1 })),
  resetConnectionAttempts: () => set({ connectionAttempts: 0 }),

  // Alerts
  alerts: [],

  addAlert: (alert) =>
    set((state) => {
      const newAlert: LiveAlert = {
        ...alert,
        id: generateAlertId(),
        timestamp: new Date(),
        isRead: false,
      };
      // Keep only last 50 alerts
      const newAlerts = [newAlert, ...state.alerts].slice(0, 50);
      return {
        alerts: newAlerts,
        unreadAlertCount: newAlerts.filter((a) => !a.isRead).length,
      };
    }),

  markAlertRead: (id) =>
    set((state) => {
      const newAlerts = state.alerts.map((a) =>
        a.id === id ? { ...a, isRead: true } : a
      );
      return {
        alerts: newAlerts,
        unreadAlertCount: newAlerts.filter((a) => !a.isRead).length,
      };
    }),

  dismissAlert: (id) =>
    set((state) => {
      const newAlerts = state.alerts.filter((a) => a.id !== id);
      return {
        alerts: newAlerts,
        unreadAlertCount: newAlerts.filter((a) => !a.isRead).length,
      };
    }),

  clearAllAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),

  unreadAlertCount: 0,

  // Network health - starts empty, populated from API
  networkHealth: {
    totalDailyRevenue: 0,
    revenueDelta: null,
    hubs: DEFAULT_HUBS,
    lastUpdate: null,
  },

  setNetworkHealth: (health) => set({ networkHealth: health }),

  // Global update tracking
  lastGlobalUpdate: null,
  setLastGlobalUpdate: (date) => set({ lastGlobalUpdate: date }),

  // Polling control
  isPolling: false,
  setIsPolling: (polling) => set({ isPolling: polling }),

  // Live fares from SerpAPI
  liveFares: new Map<string, LiveFareData>(),
  setLiveFare: (route, data) =>
    set((state) => {
      const newFares = new Map(state.liveFares);
      newFares.set(route, data);
      return { liveFares: newFares };
    }),
  getLiveFare: (route) => {
    // Note: This is a selector pattern, use with get()
    return undefined; // Implemented via direct state access
  },
  clearLiveFares: () => set({ liveFares: new Map() }),

  // API budget tracking
  apiBudget: { used: 0, remaining: 500, limit: 500 },
  setApiBudget: (budget) => set({ apiBudget: budget }),
}));

// Selectors for common patterns
export const selectFeedAge = (feed: FeedType) => (state: LiveDataState) => {
  const lastUpdate = state.feeds[feed].lastUpdate;
  if (!lastUpdate) return Infinity;
  return (Date.now() - lastUpdate.getTime()) / 1000;
};

export const selectAllFeedsConnected = (state: LiveDataState) =>
  Object.values(state.feeds).every((f) => f.isConnected);

export const selectAnyFeedStale = (staleThresholdSeconds: number = 300) => (state: LiveDataState) =>
  Object.values(state.feeds).some((f) => {
    if (!f.lastUpdate) return true;
    return (Date.now() - f.lastUpdate.getTime()) / 1000 > staleThresholdSeconds;
  });
