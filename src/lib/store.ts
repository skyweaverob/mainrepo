import { create } from 'zustand';
import type { DataStatus, Route, RouteDecomposition, NetworkStats, HubSummary, Scenario } from '@/types';

interface AppState {
  // Data status
  dataStatus: DataStatus | null;
  setDataStatus: (status: DataStatus) => void;

  // Network data
  networkStats: NetworkStats | null;
  setNetworkStats: (stats: NetworkStats) => void;
  hubSummary: HubSummary | null;
  setHubSummary: (summary: HubSummary) => void;
  routes: Route[];
  setRoutes: (routes: Route[]) => void;

  // Selected route
  selectedRoute: { origin: string; destination: string } | null;
  setSelectedRoute: (route: { origin: string; destination: string } | null) => void;
  routeDecomposition: RouteDecomposition | null;
  setRouteDecomposition: (decomposition: RouteDecomposition | null) => void;

  // Scenarios
  scenarios: Scenario[];
  setScenarios: (scenarios: Scenario[]) => void;
  selectedScenario: string | null;
  setSelectedScenario: (scenario: string | null) => void;

  // Filters
  selectedHub: string | null;
  setSelectedHub: (hub: string | null) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Active view - simplified to 4 main tabs + legacy support + OS Control Room
  activeView: 'network' | 'controlroom' | 'tradeoffs' | 'operations' | 'analytics' | 'route' | 'fleet' | 'crew' | 'mro' | 'scenarios' | 'intelligence' | 'booking' | 'crossdomain';
  setActiveView: (view: 'network' | 'controlroom' | 'tradeoffs' | 'operations' | 'analytics' | 'route' | 'fleet' | 'crew' | 'mro' | 'scenarios' | 'intelligence' | 'booking' | 'crossdomain') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Data status
  dataStatus: null,
  setDataStatus: (status) => set({ dataStatus: status }),

  // Network data
  networkStats: null,
  setNetworkStats: (stats) => set({ networkStats: stats }),
  hubSummary: null,
  setHubSummary: (summary) => set({ hubSummary: summary }),
  routes: [],
  setRoutes: (routes) => set({ routes }),

  // Selected route
  selectedRoute: null,
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  routeDecomposition: null,
  setRouteDecomposition: (decomposition) => set({ routeDecomposition: decomposition }),

  // Scenarios
  scenarios: [],
  setScenarios: (scenarios) => set({ scenarios }),
  selectedScenario: null,
  setSelectedScenario: (scenario) => set({ selectedScenario: scenario }),

  // Filters
  selectedHub: null,
  setSelectedHub: (hub) => set({ selectedHub: hub }),

  // UI state
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Active view - default to Control Room (the OS decision interface)
  activeView: 'controlroom',
  setActiveView: (view) => set({ activeView: view }),
}));
