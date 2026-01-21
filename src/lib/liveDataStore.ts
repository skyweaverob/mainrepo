// Live Data Store for SkyWeave
// Manages real-time data feeds, connection status, and alerts

import { create } from 'zustand';

// Feed types that we track
export type FeedType = 'fares' | 'flights' | 'bookings' | 'events';

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
  revenueDelta: number; // % change vs same day last week
  rasmCents: number;
  hasAlert: boolean;
  lastUpdate: Date | null;
}

// Network-wide metrics
export interface NetworkHealth {
  totalDailyRevenue: number;
  revenueDelta: number;
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
}

// Default hub configuration (Spirit Airlines)
const DEFAULT_HUBS: HubHealth[] = [
  { code: 'DTW', name: 'Detroit', dailyRevenue: 0, revenueDelta: 0, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'MCO', name: 'Orlando', dailyRevenue: 0, revenueDelta: 0, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'FLL', name: 'Fort Lauderdale', dailyRevenue: 0, revenueDelta: 0, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'LAS', name: 'Las Vegas', dailyRevenue: 0, revenueDelta: 0, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'EWR', name: 'Newark', dailyRevenue: 0, revenueDelta: 0, rasmCents: 0, hasAlert: false, lastUpdate: null },
  { code: 'P2P', name: 'Point-to-Point', dailyRevenue: 0, revenueDelta: 0, rasmCents: 0, hasAlert: false, lastUpdate: null },
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
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  // Network health
  networkHealth: {
    totalDailyRevenue: 13500000, // $13.5M default
    revenueDelta: 2.1,
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
