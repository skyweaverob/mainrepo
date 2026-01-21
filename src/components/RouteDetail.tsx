'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { X, TrendingUp, TrendingDown, AlertTriangle, Ship, Thermometer, Calendar, Plane, Users, Wrench, DollarSign, Network } from 'lucide-react';
import { SegmentBar } from './SegmentBar';
import { SEGMENT_COLORS, SEGMENT_LABELS, SegmentType } from '@/types';
import { formatCurrency, formatRASM } from '@/lib/formatters';
import * as api from '@/lib/api';

interface RouteDetailProps {
  origin: string;
  destination: string;
  onClose: () => void;
}

const DOW_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RouteDetail({ origin, destination, onClose }: RouteDetailProps) {
  const [decomposition, setDecomposition] = useState<any>(null);
  const [signals, setSignals] = useState<any>(null);
  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [routePnl, setRoutePnl] = useState<any>(null);
  const [marketIntel, setMarketIntel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [decompData, signalData] = await Promise.all([
          api.getRouteDecomposition(origin, destination),
          api.getAllSignals(origin, destination, 6, new Date().getMonth() + 1),
        ]);

        setDecomposition(decompData);
        setSignals(signalData);

        // Fetch route P&L and market intel in background (non-blocking)
        Promise.all([
          api.getRoutePnl(origin, destination),
          api.getMarketIntelligenceDetail(`${origin}_${destination}`),
          api.getLiveWeatherDifferential(origin, destination),
        ]).then(([pnl, intel, weather]) => {
          setRoutePnl(pnl);
          setMarketIntel(intel);
          setLiveWeather(weather);
        }).catch(console.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load route data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [origin, destination]);

  if (loading) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !decomposition) {
    return (
      <div className="card h-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{origin} → {destination}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-red-400">{error || 'No data available'}</div>
      </div>
    );
  }

  // Prepare DOW chart data
  const dowData = Object.entries(decomposition.dow_distribution || {}).map(([dow, pax]) => ({
    dow: DOW_LABELS[parseInt(dow)] || dow,
    pax: pax as number,
  }));

  // Prepare segment pie data
  const segmentData = Object.entries(decomposition.segment_mix || {})
    .filter(([, value]) => (value as number) > 0.01)
    .map(([segment, value]) => ({
      name: SEGMENT_LABELS[segment as SegmentType] || segment,
      value: Math.round((value as number) * 100),
      color: SEGMENT_COLORS[segment as SegmentType] || '#6b7280',
    }));

  // Extract signal explanations
  const cruiseSignal = signals?.signals?.cruise;
  const weatherSignal = signals?.signals?.weather;

  return (
    <div className="card h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[#1e293b] z-10 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              <span className="text-blue-400">{origin}</span>
              <span className="text-slate-400 mx-2">→</span>
              <span className="text-blue-400">{destination}</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {decomposition.total_records} flights analyzed
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* RASM - North Star Metric (highlighted) */}
        {routePnl && (
          <div className="p-4 bg-gradient-to-r from-emerald-900/30 to-slate-800 rounded-lg border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider mb-1">Route RASM</p>
                <p className={`text-3xl font-bold ${
                  routePnl.rasm_cents >= 12 ? 'text-emerald-400' :
                  routePnl.rasm_cents >= 10 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {routePnl.rasm_cents ? `${routePnl.rasm_cents.toFixed(1)}¢` : '-'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">vs Network Avg</p>
                <p className={`text-sm font-medium ${
                  (routePnl.rasm_cents || 0) > 11 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {routePnl.rasm_cents >= 11 ? '▲ Above' : '▼ Below'} average
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between text-sm">
              <span className="text-slate-400">Daily Revenue: <span className="text-white font-medium">{formatCurrency(routePnl.estimated_annual_revenue / 365, { compact: true })}</span></span>
              <span className="text-slate-400">Margin: <span className={routePnl.profit_margin_pct > 10 ? 'text-emerald-400' : 'text-amber-400'}>{routePnl.profit_margin_pct?.toFixed(1)}%</span></span>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Avg Load Factor</p>
            <p className={`text-2xl font-semibold ${
              decomposition.avg_load_factor > 0.85 ? 'text-green-400' :
              decomposition.avg_load_factor < 0.7 ? 'text-orange-400' : 'text-slate-100'
            }`}>
              {decomposition.avg_load_factor
                ? `${(decomposition.avg_load_factor * 100).toFixed(1)}%`
                : '-'}
            </p>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Spill Rate</p>
            <p className={`text-2xl font-semibold ${
              decomposition.avg_spill_rate > 0.1 ? 'text-red-400' :
              decomposition.avg_spill_rate > 0.05 ? 'text-orange-400' : 'text-green-400'
            }`}>
              {decomposition.avg_spill_rate
                ? `${(decomposition.avg_spill_rate * 100).toFixed(1)}%`
                : '-'}
            </p>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Avg Fare</p>
            <p className="text-2xl font-semibold text-slate-100">
              {decomposition.avg_fare ? `$${decomposition.avg_fare.toFixed(0)}` : '-'}
            </p>
          </div>
        </div>

        {/* Cross-Domain RASM Impact */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-400" />
            RASM Optimization Levers
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {/* Network lever */}
            <RasmLever
              icon={<Plane className="w-4 h-4 text-blue-400" />}
              domain="Network"
              description={decomposition.avg_spill_rate > 0.05
                ? `High spill rate (${(decomposition.avg_spill_rate * 100).toFixed(1)}%) - add frequency to capture demand`
                : 'Frequency optimized for demand'
              }
              rasmImpact={decomposition.avg_spill_rate > 0.05 ? '+0.3-0.5¢' : null}
              status={decomposition.avg_spill_rate > 0.05 ? 'opportunity' : 'optimal'}
            />

            {/* Fleet lever */}
            <RasmLever
              icon={<Plane className="w-4 h-4 text-cyan-400" />}
              domain="Fleet"
              description={decomposition.avg_load_factor < 0.85
                ? `Load factor ${(decomposition.avg_load_factor * 100).toFixed(0)}% - consider smaller gauge`
                : decomposition.avg_load_factor > 0.92
                ? `Load factor ${(decomposition.avg_load_factor * 100).toFixed(0)}% - upgrade to MAX`
                : 'Right-sized equipment'
              }
              rasmImpact={decomposition.avg_load_factor < 0.80 || decomposition.avg_load_factor > 0.92 ? '+0.2-0.4¢' : null}
              status={decomposition.avg_load_factor < 0.80 ? 'opportunity' : decomposition.avg_load_factor > 0.92 ? 'opportunity' : 'optimal'}
            />

            {/* Crew lever */}
            <RasmLever
              icon={<Users className="w-4 h-4 text-purple-400" />}
              domain="Crew"
              description="Crew availability aligned with schedule"
              rasmImpact={null}
              status="optimal"
            />

            {/* MRO lever */}
            <RasmLever
              icon={<Wrench className="w-4 h-4 text-orange-400" />}
              domain="MRO"
              description="No scheduled maintenance conflicts"
              rasmImpact={null}
              status="optimal"
            />

            {/* Revenue Management lever */}
            <RasmLever
              icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
              domain="Revenue Mgmt"
              description={routePnl?.competitive_context?.fare_vs_f9 > 10
                ? `NK $${routePnl.competitive_context.fare_vs_f9.toFixed(0)} above F9 - fare pressure`
                : routePnl?.competitive_context?.fare_vs_f9 < -10
                ? `NK $${Math.abs(routePnl.competitive_context.fare_vs_f9).toFixed(0)} below F9 - yield opportunity`
                : 'Fare competitive in market'
              }
              rasmImpact={routePnl?.competitive_context?.fare_vs_f9 < -10 ? '+0.5-1.0¢' : null}
              status={routePnl?.competitive_context?.fare_vs_f9 < -10 ? 'opportunity' : 'optimal'}
            />
          </div>
        </div>

        {/* Segment Decomposition */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Demand Composition</h3>
          <SegmentBar segments={decomposition.segment_mix} height={32} />
        </div>

        {/* Segment Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Segment Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value) => [`${value}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">DOW Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dow" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value) => [String(value ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','), 'Pax']}
                />
                <Bar dataKey="pax" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Segment Metrics Table */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Segment Economics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400 font-medium">Segment</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Est. Pax</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Est. Revenue</th>
                  <th className="text-center py-2 text-slate-400 font-medium">Price Sens.</th>
                  <th className="text-center py-2 text-slate-400 font-medium">Date Flex.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {Object.entries(decomposition.segment_metrics || {}).map(([segment, metrics]: [string, any]) => (
                  <tr key={segment}>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: SEGMENT_COLORS[segment as SegmentType] }}
                        />
                        <span className="text-slate-200">{SEGMENT_LABELS[segment as SegmentType]}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-slate-200">
                      {metrics.est_pax?.toLocaleString() || '-'}
                    </td>
                    <td className="py-2 text-right text-slate-200">
                      ${metrics.est_revenue?.toLocaleString() || '-'}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        metrics.price_sensitivity === 'very_high' ? 'bg-red-900/50 text-red-300' :
                        metrics.price_sensitivity === 'high' ? 'bg-orange-900/50 text-orange-300' :
                        metrics.price_sensitivity === 'medium' ? 'bg-yellow-900/50 text-yellow-300' :
                        'bg-green-900/50 text-green-300'
                      }`}>
                        {metrics.price_sensitivity?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        metrics.date_flexibility === 'zero' ? 'bg-red-900/50 text-red-300' :
                        metrics.date_flexibility === 'low' ? 'bg-orange-900/50 text-orange-300' :
                        metrics.date_flexibility === 'medium' ? 'bg-yellow-900/50 text-yellow-300' :
                        'bg-green-900/50 text-green-300'
                      }`}>
                        {metrics.date_flexibility}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* External Signals */}
        {(cruiseSignal || weatherSignal || liveWeather) && (
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Demand Drivers</h3>
            <div className="space-y-3">
              {cruiseSignal && cruiseSignal.signal_strength > 0 && (
                <div className="flex items-start gap-3 p-3 bg-orange-900/20 border border-orange-800/50 rounded-lg">
                  <Ship className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-300">
                      Cruise Port Influence
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {cruiseSignal.explanation}
                    </p>
                    {cruiseSignal.ships_per_week && (
                      <p className="text-xs text-slate-500 mt-1">
                        {cruiseSignal.port_name} • {cruiseSignal.ships_per_week} ships/week
                      </p>
                    )}
                  </div>
                </div>
              )}

              {weatherSignal && weatherSignal.signal_strength > 0 && (
                <div className="flex items-start gap-3 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
                  <Thermometer className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-300">
                      Weather Advantage
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {weatherSignal.explanation}
                    </p>
                    {weatherSignal.temp_differential && (
                      <p className="text-xs text-slate-500 mt-1">
                        {weatherSignal.origin_temp}°F → {weatherSignal.destination_temp}°F
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Live Weather Data */}
              {liveWeather && liveWeather.success && (
                <div className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                  <Thermometer className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-300">
                      Live Weather Conditions
                    </p>
                    <div className="flex gap-6 mt-2 text-sm">
                      <div>
                        <span className="text-slate-500">{origin}:</span>
                        <span className="text-slate-200 ml-2">
                          {liveWeather.origin?.temp?.toFixed(0)}°F
                        </span>
                        <span className="text-slate-500 ml-1 text-xs">
                          {liveWeather.origin?.description}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">{destination}:</span>
                        <span className="text-slate-200 ml-2">
                          {liveWeather.destination?.temp?.toFixed(0)}°F
                        </span>
                        <span className="text-slate-500 ml-1 text-xs">
                          {liveWeather.destination?.description}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs mt-2">
                      <span className={`font-medium ${
                        liveWeather.differential > 20 ? 'text-green-400' :
                        liveWeather.differential > 0 ? 'text-green-300' :
                        liveWeather.differential < -20 ? 'text-blue-400' :
                        'text-slate-400'
                      }`}>
                        {liveWeather.differential > 0 ? '+' : ''}{liveWeather.differential?.toFixed(0)}°F differential
                      </span>
                      <span className="text-slate-500 ml-2">
                        Leisure signal: {liveWeather.leisure_signal}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Destination Categories */}
        <div className="flex gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Origin Type</p>
            <div className="flex flex-wrap gap-1">
              {(decomposition.origin_categories || []).map((cat: string) => (
                <span key={cat} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300">
                  {cat.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Destination Type</p>
            <div className="flex flex-wrap gap-1">
              {(decomposition.destination_categories || []).map((cat: string) => (
                <span key={cat} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300">
                  {cat.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RasmLever - Shows cross-domain impact on RASM
 * Each lever represents one of the 5 optimization domains
 */
function RasmLever({
  icon,
  domain,
  description,
  rasmImpact,
  status,
}: {
  icon: React.ReactNode;
  domain: string;
  description: string;
  rasmImpact: string | null;
  status: 'optimal' | 'opportunity' | 'constraint';
}) {
  const statusColor = status === 'opportunity' ? 'border-emerald-500/50 bg-emerald-900/20' :
                      status === 'constraint' ? 'border-red-500/50 bg-red-900/20' :
                      'border-slate-700 bg-slate-800/50';

  const statusIcon = status === 'opportunity' ? '↑' :
                     status === 'constraint' ? '⚠' : '✓';

  const statusTextColor = status === 'opportunity' ? 'text-emerald-400' :
                          status === 'constraint' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${statusColor}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-200">{domain}</span>
          <span className={`text-xs ${statusTextColor}`}>{statusIcon}</span>
        </div>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      {rasmImpact && (
        <div className="text-right">
          <span className="text-xs font-medium text-emerald-400">{rasmImpact}</span>
          <p className="text-[10px] text-slate-500">RASM</p>
        </div>
      )}
    </div>
  );
}
