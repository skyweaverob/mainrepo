'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Play, Check, DollarSign, Plane, Zap, Target, ArrowRight, BarChart3 } from 'lucide-react';
import * as api from '@/lib/api';

interface DemoViewProps {
  isLiveMode?: boolean;
}

export function DemoView({ isLiveMode = false }: DemoViewProps) {
  const [activeDemo, setActiveDemo] = useState<'optimizer' | 'decision' | 'simulation'>('optimizer');
  const [selectedRoute, setSelectedRoute] = useState('MCO-PHL');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [approvedDecisions, setApprovedDecisions] = useState<string[]>([]);
  const [topRoutes, setTopRoutes] = useState<any[]>([]);

  // Load real route data
  useEffect(() => {
    async function loadRoutes() {
      try {
        const markets = await api.getMarketIntelligence(20);
        const routes = markets.map(m => ({
          route: m.market_key,
          pax: m.nk_passengers,
          fare: m.nk_avg_fare,
          distance: m.distance,
          marketShare: m.nk_market_share,
        }));
        setTopRoutes(routes);
      } catch (err) {
        // Use demo data
        setTopRoutes([
          { route: 'MCO-PHL', pax: 180000, fare: 89, distance: 861, marketShare: 0.42 },
          { route: 'DTW-MCO', pax: 165000, fare: 112, distance: 957, marketShare: 0.38 },
          { route: 'FLL-EWR', pax: 142000, fare: 98, distance: 1071, marketShare: 0.35 },
          { route: 'LAS-DTW', pax: 128000, fare: 134, distance: 1749, marketShare: 0.28 },
          { route: 'ATL-FLL', pax: 156000, fare: 76, distance: 581, marketShare: 0.45 },
        ]);
      }
    }
    loadRoutes();
  }, []);

  // Run optimization
  const runOptimization = async () => {
    setOptimizing(true);
    setOptimizationResult(null);

    try {
      const [origin, dest] = selectedRoute.split('-');
      const result = await api.getQuickRouteOptimization(origin, dest, 'A320neo', 2);
      setOptimizationResult({
        route: selectedRoute,
        current: {
          equipment: 'A320neo',
          seats: 182,
          profit: result.current?.profit || 15200,
          rasm: result.current?.rasm_cents || 10.2,
        },
        recommended: {
          equipment: result.recommended?.equipment || 'A321neo',
          seats: result.recommended?.seats || 228,
          profit: result.recommended?.profit || 23800,
          rasm: result.recommended?.rasm_cents || 11.4,
        },
        uplift: (result.recommended?.profit || 23800) - (result.current?.profit || 15200),
        rasmGain: (result.recommended?.rasm_cents || 11.4) - (result.current?.rasm_cents || 10.2),
      });
    } catch {
      // Demo fallback
      setOptimizationResult({
        route: selectedRoute,
        current: { equipment: 'A320neo', seats: 182, profit: 15200, rasm: 10.2 },
        recommended: { equipment: 'A321neo', seats: 228, profit: 23800, rasm: 11.4 },
        uplift: 8600,
        rasmGain: 1.2,
      });
    } finally {
      setOptimizing(false);
    }
  };

  const decisions = [
    { id: '1', route: 'MCO-PHL', action: 'Upgauge to A321neo', profit: 8600, rasm: 0.15 },
    { id: '2', route: 'DTW-FLL', action: 'Add frequency (3x daily)', profit: 12400, rasm: 0.22 },
    { id: '3', route: 'LAS-EWR', action: 'Competitive fare adjustment', profit: 4200, rasm: -0.05 },
    { id: '4', route: 'ATL-MCO', action: 'Peak time retiming', profit: 3100, rasm: 0.08 },
  ];

  const totalApprovedProfit = decisions
    .filter(d => approvedDecisions.includes(d.id))
    .reduce((sum, d) => sum + d.profit, 0);

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-6xl mx-auto p-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#002855] mb-3">SkyWeave</h1>
          <p className="text-xl text-slate-600 mb-6">The Airline Operating System That Optimizes for RASM</p>

          <div className="inline-flex items-center gap-6 bg-white rounded-full px-8 py-4 shadow-lg">
            <div className="text-center">
              <div className="text-sm text-slate-500">Before SkyWeave</div>
              <div className="text-2xl font-bold text-slate-400">7.72¢</div>
            </div>
            <ArrowRight className="w-6 h-6 text-emerald-500" />
            <div className="text-center">
              <div className="text-sm text-emerald-600">With SkyWeave</div>
              <div className="text-2xl font-bold text-emerald-600">8.41¢</div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-sm text-slate-500">Improvement</div>
              <div className="text-2xl font-bold text-[#002855]">+8.9%</div>
            </div>
          </div>
        </div>

        {/* Demo Selector */}
        <div className="flex justify-center gap-4 mb-8">
          {[
            { id: 'optimizer', label: 'Route Optimizer', icon: Target },
            { id: 'decision', label: 'Decision Engine', icon: Zap },
            { id: 'simulation', label: 'Impact Simulator', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDemo(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeDemo === tab.id
                    ? 'bg-[#002855] text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Demo Content */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {activeDemo === 'optimizer' && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Route Optimization Engine</h2>
                  <p className="text-slate-500">Select a route and see ML-powered recommendations</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  ML Engine Active
                </div>
              </div>

              {/* Route Selector */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                {(topRoutes.length > 0 ? topRoutes.slice(0, 5) : [
                  { route: 'MCO-PHL' }, { route: 'DTW-MCO' }, { route: 'FLL-EWR' },
                  { route: 'LAS-DTW' }, { route: 'ATL-FLL' }
                ]).map((r) => (
                  <button
                    key={r.route}
                    onClick={() => { setSelectedRoute(r.route); setOptimizationResult(null); }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedRoute === r.route
                        ? 'border-[#002855] bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-800">{r.route}</div>
                    {r.pax && <div className="text-xs text-slate-500">{(r.pax / 1000).toFixed(0)}K pax/yr</div>}
                  </button>
                ))}
              </div>

              {/* Run Button */}
              <button
                onClick={runOptimization}
                disabled={optimizing}
                className="w-full py-4 bg-[#002855] text-white rounded-lg font-semibold text-lg hover:bg-[#001a3d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {optimizing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing {selectedRoute}...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Optimize {selectedRoute}
                  </>
                )}
              </button>

              {/* Result */}
              {optimizationResult && (
                <div className="mt-8 grid grid-cols-3 gap-6">
                  {/* Current */}
                  <div className="p-6 bg-slate-100 rounded-xl">
                    <div className="text-sm text-slate-500 uppercase mb-3">Current State</div>
                    <div className="flex items-center gap-2 mb-4">
                      <Plane className="w-5 h-5 text-slate-400" />
                      <span className="font-semibold">{optimizationResult.current.equipment}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Seats</span>
                        <span className="font-semibold">{optimizationResult.current.seats}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Daily Profit</span>
                        <span className="font-semibold">${optimizationResult.current.profit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">RASM</span>
                        <span className="font-semibold">{optimizationResult.current.rasm.toFixed(2)}¢</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                      <ArrowRight className="w-8 h-8 text-emerald-600" />
                    </div>
                  </div>

                  {/* Recommended */}
                  <div className="p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                    <div className="text-sm text-emerald-600 uppercase mb-3">Recommended</div>
                    <div className="flex items-center gap-2 mb-4">
                      <Plane className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-700">{optimizationResult.recommended.equipment}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Seats</span>
                        <span className="font-semibold text-emerald-700">{optimizationResult.recommended.seats}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">Daily Profit</span>
                        <span className="font-semibold text-emerald-700">${optimizationResult.recommended.profit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600">RASM</span>
                        <span className="font-semibold text-emerald-700">{optimizationResult.recommended.rasm.toFixed(2)}¢</span>
                      </div>
                    </div>
                  </div>

                  {/* Impact Summary */}
                  <div className="col-span-3 p-6 bg-[#002855] rounded-xl text-white text-center">
                    <div className="text-sm opacity-80 mb-2">Annual Impact from This Route</div>
                    <div className="text-4xl font-bold">+${((optimizationResult.uplift * 365) / 1000000).toFixed(1)}M</div>
                    <div className="mt-2 text-emerald-300">+{optimizationResult.rasmGain.toFixed(2)}¢ RASM improvement</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeDemo === 'decision' && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Decision Engine</h2>
                  <p className="text-slate-500">Approve ML recommendations with one click</p>
                </div>
                {approvedDecisions.length > 0 && (
                  <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <span className="font-semibold">+${(totalApprovedProfit / 1000).toFixed(0)}K/day</span> captured
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {decisions.map((d) => {
                  const isApproved = approvedDecisions.includes(d.id);
                  return (
                    <div
                      key={d.id}
                      className={`p-5 rounded-xl border-2 transition-all ${
                        isApproved
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isApproved ? 'bg-emerald-200' : 'bg-slate-100'
                          }`}>
                            {isApproved ? (
                              <Check className="w-6 h-6 text-emerald-600" />
                            ) : (
                              <Plane className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-lg">{d.route}</div>
                            <div className="text-slate-500">{d.action}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="font-bold text-emerald-600 text-xl">+${(d.profit / 1000).toFixed(1)}K/day</div>
                            <div className="text-sm text-slate-500">{d.rasm > 0 ? '+' : ''}{d.rasm.toFixed(2)}¢ RASM</div>
                          </div>

                          {!isApproved ? (
                            <button
                              onClick={() => setApprovedDecisions([...approvedDecisions, d.id])}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                          ) : (
                            <div className="px-6 py-3 text-emerald-600 font-semibold">Approved ✓</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {approvedDecisions.length === decisions.length && (
                <div className="mt-8 p-6 bg-emerald-600 rounded-xl text-white text-center">
                  <Check className="w-12 h-12 mx-auto mb-3" />
                  <div className="text-2xl font-bold mb-2">All Decisions Approved!</div>
                  <div className="text-emerald-100">
                    Annual impact: <span className="font-bold">+${((totalApprovedProfit * 365) / 1000000).toFixed(1)}M</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeDemo === 'simulation' && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Impact Simulator</h2>
                <p className="text-slate-500">See the network-wide impact of optimization</p>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="p-6 bg-slate-100 rounded-xl">
                    <div className="text-sm text-slate-500 uppercase mb-4">Without SkyWeave</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-3xl font-bold text-slate-600">7.72¢</div>
                        <div className="text-sm text-slate-500">Network RASM</div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-slate-600">$3.1B</div>
                        <div className="text-sm text-slate-500">Annual Revenue</div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-slate-600">78%</div>
                        <div className="text-sm text-slate-500">OTP</div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-slate-600">86%</div>
                        <div className="text-sm text-slate-500">Load Factor</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                    <div className="text-sm text-emerald-600 uppercase mb-4">With SkyWeave</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-3xl font-bold text-emerald-600">8.41¢</div>
                        <div className="text-sm text-emerald-600">Network RASM <span className="text-emerald-500">+9%</span></div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-emerald-600">$3.38B</div>
                        <div className="text-sm text-emerald-600">Annual Revenue <span className="text-emerald-500">+$280M</span></div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-emerald-600">86%</div>
                        <div className="text-sm text-emerald-600">OTP <span className="text-emerald-500">+8pts</span></div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-emerald-600">89%</div>
                        <div className="text-sm text-emerald-600">Load Factor <span className="text-emerald-500">+3pts</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 bg-[#002855] rounded-xl text-white">
                <div className="grid grid-cols-3 gap-8 text-center">
                  <div>
                    <div className="text-sm opacity-70 mb-1">Revenue Uplift</div>
                    <div className="text-3xl font-bold">+$280M</div>
                    <div className="text-sm text-emerald-300">per year</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70 mb-1">RASM Improvement</div>
                    <div className="text-3xl font-bold">+8.9%</div>
                    <div className="text-sm text-emerald-300">network-wide</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-70 mb-1">ML Accuracy</div>
                    <div className="text-3xl font-bold">87%</div>
                    <div className="text-sm text-emerald-300">prediction accuracy</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          SkyWeave • The Operating System for RASM-First Airlines
        </div>
      </div>
    </div>
  );
}

export default DemoView;
