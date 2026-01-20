'use client';

import { useState, useEffect } from 'react';
import { getBookingCurve, getRoutePnL, type BookingCurveResponse, type RoutePnL } from '@/lib/api';
import { SEGMENT_COLORS, SEGMENT_LABELS, type SegmentType } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Calendar, Target, AlertCircle, Clock } from 'lucide-react';

interface Props {
  origin?: string;
  destination?: string;
}

export default function BookingCurveView({ origin: initialOrigin, destination: initialDestination }: Props) {
  const [origin, setOrigin] = useState(initialOrigin || 'FLL');
  const [destination, setDestination] = useState(initialDestination || 'BOS');
  const [bookingCurve, setBookingCurve] = useState<BookingCurveResponse | null>(null);
  const [pnl, setPnl] = useState<RoutePnL | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [curveData, pnlData] = await Promise.all([
        getBookingCurve(origin, destination),
        getRoutePnL(origin, destination).catch(() => null),
      ]);
      setBookingCurve(curveData);
      setPnl(pnlData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (origin && destination && origin.length === 3 && destination.length === 3) {
      loadData();
    }
  }, []);

  // Prepare chart data
  const curveChartData = bookingCurve?.booking_curve?.map((point) => ({
    ...point,
    daysLabel: `${point.days_before_departure}d`,
  })).reverse() || [];

  // Segment contribution over booking window
  const segmentAreaData = bookingCurve?.booking_curve?.map((point) => ({
    days: point.days_before_departure,
    ...point.segment_breakdown,
  })).reverse() || [];

  return (
    <div className="space-y-6">
      {/* Route Selector */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Origin</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-center uppercase"
              placeholder="FLL"
            />
          </div>
          <div className="text-slate-500 pt-5">→</div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-center uppercase"
              placeholder="BOS"
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading || origin.length !== 3 || destination.length !== 3}
            className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors"
          >
            {loading ? 'Loading...' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {bookingCurve && (
        <>
          {/* Segment Mix Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Route {bookingCurve.route} - Segment Mix
            </h3>
            <div className="flex items-center gap-1 h-8 rounded overflow-hidden">
              {Object.entries(bookingCurve.segment_mix).map(([segment, share]) => (
                <div
                  key={segment}
                  style={{
                    width: `${share * 100}%`,
                    backgroundColor: SEGMENT_COLORS[segment as SegmentType],
                  }}
                  className="h-full flex items-center justify-center"
                  title={`${SEGMENT_LABELS[segment as SegmentType]}: ${(share * 100).toFixed(1)}%`}
                >
                  {share > 0.1 && (
                    <span className="text-xs text-white font-medium">
                      {(share * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {Object.entries(bookingCurve.segment_mix).map(([segment, share]) => (
                <div key={segment} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: SEGMENT_COLORS[segment as SegmentType] }}
                  />
                  <span className="text-sm text-slate-300">
                    {SEGMENT_LABELS[segment as SegmentType]}: {(share * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Booking Curve Chart */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Cumulative Booking Curve
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={curveChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="days_before_departure"
                      stroke="#94a3b8"
                      reversed
                      tickFormatter={(val) => `${val}d`}
                    />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                      labelFormatter={(val) => `${val} days before departure`}
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Booked']}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative_booked_pct"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      name="% Booked"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Segment Contribution by Booking Window */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-400" />
                Segment Contribution by Window
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={segmentAreaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="days"
                      stroke="#94a3b8"
                      reversed
                      tickFormatter={(val) => `${val}d`}
                    />
                    <YAxis stroke="#94a3b8" tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                      labelFormatter={(val) => `${val} days out`}
                    />
                    {Object.keys(SEGMENT_COLORS).map((segment) => (
                      <Area
                        key={segment}
                        type="monotone"
                        dataKey={segment}
                        stackId="1"
                        stroke={SEGMENT_COLORS[segment as SegmentType]}
                        fill={SEGMENT_COLORS[segment as SegmentType]}
                        name={SEGMENT_LABELS[segment as SegmentType]}
                      />
                    ))}
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Pricing Recommendations */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              Pricing Window Recommendations
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {bookingCurve.pricing_recommendations.map((rec, idx) => (
                <div key={idx} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-blue-400">{rec.window}</span>
                  </div>
                  <p className="text-white font-medium mb-1">{rec.strategy}</p>
                  <p className="text-sm text-slate-400">{rec.recommendation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Route P&L Section */}
          {pnl && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Route P&L Estimate
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Annual Revenue</p>
                  <p className="text-xl font-bold text-green-400">
                    ${(pnl.estimated_annual_revenue / 1_000_000).toFixed(1)}M
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Annual Cost</p>
                  <p className="text-xl font-bold text-red-400">
                    ${(pnl.estimated_annual_cost / 1_000_000).toFixed(1)}M
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Est. Profit</p>
                  <p className={`text-xl font-bold ${pnl.estimated_profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${(pnl.estimated_profit / 1_000_000).toFixed(1)}M
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400">Margin</p>
                  <p className={`text-xl font-bold ${pnl.profit_margin_pct > 10 ? 'text-green-400' : pnl.profit_margin_pct > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {pnl.profit_margin_pct.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-400">Route Metrics</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Distance:</span>
                      <span className="text-white">{pnl.distance_miles.toLocaleString()} mi</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Annual Pax:</span>
                      <span className="text-white">{pnl.annual_passengers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Fare:</span>
                      <span className="text-white">${pnl.avg_fare.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">RASM:</span>
                      <span className="text-white">{pnl.rasm_cents.toFixed(2)}¢</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-400">Competitive Position</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Market Share:</span>
                      <span className={pnl.competitive_context.market_share > 50 ? 'text-green-400' : 'text-yellow-400'}>
                        {pnl.competitive_context.market_share.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">F9 Passengers:</span>
                      <span className="text-white">{pnl.competitive_context.f9_passengers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fare vs F9:</span>
                      <span className={pnl.competitive_context.fare_vs_f9 > 0 ? 'text-green-400' : pnl.competitive_context.fare_vs_f9 < 0 ? 'text-red-400' : 'text-slate-400'}>
                        {pnl.competitive_context.fare_vs_f9 > 0 ? '+' : ''}{pnl.competitive_context.fare_vs_f9.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">CASM:</span>
                      <span className="text-white">{pnl.casm_cents.toFixed(2)}¢</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!bookingCurve && !loading && !error && (
        <div className="text-center py-12 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Enter origin and destination to analyze booking curve</p>
        </div>
      )}
    </div>
  );
}
