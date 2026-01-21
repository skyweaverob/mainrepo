'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { SegmentBar } from './SegmentBar';
import { formatCurrency, formatRASM } from '@/lib/formatters';
import { LiveDot } from './LiveFeedIndicator';

interface Route {
  origin: string;
  destination: string;
  route_key: string;
  total_pax: number;
  avg_load_factor?: number | null;
  avg_spill_rate?: number | null;
  avg_fare: number | null;
  segment_mix?: Record<string, number>;
  // New revenue fields
  daily_revenue?: number;
  rasm_cents?: number;
  contribution_margin?: number;
}

interface RouteTableProps {
  routes: Route[];
  onRouteSelect: (route: { origin: string; destination: string }) => void;
  selectedRoute?: { origin: string; destination: string } | null;
}

type SortField = 'route_key' | 'total_pax' | 'daily_revenue' | 'rasm_cents' | 'avg_fare';
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
  // Default sort by RASM (north star metric) descending
  const [sortField, setSortField] = useState<SortField>('rasm_cents');
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
      let aVal = (a as any)[sortField];
      let bVal = (b as any)[sortField];

      if (aVal === null || aVal === undefined) aVal = 0;
      if (bVal === null || bVal === undefined) bVal = 0;

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
    <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-slate-700 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search routes (e.g., FLL, BOS, FLL-BOS)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-800 z-10">
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
              {/* RASM first - North Star Metric */}
              <th
                className="px-4 py-3 text-right text-xs font-medium text-emerald-400 uppercase tracking-wider cursor-pointer hover:text-emerald-200"
                onClick={() => handleSort('rasm_cents')}
              >
                <div className="flex items-center justify-end gap-1">
                  RASM
                  <SortIcon field="rasm_cents" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => handleSort('daily_revenue')}
              >
                <div className="flex items-center justify-end gap-1">
                  Daily Rev
                  <SortIcon field="daily_revenue" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                onClick={() => handleSort('avg_fare')}
              >
                <div className="flex items-center justify-end gap-1">
                  Avg Fare
                  <LiveDot lastUpdate={new Date()} isConnected={true} />
                  <SortIcon field="avg_fare" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Segment Mix
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredAndSortedRoutes.map((route) => {
              const isSelected = selectedRoute?.origin === route.origin &&
                                selectedRoute?.destination === route.destination;

              // Determine profitability color
              const isProfitable = (route.contribution_margin || 0) > 0;
              const rasmGood = (route.rasm_cents || 0) >= 11;

              return (
                <tr
                  key={route.route_key}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-700/30'
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
                  {/* RASM first - North Star Metric */}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-bold ${
                      rasmGood ? 'text-emerald-400' : (route.rasm_cents || 0) >= 10 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {route.rasm_cents
                        ? formatRASM(route.rasm_cents)
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${
                      isProfitable ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {route.daily_revenue
                        ? formatCurrency(route.daily_revenue, { compact: true })
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-200">
                      {route.avg_fare ? `$${route.avg_fare.toFixed(0)}` : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-40">
                    {route.segment_mix ? (
                      <SegmentBar
                        segments={route.segment_mix}
                        height={16}
                        showLabels={false}
                      />
                    ) : (
                      <div className="h-4 bg-slate-700 rounded animate-pulse" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-slate-700 text-sm text-slate-400 flex-shrink-0">
        Showing {filteredAndSortedRoutes.length} of {routes.length} routes
        <span className="text-slate-600 ml-2">
          • Sorted by {sortField === 'daily_revenue' ? 'Daily Revenue' : sortField === 'rasm_cents' ? 'RASM' : sortField}
        </span>
      </div>
    </div>
  );
}

export default RouteTable;
