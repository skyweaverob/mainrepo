'use client';

import { useState } from 'react';
import { Play, AlertTriangle, CheckCircle } from 'lucide-react';
import * as api from '@/lib/api';

type ScenarioType = 'disruption' | 'equipment' | 'schedule';

interface SimulationResult {
  baseline: { completionFactor: number; otp: number; passengersDisrupted: number; recoveryTime: number; revenueImpact: number; rasmImpact: number };
  scenario: { completionFactor: number; otp: number; passengersDisrupted: number; recoveryTime: number; revenueImpact: number; rasmImpact: number };
  vulnerableFlights: Array<{ flight: string; route: string; time: string; passengersAffected: number }>;
  recommendedMitigations: string[];
}

const AIRPORTS = ['ATL', 'MCO', 'FLL', 'DTW', 'LAS', 'DEN', 'DFW', 'ORD', 'EWR', 'LAX'];

export function SimulateView() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [scenarioType, setScenarioType] = useState<ScenarioType>('disruption');
  const [params, setParams] = useState({ airport: 'ATL', startTime: '14:00', duration: 4, impactType: 'Ground delay program', delayPerFlight: 45 });

  const runSimulation = async () => {
    setIsRunning(true);
    try {
      if (scenarioType === 'disruption') {
        const apiResult = await api.simulateDisruption({
          airport: params.airport, start_time: params.startTime, duration_hours: params.duration,
          impact_type: params.impactType, delay_per_flight: params.delayPerFlight,
        });
        setResult({
          baseline: {
            completionFactor: apiResult.data.baseline.completion_factor, otp: apiResult.data.baseline.otp,
            passengersDisrupted: apiResult.data.baseline.passengers_disrupted, recoveryTime: apiResult.data.baseline.recovery_time_hours,
            revenueImpact: apiResult.data.baseline.revenue_impact, rasmImpact: apiResult.data.baseline.rasm_impact,
          },
          scenario: {
            completionFactor: apiResult.data.scenario_impact.completion_factor, otp: apiResult.data.scenario_impact.otp,
            passengersDisrupted: apiResult.data.scenario_impact.passengers_disrupted, recoveryTime: apiResult.data.scenario_impact.recovery_time_hours,
            revenueImpact: apiResult.data.scenario_impact.revenue_impact, rasmImpact: apiResult.data.scenario_impact.rasm_impact,
          },
          vulnerableFlights: apiResult.data.vulnerable_flights.map((f) => ({ flight: f.flight, route: f.route, time: f.time, passengersAffected: f.passengers_affected })),
          recommendedMitigations: apiResult.data.recommended_mitigations,
        });
      } else {
        // Demo data for other scenario types
        setResult({
          baseline: { completionFactor: 98.2, otp: 81, passengersDisrupted: 120, recoveryTime: 0, revenueImpact: 0, rasmImpact: 0 },
          scenario: { completionFactor: 94.1, otp: 62, passengersDisrupted: 2840, recoveryTime: 6.2, revenueImpact: -340000, rasmImpact: -0.08 },
          vulnerableFlights: [
            { flight: 'NK234', route: 'ATL-MCO', time: '15:30', passengersAffected: 420 },
            { flight: 'NK567', route: 'ATL-FLL', time: '16:15', passengersAffected: 380 },
          ],
          recommendedMitigations: ['Pre-cancel lowest-load flights', 'Pre-position spare aircraft', 'Call reserve crews'],
        });
      }
    } catch {
      setResult({
        baseline: { completionFactor: 98.2, otp: 81, passengersDisrupted: 120, recoveryTime: 0, revenueImpact: 0, rasmImpact: 0 },
        scenario: { completionFactor: 94.1, otp: 62, passengersDisrupted: 2840, recoveryTime: 6.2, revenueImpact: -340000, rasmImpact: -0.08 },
        vulnerableFlights: [{ flight: 'NK234', route: 'ATL-MCO', time: '15:30', passengersAffected: 420 }],
        recommendedMitigations: ['[Demo] Pre-cancel lowest-load flights', '[Demo] Pre-position spare aircraft'],
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          {/* Scenario Builder */}
          <div className="border border-slate-200 rounded p-4 space-y-4">
            <div className="text-sm font-medium">Build Scenario</div>

            {/* Type selector */}
            <div className="flex gap-2">
              {(['disruption', 'equipment', 'schedule'] as ScenarioType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setScenarioType(t)}
                  className={`px-3 py-1 text-sm rounded ${scenarioType === t ? 'bg-[#002855] text-white' : 'border border-slate-200'}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {scenarioType === 'disruption' && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs text-slate-500">Airport</label>
                  <select value={params.airport} onChange={(e) => setParams({ ...params, airport: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded">
                    {AIRPORTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500">Start</label>
                    <input type="time" value={params.startTime} onChange={(e) => setParams({ ...params, startTime: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Hours</label>
                    <input type="number" value={params.duration} onChange={(e) => setParams({ ...params, duration: parseInt(e.target.value) })}
                      min={1} max={24} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Delay/Flight (min)</label>
                  <input type="number" value={params.delayPerFlight} onChange={(e) => setParams({ ...params, delayPerFlight: parseInt(e.target.value) })}
                    min={0} max={180} className="w-full mt-1 px-2 py-1.5 border border-slate-200 rounded" />
                </div>
              </div>
            )}

            <button onClick={runSimulation} disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#002855] text-white text-sm rounded disabled:opacity-50">
              {isRunning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Running...' : 'Run Simulation'}
            </button>
          </div>

          {/* Results */}
          <div className="col-span-2 space-y-4">
            {!result && !isRunning && (
              <div className="border border-slate-200 rounded p-8 text-center text-slate-400">
                Configure scenario and run simulation
              </div>
            )}

            {isRunning && (
              <div className="border border-slate-200 rounded p-8 text-center">
                <div className="w-8 h-8 border-2 border-[#002855] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-sm text-slate-500">Running simulation...</span>
              </div>
            )}

            {result && !isRunning && (
              <>
                {/* Comparison */}
                <div className="border border-slate-200 rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase">
                        <th className="px-3 py-2">Metric</th>
                        <th className="px-3 py-2 text-right">Baseline</th>
                        <th className="px-3 py-2 text-right">Scenario</th>
                        <th className="px-3 py-2 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { m: 'Completion', b: result.baseline.completionFactor, s: result.scenario.completionFactor, u: '%' },
                        { m: 'OTP', b: result.baseline.otp, s: result.scenario.otp, u: '%' },
                        { m: 'PAX Disrupted', b: result.baseline.passengersDisrupted, s: result.scenario.passengersDisrupted, u: '', invert: true },
                        { m: 'Recovery', b: 0, s: result.scenario.recoveryTime, u: 'h', invert: true },
                        { m: 'Revenue', b: 0, s: result.scenario.revenueImpact / 1000, u: 'K' },
                      ].map((r, i) => {
                        const d = r.s - r.b;
                        const bad = r.invert ? d > 0 : d < 0;
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2">{r.m}</td>
                            <td className="px-3 py-2 text-right">{r.b}{r.u}</td>
                            <td className="px-3 py-2 text-right">{r.s.toFixed(r.u === '%' ? 1 : 0)}{r.u}</td>
                            <td className={`px-3 py-2 text-right font-medium ${bad ? 'text-red-600' : d > 0 ? 'text-emerald-600' : ''}`}>
                              {d > 0 ? '+' : ''}{d.toFixed(r.u === '%' ? 1 : 0)}{r.u}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vulnerable Flights */}
                <div className="border border-slate-200 rounded">
                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-sm font-medium text-amber-800">
                    <AlertTriangle className="w-4 h-4" /> Vulnerable Flights
                  </div>
                  <div className="divide-y">
                    {result.vulnerableFlights.map((f, i) => (
                      <div key={i} className="px-3 py-2 flex justify-between text-sm">
                        <span><span className="font-mono font-medium">{f.flight}</span> {f.route} <span className="text-slate-400">{f.time}</span></span>
                        <span className="text-slate-500">{f.passengersAffected} PAX</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mitigations */}
                <div className="border border-slate-200 rounded">
                  <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-sm font-medium text-emerald-800">
                    <CheckCircle className="w-4 h-4" /> Recommended Actions
                  </div>
                  <div className="p-3 space-y-2">
                    {result.recommendedMitigations.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimulateView;
