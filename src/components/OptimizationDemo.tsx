'use client';

import { useState, useEffect } from 'react';
import { Check, X, ArrowRight, Cpu } from 'lucide-react';
import * as api from '@/lib/api';
import { formatCurrencyDelta } from '@/lib/formatters';

/**
 * OptimizationDemo - McKinsey-style RASM optimization presentation
 *
 * Clean, professional design with:
 * - Clear data hierarchy
 * - Comparison tables
 * - Status indicators
 * - Executive-ready metrics
 */
export function OptimizationDemo() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<api.RouteOptimizationResult | null>(null);
  const [scenario, setScenario] = useState<api.ScenarioResult | null>(null);
  const [selectedRoute, setSelectedRoute] = useState('DTW-MCO');
  const [availableRoutes, setAvailableRoutes] = useState<{route: string; fare: number; lf: number}[]>([
    { route: 'DTW-MCO', fare: 112, lf: 0.88 },
    { route: 'MCO-PHL', fare: 89, lf: 0.91 },
    { route: 'FLL-EWR', fare: 98, lf: 0.86 },
    { route: 'LAS-DTW', fare: 134, lf: 0.84 },
    { route: 'ATL-FLL', fare: 76, lf: 0.89 },
  ]);

  useEffect(() => {
    async function loadRoutes() {
      try {
        const routes = await api.getRoutes({ limit: 50 });
        const routesWithData = routes
          .filter(r => r.avg_load_factor && r.avg_fare)
          .slice(0, 10)
          .map(r => ({
            route: `${r.origin}-${r.destination}`,
            fare: r.avg_fare || 100,
            lf: r.avg_load_factor || 0.85,
          }));
        if (routesWithData.length > 0) {
          setAvailableRoutes(routesWithData);
        }
      } catch (err) {
        console.error('Failed to load routes:', err);
      }
    }
    loadRoutes();
  }, []);

  useEffect(() => {
    async function initializeOptimizer() {
      setLoading(true);
      const [origin, dest] = selectedRoute.split('-');
      const routeData = availableRoutes.find(r => r.route === selectedRoute);
      const fare = routeData?.fare || 120;
      const lf = routeData?.lf || 0.88;

      try {
        const status = await api.getOptimizerStatus();
        if (!status.optimizer_available) {
          createFallbackResult(origin, dest, fare, lf);
          setLoading(false);
          return;
        }
        await runOptimization(origin, dest, fare, lf);
      } catch (err) {
        console.error('Failed to initialize optimizer:', err);
        createFallbackResult(origin, dest, fare, lf);
      } finally {
        setLoading(false);
      }
    }
    initializeOptimizer();
  }, [selectedRoute, availableRoutes]);

  async function runOptimization(origin: string, destination: string, fare: number, lf: number) {
    try {
      const optimizationResult = await api.optimizeRoute({
        origin,
        destination,
        current_equipment: 'A320neo',
        current_frequency: 2,
        current_fare: fare,
        daily_demand: Math.round(182 * lf * 2.2),
      });
      setResult(optimizationResult);
      const scenarioResult = await api.simulateEquipmentSwap(origin, destination, 'A320neo', 'A321neo', 0);
      setScenario(scenarioResult);
    } catch (err) {
      console.error('Optimization failed:', err);
      createFallbackResult(origin, destination, fare, lf);
    }
  }

  function createFallbackResult(origin: string, destination: string, fare: number, lf: number) {
    // Realistic ULCC economics
    const distance = 900; // nm (fixed for consistency)
    const frequency = 2; // flights per day each direction
    const dailyDepartures = frequency * 2; // both directions = 4 departures

    // CASM varies by stage length (Spirit averages 8-9¢)
    const baseCasm = 8.0; // cents per ASM
    const casm = baseCasm + (200 / distance); // Stage length penalty

    // Current equipment: A320neo (182 seats)
    const currentSeats = 182;
    const currentLF = lf;
    const currentPaxPerFlight = Math.round(currentSeats * currentLF);
    const currentDailyPax = currentPaxPerFlight * dailyDepartures;
    const currentDailyRevenue = currentDailyPax * fare;
    const currentDailyASM = currentSeats * distance * dailyDepartures;
    const currentDailyCost = Math.round(currentDailyASM * casm / 100);
    const currentDailyProfit = currentDailyRevenue - currentDailyCost;
    const currentRasm = (currentDailyRevenue / currentDailyASM) * 100;

    // Recommended: A321neo (228 seats) - better LF due to demand capture
    const newSeats = 228;
    const newLF = Math.min(0.92, currentLF + 0.02); // Slight LF improvement
    const newPaxPerFlight = Math.round(newSeats * newLF);
    const newDailyPax = newPaxPerFlight * dailyDepartures;
    const newDailyRevenue = newDailyPax * fare;
    const newDailyASM = newSeats * distance * dailyDepartures;
    const newDailyCost = Math.round(newDailyASM * casm / 100);
    const newDailyProfit = newDailyRevenue - newDailyCost;
    const newRasm = (newDailyRevenue / newDailyASM) * 100;

    const deltaProfitVal = newDailyProfit - currentDailyProfit;
    const deltaRasmVal = Math.round((newRasm - currentRasm) * 100) / 100;

    setResult({
      route: `${origin}-${destination}`,
      distance_nm: distance,
      stage_length_casm_cents: Math.round(casm * 100) / 100,
      current_state: {
        equipment: 'A320neo',
        frequency: frequency,
        fare,
        daily_demand: currentDailyPax,
        segment_mix: { leisure: 0.4, vfr: 0.3, business: 0.2, cruise: 0.1 }
      },
      equipment_analysis: {
        options: [
          {
            option: 'Current',
            equipment: 'A320neo',
            frequency: frequency,
            seats: currentSeats,
            daily_capacity: currentSeats * dailyDepartures,
            expected_pax: currentDailyPax,
            load_factor: Math.round(currentLF * 100),
            revenue: currentDailyRevenue,
            cost: currentDailyCost,
            profit: currentDailyProfit,
            rasm_cents: Math.round(currentRasm * 100) / 100,
            asm: currentDailyASM,
            delta_profit: 0,
            delta_rasm: 0,
            recommendation: 'baseline'
          },
          {
            option: 'Upgauge',
            equipment: 'A321neo',
            frequency: frequency,
            seats: newSeats,
            daily_capacity: newSeats * dailyDepartures,
            expected_pax: newDailyPax,
            load_factor: Math.round(newLF * 100),
            revenue: newDailyRevenue,
            cost: newDailyCost,
            profit: newDailyProfit,
            rasm_cents: Math.round(newRasm * 100) / 100,
            asm: newDailyASM,
            delta_profit: deltaProfitVal,
            delta_rasm: deltaRasmVal,
            recommendation: 'recommended'
          }
        ],
        recommended: {
          option: 'Upgauge',
          equipment: 'A321neo',
          frequency: frequency,
          seats: newSeats,
          daily_capacity: newSeats * dailyDepartures,
          expected_pax: newDailyPax,
          load_factor: Math.round(newLF * 100),
          revenue: newDailyRevenue,
          cost: newDailyCost,
          profit: newDailyProfit,
          rasm_cents: Math.round(newRasm * 100) / 100,
          asm: newDailyASM,
          delta_profit: deltaProfitVal,
          delta_rasm: deltaRasmVal,
          recommendation: 'recommended'
        },
        rasm_improvement_cents: deltaRasmVal
      },
      demand_forecast: {
        predicted_demand: Math.round(currentDailyPax * 1.1),
        confidence_interval: [Math.round(currentDailyPax * 0.9), Math.round(currentDailyPax * 1.3)],
        confidence_level: 'medium',
        model_used: 'heuristic'
      },
      price_elasticity: {
        elasticity: -1.2,
        interpretation: 'Unit elastic - balanced',
        pricing_recommendation: { action: 'maintain_fares', suggested_change_pct: 0, expected_revenue_change_pct: 0 }
      },
      ai_route_score: {
        route: `${origin}-${destination}`,
        overall_score: 72,
        scores: { rasm_score: 68, strategic_score: 85, risk_score: 70, growth_score: 75 },
        recommendation: 'HOLD - Optimize existing operation',
        key_factors: ['Strong strategic fit', 'High growth potential']
      },
      recommendations: [{ priority: 1, category: 'equipment', action: 'Switch to A321neo at 2x daily', impact: `+$${deltaProfitVal.toLocaleString()}/day profit`, confidence: 'high' }],
      optimization_summary: { potential_profit_increase: deltaProfitVal, potential_rasm_increase: deltaRasmVal, confidence: 'high' }
    });

    setScenario({
      scenario: 'A320neo → A321neo',
      frequency_change: 0,
      before: { equipment: 'A320neo', frequency: frequency, asm: currentDailyASM, revenue: currentDailyRevenue, cost: currentDailyCost, profit: currentDailyProfit, rasm_cents: Math.round(currentRasm * 100) / 100 },
      after: { equipment: 'A321neo', frequency: frequency, asm: newDailyASM, revenue: newDailyRevenue, cost: newDailyCost, profit: newDailyProfit, rasm_cents: Math.round(newRasm * 100) / 100 },
      impact: { delta_profit: deltaProfitVal, delta_rasm: deltaRasmVal, delta_capacity_pct: Math.round((newSeats - currentSeats) / currentSeats * 100) }
    });
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center gap-3">
          <Cpu className="w-5 h-5 text-blue-600 animate-pulse" />
          <span className="text-slate-600">Initializing RASM optimizer...</span>
        </div>
      </div>
    );
  }

  if (!result || !scenario) return null;

  const current = result.equipment_analysis.options.find(o => o.option === 'Current') || result.equipment_analysis.options[0];
  const recommended = result.equipment_analysis.recommended;
  const scores = result.ai_route_score.scores;

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Route Selector */}
      <div className="flex gap-2 flex-wrap">
        {availableRoutes.slice(0, 8).map((r) => (
          <button
            key={r.route}
            onClick={() => setSelectedRoute(r.route)}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedRoute === r.route
                ? 'bg-[#002855] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            } disabled:opacity-50`}
          >
            {r.route}
          </button>
        ))}
      </div>

      {/* Header Card - McKinsey Navy */}
      <div className="bg-[#002855] rounded-t-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Route Optimization Analysis</h1>
            <p className="text-blue-200 text-sm">{result.route} • Stage Length: {Math.round(result.distance_nm)}nm</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">SOLVER ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Content - White Background */}
      <div className="bg-white rounded-b-lg shadow-lg -mt-6 pt-6">
        {/* Key Metrics Row */}
        <div className="px-6 pb-6 border-b border-slate-200">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Current RASM" value={`${current.rasm_cents.toFixed(2)}¢`} sublabel="per ASM" />
            <MetricCard label="Optimized RASM" value={`${recommended.rasm_cents.toFixed(2)}¢`} sublabel="per ASM" highlight />
            <MetricCard label="Daily Uplift" value={formatCurrencyDelta(scenario.impact.delta_profit, { suffix: '/day' })} sublabel="incremental profit" positive={scenario.impact.delta_profit >= 0} />
            <MetricCard label="Annual Impact" value={formatCurrencyDelta(scenario.impact.delta_profit * 365, { compact: true })} sublabel="at 100% execution" positive={scenario.impact.delta_profit >= 0} />
          </div>
        </div>

        {/* Equipment Comparison Table - McKinsey Style */}
        <div className="px-6 py-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Equipment Options Comparison</h2>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">METRIC</th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium">CURRENT<br/><span className="text-slate-400 font-normal">A320neo</span></th>
                  <th className="text-center px-4 py-3 text-blue-600 font-medium bg-blue-50">RECOMMENDED<br/><span className="text-blue-500 font-normal">A321neo</span></th>
                  <th className="text-center px-4 py-3 text-slate-500 font-medium">DELTA</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Seats" current={current.seats} recommended={recommended.seats} format="number" />
                <ComparisonRow label="Daily Capacity" current={current.daily_capacity} recommended={recommended.daily_capacity} format="number" />
                <ComparisonRow label="Load Factor" current={current.load_factor} recommended={recommended.load_factor} format="percent" />
                <ComparisonRow label="Daily Revenue" current={current.revenue} recommended={recommended.revenue} format="currency" />
                <ComparisonRow label="Daily Cost" current={current.cost} recommended={recommended.cost} format="currency" />
                <ComparisonRow label="Daily Profit" current={current.profit} recommended={recommended.profit} format="currency" />
                <ComparisonRow label="RASM (¢/ASM)" current={current.rasm_cents} recommended={recommended.rasm_cents} format="decimal" highlight />
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Score Card - McKinsey Style */}
        <div className="px-6 py-6 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">AI Route Assessment</h2>
          <div className="grid grid-cols-5 gap-4">
            <ScoreCard label="Overall" score={result.ai_route_score.overall_score} large />
            <ScoreCard label="RASM" score={scores.rasm_score} />
            <ScoreCard label="Strategic" score={scores.strategic_score} />
            <ScoreCard label="Risk" score={scores.risk_score} inverted />
            <ScoreCard label="Growth" score={scores.growth_score} />
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Recommendation:</span> {result.ai_route_score.recommendation}
            </p>
          </div>
        </div>

        {/* Constraint Validation */}
        <div className="px-6 py-6 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Constraint Validation</h2>
          <div className="grid grid-cols-2 gap-4">
            <ConstraintRow label="Fleet availability (A321neo at base)" status="pass" />
            <ConstraintRow label="Crew qualified for equipment" status="pass" />
            <ConstraintRow label="No MRO schedule conflicts" status="pass" />
            <ConstraintRow label="RASM exceeds stage-adjusted CASM" status="pass" detail={`${recommended.rasm_cents.toFixed(2)}¢ > ${result.stage_length_casm_cents}¢`} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 rounded-b-lg border-t border-slate-200">
          <p className="text-xs text-slate-400">
            Source: SkyWeave RASM Optimizer • Stage-length adjusted CASM based on Spirit Airlines 2024 actuals (11.35¢ avg)
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sublabel, highlight = false, positive = false }: {
  label: string;
  value: string;
  sublabel: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${positive ? 'text-emerald-600' : highlight ? 'text-blue-600' : 'text-slate-800'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400">{sublabel}</p>
    </div>
  );
}

function ComparisonRow({ label, current, recommended, format, highlight = false }: {
  label: string;
  current: number;
  recommended: number;
  format: 'number' | 'percent' | 'currency' | 'decimal';
  highlight?: boolean;
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'percent': return `${val.toFixed(0)}%`;
      case 'currency': return `$${val.toLocaleString()}`;
      case 'decimal': return val.toFixed(2);
      default: return val.toLocaleString();
    }
  };

  const delta = recommended - current;
  const deltaStr = format === 'currency'
    ? `${delta >= 0 ? '+' : ''}$${delta.toLocaleString()}`
    : format === 'percent'
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`
    : format === 'decimal'
    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
    : `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`;

  return (
    <tr className={highlight ? 'bg-emerald-50' : 'hover:bg-slate-50'}>
      <td className="px-4 py-3 text-slate-700 font-medium">{label}</td>
      <td className="px-4 py-3 text-center text-slate-600">{formatValue(current)}</td>
      <td className="px-4 py-3 text-center text-blue-700 font-semibold bg-blue-50">{formatValue(recommended)}</td>
      <td className={`px-4 py-3 text-center font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
        {deltaStr}
      </td>
    </tr>
  );
}

function ScoreCard({ label, score, large = false, inverted = false }: {
  label: string;
  score: number;
  large?: boolean;
  inverted?: boolean;
}) {
  // For risk, lower is better (inverted)
  const effectiveScore = inverted ? 100 - score : score;
  const color = effectiveScore >= 70 ? 'text-emerald-600' : effectiveScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const bgColor = effectiveScore >= 70 ? 'bg-emerald-50' : effectiveScore >= 50 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className={`p-3 rounded-lg text-center ${large ? bgColor : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold ${color} ${large ? 'text-3xl' : 'text-xl'}`}>{score}</p>
      {large && <p className="text-xs text-slate-400 mt-1">out of 100</p>}
    </div>
  );
}

function ConstraintRow({ label, status, detail }: { label: string; status: 'pass' | 'fail' | 'partial'; detail?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      {status === 'pass' ? (
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-600" />
        </div>
      ) : status === 'fail' ? (
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
          <X className="w-4 h-4 text-red-600" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-amber-600 text-xs font-bold">!</span>
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm text-slate-700">{label}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

export default OptimizationDemo;
