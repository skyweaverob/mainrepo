'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { SegmentBar } from './SegmentBar';

interface Route {
  origin: string;
  destination: string;
  route_key: string;
  total_pax: number;
  avg_load_factor: number | null;
  avg_spill_rate: number | null;
  avg_fare: number | null;
  segment_mix?: Record<string, number>;
}

interface RouteTableProps {
  routes: Route[];
  onRouteSelect: (route: { origin: string; destination: string }) => void;
  selectedRoute?: { origin: string; destination: string } | null;
}

type SortField = 'route_key' | 'total_pax' | 'avg_load_factor' | 'avg_fare';
type SortDirection = 'asc' | 'desc';

// Moved outside component to avoid re-creation during render
function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === 'asc' ? (
    <ChevronUp className="w-4 h-4" />
  ) : (
    <ChevronDown className="w-4 h-4" />
  );
}

export function RouteTable({ routes, onRouteSelect, selectedRoute }: RouteTableProps) {
  const [sortField, setSortField] = useState<SortField>('total_pax');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedRoutes = useMemo(() => {
    let filtered = routes;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      filtered = routes.filter(r =>
        r.route_key.includes(query) ||
        r.origin.includes(query) ||
        r.destination.includes(query)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null) aVal = 0;
      if (bVal === null) bVal = 0;

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [routes, sortField, sortDirection, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="card">
      {/* Search */}
      <div className="p-4 border-b border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search routes (e.g., FLL, BOS, FLL-BOS)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => handleSort('route_key')}
              >
                <div className="flex items-center gap-1">
                  Route
                  <SortIcon field="route_key" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => handleSort('total_pax')}
              >
                <div className="flex items-center justify-end gap-1">
                  Pax
                  <SortIcon field="total_pax" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => handleSort('avg_load_factor')}
              >
                <div className="flex items-center justify-end gap-1">
                  Load Factor
                  <SortIcon field="avg_load_factor" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => handleSort('avg_fare')}
              >
                <div className="flex items-center justify-end gap-1">
                  Avg Fare
                  <SortIcon field="avg_fare" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Segment Mix
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredAndSortedRoutes.map((route) => {
              const isSelected = selectedRoute?.origin === route.origin &&
                                selectedRoute?.destination === route.destination;

              return (
                <tr
                  key={route.route_key}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-900/30'
                      : 'hover:bg-slate-800/50'
                  }`}
                  onClick={() => onRouteSelect({ origin: route.origin, destination: route.destination })}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-200">{route.origin}</span>
                      <span className="text-slate-500">→</span>
                      <span className="font-mono text-sm text-slate-200">{route.destination}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-200">{route.total_pax.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm ${
                      route.avg_load_factor && route.avg_load_factor > 0.85
                        ? 'text-green-400'
                        : route.avg_load_factor && route.avg_load_factor < 0.7
                          ? 'text-orange-400'
                          : 'text-slate-200'
                    }`}>
                      {route.avg_load_factor
                        ? `${(route.avg_load_factor * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-200">
                      {route.avg_fare ? `$${route.avg_fare.toFixed(0)}` : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-48">
                    {route.segment_mix ? (
                      <SegmentBar
                        segments={route.segment_mix}
                        height={16}
                        showLabels={false}
                      />
                    ) : (
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-slate-700 text-sm text-slate-400">
        Showing {filteredAndSortedRoutes.length} of {routes.length} routes
      </div>
    </div>
  );
}
