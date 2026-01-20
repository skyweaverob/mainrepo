'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { MetricCard } from './MetricCard';
import * as api from '@/lib/api';

export function ScenarioView() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario1, setSelectedScenario1] = useState<string | null>(null);
  const [selectedScenario2, setSelectedScenario2] = useState<string | null>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    async function fetchScenarios() {
      try {
        const data = await api.getScenarios();
        setScenarios(data);
        if (data.length >= 2) {
          setSelectedScenario1(data[0].name);
          setSelectedScenario2(data[1].name);
        }
      } catch (error) {
        console.error('Failed to fetch scenarios:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchScenarios();
  }, []);

  useEffect(() => {
    async function fetchComparison() {
      if (selectedScenario1 && selectedScenario2) {
        setComparing(true);
        try {
          const data = await api.compareScenarios(selectedScenario1, selectedScenario2);
          setComparison(data);
        } catch (error) {
          console.error('Failed to compare scenarios:', error);
          setComparison(null);
        } finally {
          setComparing(false);
        }
      }
    }

    fetchComparison();
  }, [selectedScenario1, selectedScenario2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No scenarios available</p>
          <p className="text-sm text-slate-500 mt-2">
            Upload network data with scenario labels to compare
          </p>
        </div>
      </div>
    );
  }

  const formatDelta = (value: number, format: 'number' | 'percent' | 'currency' = 'number') => {
    const sign = value > 0 ? '+' : '';
    if (format === 'percent') {
      return `${sign}${(value * 100).toFixed(2)}%`;
    }
    if (format === 'currency') {
      return `${sign}$${value.toLocaleString()}`;
    }
    return `${sign}${value.toLocaleString()}`;
  };

  // Prepare comparison chart data
  const comparisonChartData = comparison ? [
    {
      metric: 'Flights',
      [comparison.scenario1.name]: comparison.scenario1.flights,
      [comparison.scenario2.name]: comparison.scenario2.flights,
    },
    {
      metric: 'Pax (K)',
      [comparison.scenario1.name]: Math.round(comparison.scenario1.total_pax / 1000),
      [comparison.scenario2.name]: Math.round(comparison.scenario2.total_pax / 1000),
    },
    {
      metric: 'Revenue ($K)',
      [comparison.scenario1.name]: Math.round(comparison.scenario1.total_revenue / 1000),
      [comparison.scenario2.name]: Math.round(comparison.scenario2.total_revenue / 1000),
    },
  ] : [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold text-slate-100">Scenario Comparison</h1>
        <p className="text-sm text-slate-400 mt-1">
          Compare network performance across different scenarios
        </p>
      </div>

      {/* Scenario Selectors */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Scenario 1 (Base)</label>
            <select
              value={selectedScenario1 || ''}
              onChange={(e) => setSelectedScenario1(e.target.value || null)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
            >
              <option value="">Select scenario</option>
              {scenarios.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.flights.toLocaleString()} flights)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-5">
            <ArrowRight className="w-5 h-5 text-slate-500" />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Scenario 2 (Compare)</label>
            <select
              value={selectedScenario2 || ''}
              onChange={(e) => setSelectedScenario2(e.target.value || null)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100"
            >
              <option value="">Select scenario</option>
              {scenarios.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.flights.toLocaleString()} flights)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {comparing ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : comparison ? (
          <div className="space-y-6">
            {/* Delta Summary */}
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                title="Flights Delta"
                value={formatDelta(comparison.delta.flights)}
                color={comparison.delta.flights > 0 ? 'green' : comparison.delta.flights < 0 ? 'red' : 'default'}
                icon={comparison.delta.flights > 0 ? TrendingUp : TrendingDown}
              />
              <MetricCard
                title="Passenger Delta"
                value={formatDelta(comparison.delta.pax)}
                color={comparison.delta.pax > 0 ? 'green' : comparison.delta.pax < 0 ? 'red' : 'default'}
                icon={comparison.delta.pax > 0 ? TrendingUp : TrendingDown}
              />
              <MetricCard
                title="Load Factor Delta"
                value={formatDelta(comparison.delta.load_factor, 'percent')}
                color={comparison.delta.load_factor > 0 ? 'green' : comparison.delta.load_factor < 0 ? 'red' : 'default'}
                icon={comparison.delta.load_factor > 0 ? TrendingUp : TrendingDown}
              />
              <MetricCard
                title="Revenue Delta"
                value={formatDelta(comparison.delta.revenue, 'currency')}
                color={comparison.delta.revenue > 0 ? 'green' : comparison.delta.revenue < 0 ? 'red' : 'default'}
                icon={comparison.delta.revenue > 0 ? TrendingUp : TrendingDown}
              />
            </div>

            {/* Comparison Table */}
            <div className="grid grid-cols-2 gap-6">
              {/* Scenario 1 */}
              <div className="card p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-4">
                  {comparison.scenario1.name}
                  <span className="text-xs text-slate-500 ml-2">(Base)</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Flights</span>
                    <span className="text-slate-100 font-medium">
                      {comparison.scenario1.flights.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Passengers</span>
                    <span className="text-slate-100 font-medium">
                      {comparison.scenario1.total_pax.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Avg Load Factor</span>
                    <span className="text-slate-100 font-medium">
                      {comparison.scenario1.avg_load_factor
                        ? `${(comparison.scenario1.avg_load_factor * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Revenue</span>
                    <span className="text-slate-100 font-medium">
                      ${comparison.scenario1.total_revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scenario 2 */}
              <div className="card p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-4">
                  {comparison.scenario2.name}
                  <span className="text-xs text-slate-500 ml-2">(Compare)</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Flights</span>
                    <span className="text-slate-100 font-medium">
                      {comparison.scenario2.flights.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Passengers</span>
                    <span className="text-slate-100 font-medium">
                      {comparison.scenario2.total_pax.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Avg Load Factor</span>
                    <span className="text-slate-100 font-medium">
                      {comparison.scenario2.avg_load_factor
                        ? `${(comparison.scenario2.avg_load_factor * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Revenue</span>
                    <span className="text-slate-100 font-medium">
                      ${comparison.scenario2.total_revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="card p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Visual Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis dataKey="metric" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                    }}
                    formatter={(value) => String(value ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                  <Legend />
                  <Bar dataKey={comparison.scenario1.name} fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey={comparison.scenario2.name} fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div className="card p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Key Insights</h3>
              <div className="space-y-3">
                {comparison.delta.flights !== 0 && (
                  <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                    {comparison.delta.flights > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-slate-200">
                        {comparison.scenario2.name} has{' '}
                        <span className={comparison.delta.flights > 0 ? 'text-green-400' : 'text-red-400'}>
                          {Math.abs(comparison.delta.flights).toLocaleString()}
                          {comparison.delta.flights > 0 ? ' more' : ' fewer'}
                        </span>{' '}
                        flights than {comparison.scenario1.name}
                      </p>
                    </div>
                  </div>
                )}

                {comparison.delta.revenue !== 0 && (
                  <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                    {comparison.delta.revenue > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-slate-200">
                        Revenue{' '}
                        <span className={comparison.delta.revenue > 0 ? 'text-green-400' : 'text-red-400'}>
                          {comparison.delta.revenue > 0 ? 'increases' : 'decreases'}
                          {' '}by ${Math.abs(comparison.delta.revenue).toLocaleString()}
                        </span>{' '}
                        ({((comparison.delta.revenue / comparison.scenario1.total_revenue) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                )}

                {comparison.delta.load_factor !== 0 && (
                  <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                    {comparison.delta.load_factor > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-slate-200">
                        Load factor{' '}
                        <span className={comparison.delta.load_factor > 0 ? 'text-green-400' : 'text-orange-400'}>
                          {comparison.delta.load_factor > 0 ? 'improves' : 'decreases'}
                          {' '}by {Math.abs(comparison.delta.load_factor * 100).toFixed(2)} points
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Select two scenarios to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
