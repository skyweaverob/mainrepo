'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { TrendingUp, Clock, DollarSign, Users } from 'lucide-react';

interface DemandPoint {
  hour: number;
  currentDemand: number;
  optimizedDemand: number;
  price: number;
  optimizedPrice: number;
}

interface DemandCurveProps {
  route: string;
  dayOfWeek?: 'weekday' | 'weekend';
  baselineDemand?: number;
  optimizedDemand?: number;
  currentPrice?: number;
  optimizedPrice?: number;
}

// Generate realistic demand curve based on departure time
function generateDemandCurve(
  baselineDemand: number,
  optimizedDemand: number,
  currentPrice: number,
  optimizedPrice: number,
  dayOfWeek: 'weekday' | 'weekend'
): DemandPoint[] {
  const points: DemandPoint[] = [];

  // Demand multipliers by hour (business vs leisure travel patterns)
  const weekdayPattern = [
    0.2, 0.15, 0.1, 0.1, 0.15, 0.35, // 0-5: overnight/early morning
    0.65, 0.95, 0.85, 0.75, 0.7, 0.6, // 6-11: morning business peak
    0.55, 0.6, 0.65, 0.75, 0.85, 0.9, // 12-17: afternoon buildup
    0.95, 0.8, 0.65, 0.5, 0.35, 0.25  // 18-23: evening peak then decline
  ];

  const weekendPattern = [
    0.15, 0.1, 0.1, 0.1, 0.1, 0.2,   // 0-5: overnight
    0.4, 0.55, 0.7, 0.85, 0.9, 0.85, // 6-11: late morning peak
    0.8, 0.75, 0.7, 0.65, 0.7, 0.75, // 12-17: steady afternoon
    0.7, 0.6, 0.5, 0.4, 0.3, 0.2     // 18-23: evening decline
  ];

  const pattern = dayOfWeek === 'weekend' ? weekendPattern : weekdayPattern;

  // Price elasticity factor - prices vary with demand
  const priceElasticity = 0.3;

  for (let hour = 0; hour < 24; hour++) {
    const demandMultiplier = pattern[hour];

    // Current demand at this hour
    const hourlyCurrentDemand = Math.round(baselineDemand * demandMultiplier);

    // Optimized demand captures more through better timing/pricing
    const optimizationGain = 1 + (demandMultiplier * 0.15); // Higher gain during peak
    const hourlyOptimizedDemand = Math.round(optimizedDemand * demandMultiplier * optimizationGain);

    // Prices vary inversely with demand elasticity
    const priceMultiplier = 1 + ((demandMultiplier - 0.5) * priceElasticity);
    const hourlyPrice = Math.round(currentPrice * priceMultiplier);

    // Optimized pricing is smarter about yield management
    const optPriceMultiplier = 1 + ((demandMultiplier - 0.4) * (priceElasticity * 1.2));
    const hourlyOptimizedPrice = Math.round(optimizedPrice * optPriceMultiplier);

    points.push({
      hour,
      currentDemand: hourlyCurrentDemand,
      optimizedDemand: hourlyOptimizedDemand,
      price: hourlyPrice,
      optimizedPrice: hourlyOptimizedPrice
    });
  }

  return points;
}

const formatHour = (hour: number) => {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
};

export function DemandCurve({
  route,
  dayOfWeek = 'weekday',
  baselineDemand = 145,
  optimizedDemand = 158,
  currentPrice = 142,
  optimizedPrice = 156
}: DemandCurveProps) {
  const [showOptimized, setShowOptimized] = useState(true);
  const [viewMode, setViewMode] = useState<'demand' | 'price' | 'both'>('demand');

  const data = useMemo(() => generateDemandCurve(
    baselineDemand,
    optimizedDemand,
    currentPrice,
    optimizedPrice,
    dayOfWeek
  ), [baselineDemand, optimizedDemand, currentPrice, optimizedPrice, dayOfWeek]);

  // Calculate peak periods
  const morningPeak = data.slice(6, 10);
  const eveningPeak = data.slice(17, 21);

  // Calculate improvement stats
  const totalCurrentDemand = data.reduce((sum, d) => sum + d.currentDemand, 0);
  const totalOptimizedDemand = data.reduce((sum, d) => sum + d.optimizedDemand, 0);
  const demandImprovement = ((totalOptimizedDemand - totalCurrentDemand) / totalCurrentDemand * 100).toFixed(1);

  const avgCurrentPrice = data.reduce((sum, d) => sum + d.price, 0) / data.length;
  const avgOptimizedPrice = data.reduce((sum, d) => sum + d.optimizedPrice, 0) / data.length;
  const yieldImprovement = ((avgOptimizedPrice - avgCurrentPrice) / avgCurrentPrice * 100).toFixed(1);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <div className="text-sm font-medium text-slate-200 mb-2">{formatHour(label)}</div>
        <div className="space-y-1.5">
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-400">{p.name}</span>
              </div>
              <span className="font-medium text-slate-200">
                {p.name.includes('Price') ? `$${p.value}` : p.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Demand Curve Analysis</h3>
            <div className="text-sm text-slate-500 mt-0.5">{route} - {dayOfWeek === 'weekend' ? 'Weekend' : 'Weekday'} Pattern</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('demand')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === 'demand' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Demand
            </button>
            <button
              onClick={() => setViewMode('price')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === 'price' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-1" />
              Price
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === 'both' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Both
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border-b border-slate-200">
        <div className="text-center">
          <div className="text-xs text-slate-500 uppercase">Daily Demand</div>
          <div className="text-lg font-bold text-slate-800">{totalCurrentDemand.toLocaleString()}</div>
          {showOptimized && (
            <div className="text-xs text-emerald-600">+{demandImprovement}% optimized</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 uppercase">Avg Fare</div>
          <div className="text-lg font-bold text-slate-800">${avgCurrentPrice.toFixed(0)}</div>
          {showOptimized && (
            <div className="text-xs text-emerald-600">+{yieldImprovement}% yield</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 uppercase">AM Peak</div>
          <div className="text-lg font-bold text-blue-600">6-10am</div>
          <div className="text-xs text-slate-500">{morningPeak.reduce((s, d) => s + d.currentDemand, 0)} pax</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 uppercase">PM Peak</div>
          <div className="text-lg font-bold text-purple-600">5-9pm</div>
          <div className="text-xs text-slate-500">{eveningPeak.reduce((s, d) => s + d.currentDemand, 0)} pax</div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="currentDemandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="optimizedDemandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />

              <YAxis
                yAxisId="demand"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                domain={['dataMin - 10', 'dataMax + 20']}
              />

              {(viewMode === 'price' || viewMode === 'both') && (
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(v) => `$${v}`}
                  domain={['dataMin - 20', 'dataMax + 30']}
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              {/* Peak hour highlights */}
              <ReferenceArea yAxisId="demand" x1={6} x2={10} fill="#3b82f6" fillOpacity={0.05} />
              <ReferenceArea yAxisId="demand" x1={17} x2={21} fill="#8b5cf6" fillOpacity={0.05} />

              {/* Demand curves */}
              {(viewMode === 'demand' || viewMode === 'both') && (
                <>
                  <Area
                    yAxisId="demand"
                    type="monotone"
                    dataKey="currentDemand"
                    name="Current Demand"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    fill="url(#currentDemandGradient)"
                  />
                  {showOptimized && (
                    <Area
                      yAxisId="demand"
                      type="monotone"
                      dataKey="optimizedDemand"
                      name="Optimized Demand"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#optimizedDemandGradient)"
                    />
                  )}
                </>
              )}

              {/* Price curves */}
              {(viewMode === 'price' || viewMode === 'both') && (
                <>
                  <Area
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    name="Current Price"
                    stroke="#6b7280"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                  />
                  {showOptimized && (
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="optimizedPrice"
                      name="Optimized Price"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                    />
                  )}
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend & Controls */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-slate-400" />
            <span className="text-sm text-slate-600">Current</span>
          </div>
          {showOptimized && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-sm text-slate-600">Optimized</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 rounded bg-blue-500/10 border border-blue-500/30" />
            <span className="text-sm text-slate-500">Peak hours</span>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOptimized}
            onChange={(e) => setShowOptimized(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">Show optimized</span>
        </label>
      </div>
    </div>
  );
}

export default DemandCurve;
