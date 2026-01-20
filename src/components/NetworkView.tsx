'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plane, TrendingUp, AlertTriangle, MapPin } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { RouteTable } from './RouteTable';
import { RouteDetail } from './RouteDetail';
import { HubSelector } from './HubSelector';
import { SegmentBar } from './SegmentBar';
import * as api from '@/lib/api';

interface NetworkViewProps {
  initialData?: {
    stats: any;
    hubs: any;
    routes: any[];
  };
}

export function NetworkView({ initialData }: NetworkViewProps) {
  const [networkStats, setNetworkStats] = useState<any>(initialData?.stats || null);
  const [hubSummary, setHubSummary] = useState<any>(initialData?.hubs || null);
  const [routes, setRoutes] = useState<any[]>(initialData?.routes || []);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<{ origin: string; destination: string } | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [routeDecompositions, setRouteDecompositions] = useState<Record<string, any>>({});

  // Fetch initial data
  useEffect(() => {
    if (initialData) return;

    async function fetchData() {
      try {
        const [stats, hubs, routesData] = await Promise.all([
          api.getNetworkStats(),
          api.getHubSummary(),
          api.getRoutes({ limit: 100 }),
        ]);

        setNetworkStats(stats);
        setHubSummary(hubs);
        setRoutes(routesData);
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
          console.error(`Failed to fetch decomposition for ${route.route_key}:`, error);
        }
      }
    }

    if (routes.length > 0) {
      fetchDecompositions();
    }
  }, [routes]);

  // Add segment_mix to routes
  const routesWithSegments = routes.map(route => ({
    ...route,
    segment_mix: routeDecompositions[route.route_key]?.segment_mix,
  }));

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Network Overview</h1>
            <p className="text-sm text-slate-400 mt-1">
              Demand decomposition across {networkStats?.unique_routes || 0} routes
            </p>
          </div>
          <HubSelector
            hubs={hubData}
            selectedHub={selectedHub}
            onSelect={setSelectedHub}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Routes"
          value={networkStats?.unique_routes || 0}
          icon={MapPin}
        />
        <MetricCard
          title="Total Passengers"
          value={networkStats?.total_pax
            ? `${(networkStats.total_pax / 1000000).toFixed(1)}M`
            : '-'}
          icon={Plane}
        />
        <MetricCard
          title="Avg Load Factor"
          value={networkStats?.avg_load_factor
            ? `${(networkStats.avg_load_factor * 100).toFixed(1)}%`
            : '-'}
          icon={TrendingUp}
          color={networkStats?.avg_load_factor > 0.85 ? 'green' : 'default'}
        />
        <MetricCard
          title="Airports Served"
          value={networkStats?.unique_airports || 0}
          icon={MapPin}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 px-6 pb-6 gap-6">
        {/* Route Table */}
        <div className={`${selectedRoute ? 'w-1/2' : 'w-full'} flex flex-col min-h-0 transition-all duration-300`}>
          <RouteTable
            routes={routesWithSegments}
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
