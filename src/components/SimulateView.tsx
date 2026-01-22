'use client';

import { useState } from 'react';
import {
  FlaskConical,
  Play,
  Plus,
  Settings,
  Clock,
  Plane,
  Cloud,
  Users,
  Wrench,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  Shuffle,
} from 'lucide-react';

/**
 * SimulateView - What-If Scenario Analysis
 *
 * Per spec (Section 18):
 * Allows users to run what-if scenarios independent of the optimizer,
 * testing specific changes or disruption scenarios.
 *
 * Scenario Types:
 * 1. Schedule Change: What if we retime/cancel/add flights?
 * 2. Equipment Swap: What if we swap tails on specific routes?
 * 3. Disruption: What if weather/ATC impacts specific airports?
 * 4. Capacity Change: What if we increase/decrease frequency?
 * 5. Custom: Define arbitrary parameter changes
 */

type ScenarioType = 'schedule' | 'equipment' | 'disruption' | 'capacity' | 'custom';

interface ScenarioConfig {
  name: string;
  type: ScenarioType;
  parameters: Record<string, any>;
}

interface SimulationResult {
  baseline: {
    completionFactor: number;
    otp: number;
    passengersDisrupted: number;
    recoveryTime: number;
    revenueImpact: number;
    rasmImpact: number;
  };
  scenario: {
    completionFactor: number;
    otp: number;
    passengersDisrupted: number;
    recoveryTime: number;
    revenueImpact: number;
    rasmImpact: number;
  };
  vulnerableFlights: Array<{
    flight: string;
    route: string;
    time: string;
    passengersAffected: number;
  }>;
  recommendedMitigations: string[];
}

const SCENARIO_TEMPLATES: Record<ScenarioType, { icon: any; label: string; description: string }> = {
  schedule: { icon: Clock, label: 'Schedule Change', description: 'Retime, cancel, or add flights' },
  equipment: { icon: Plane, label: 'Equipment Swap', description: 'Change aircraft assignments' },
  disruption: { icon: Cloud, label: 'Disruption', description: 'Weather or ATC impact' },
  capacity: { icon: TrendingUp, label: 'Capacity Change', description: 'Adjust frequency' },
  custom: { icon: Settings, label: 'Custom', description: 'Define custom parameters' },
};

const AIRPORTS = ['ATL', 'MCO', 'FLL', 'DTW', 'LAS', 'DEN', 'DFW', 'ORD', 'EWR', 'LAX'];
const DISRUPTION_TYPES = ['Ground delay program', 'Ground stop', 'Reduced arrival rate', 'Weather advisory'];

export function SimulateView() {
  const [activeScenario, setActiveScenario] = useState<ScenarioConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Scenario builder state
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioType, setScenarioType] = useState<ScenarioType>('disruption');
  const [disruptionParams, setDisruptionParams] = useState({
    airport: 'ATL',
    startTime: '14:00',
    duration: 4,
    impactType: 'Ground delay program',
    delayPerFlight: 45,
  });

  const runSimulation = () => {
    setIsRunning(true);

    // Simulate API call delay
    setTimeout(() => {
      // Mock simulation results
      const mockResult: SimulationResult = {
        baseline: {
          completionFactor: 98.2,
          otp: 81,
          passengersDisrupted: 120,
          recoveryTime: 0,
          revenueImpact: 0,
          rasmImpact: 0,
        },
        scenario: {
          completionFactor: 94.1,
          otp: 62,
          passengersDisrupted: 2840,
          recoveryTime: 6.2,
          revenueImpact: -340000,
          rasmImpact: -0.08,
        },
        vulnerableFlights: [
          { flight: 'NK234', route: 'ATL-MCO', time: '15:30', passengersAffected: 420 },
          { flight: 'NK567', route: 'ATL-FLL', time: '16:15', passengersAffected: 380 },
          { flight: 'NK891', route: 'ATL-DEN', time: '14:45', passengersAffected: 290 },
          { flight: 'NK123', route: 'ATL-LAS', time: '15:00', passengersAffected: 245 },
          { flight: 'NK456', route: 'ATL-EWR', time: '16:30', passengersAffected: 210 },
        ],
        recommendedMitigations: [
          'Pre-cancel NK891 (lowest load, highest buffer recovery)',
          'Pre-position spare aircraft at ATL from MCO',
          'Call 2 reserve crews at ATL',
          'Proactive rebooking for connections with <60min buffer',
        ],
      };

      setResult(mockResult);
      setIsRunning(false);
      setActiveScenario({
        name: scenarioName || `${disruptionParams.airport} Weather Impact`,
        type: scenarioType,
        parameters: disruptionParams,
      });
    }, 2000);
  };

  const getDelta = (baseline: number, scenario: number) => {
    const delta = scenario - baseline;
    return {
      value: delta,
      isPositive: delta > 0,
      isNegative: delta < 0,
    };
  };

  return (
    <div className="h-full overflow-auto p-6 bg-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <FlaskConical className="w-7 h-7 text-[#002855]" />
              Scenario Simulator
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Test what-if scenarios before making decisions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Scenario Builder */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="p-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-800">Build Scenario</h2>
              </div>

              <div className="p-4 space-y-4">
                {/* Scenario Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Scenario Name
                  </label>
                  <input
                    type="text"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="Weather impact ATL tomorrow"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855] focus:border-transparent"
                  />
                </div>

                {/* Scenario Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Scenario Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(SCENARIO_TEMPLATES) as [ScenarioType, typeof SCENARIO_TEMPLATES.schedule][]).map(
                      ([type, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => setScenarioType(type)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                              scenarioType === type
                                ? 'border-[#002855] bg-blue-50 text-[#002855]'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{config.label}</span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Disruption Parameters */}
                {scenarioType === 'disruption' && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700">Disruption Parameters</h3>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Airport</label>
                      <select
                        value={disruptionParams.airport}
                        onChange={(e) =>
                          setDisruptionParams({ ...disruptionParams, airport: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]"
                      >
                        {AIRPORTS.map((apt) => (
                          <option key={apt} value={apt}>
                            {apt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={disruptionParams.startTime}
                          onChange={(e) =>
                            setDisruptionParams({ ...disruptionParams, startTime: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Duration (hrs)</label>
                        <input
                          type="number"
                          value={disruptionParams.duration}
                          onChange={(e) =>
                            setDisruptionParams({
                              ...disruptionParams,
                              duration: parseInt(e.target.value),
                            })
                          }
                          min={1}
                          max={24}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Impact Type</label>
                      <select
                        value={disruptionParams.impactType}
                        onChange={(e) =>
                          setDisruptionParams({ ...disruptionParams, impactType: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]"
                      >
                        {DISRUPTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Delay per Flight (min)
                      </label>
                      <input
                        type="number"
                        value={disruptionParams.delayPerFlight}
                        onChange={(e) =>
                          setDisruptionParams({
                            ...disruptionParams,
                            delayPerFlight: parseInt(e.target.value),
                          })
                        }
                        min={0}
                        max={180}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002855]"
                      />
                    </div>
                  </div>
                )}

                {/* Run Button */}
                <button
                  onClick={runSimulation}
                  disabled={isRunning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white rounded-lg hover:bg-[#001a3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Running Simulation...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run Simulation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="col-span-2">
            {!result && !isRunning && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <FlaskConical className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Simulation Running</h3>
                <p className="text-sm text-slate-500">
                  Configure a scenario and click "Run Simulation" to see results
                </p>
              </div>
            )}

            {isRunning && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <div className="w-16 h-16 border-4 border-[#002855] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Running Simulation</h3>
                <p className="text-sm text-slate-500">
                  Analyzing {scenarioType === 'disruption' ? `${disruptionParams.airport} ${disruptionParams.impactType}` : 'scenario'}...
                </p>
              </div>
            )}

            {result && !isRunning && (
              <div className="space-y-4">
                {/* Scenario Header */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">
                        {activeScenario?.name || 'Simulation Results'}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {disruptionParams.airport} • {disruptionParams.startTime} • {disruptionParams.duration}hr {disruptionParams.impactType}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                      Completed
                    </span>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-800">Baseline vs Scenario</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Metric</th>
                        <th className="text-right px-6 py-3 text-sm font-semibold text-slate-700">Baseline</th>
                        <th className="text-right px-6 py-3 text-sm font-semibold text-slate-700">Scenario</th>
                        <th className="text-right px-6 py-3 text-sm font-semibold text-slate-700">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { metric: 'Completion Factor', baseline: result.baseline.completionFactor, scenario: result.scenario.completionFactor, unit: '%' },
                        { metric: 'On-Time Performance', baseline: result.baseline.otp, scenario: result.scenario.otp, unit: '%' },
                        { metric: 'Passengers Disrupted', baseline: result.baseline.passengersDisrupted, scenario: result.scenario.passengersDisrupted, unit: '' },
                        { metric: 'Recovery Time', baseline: result.baseline.recoveryTime || '-', scenario: `${result.scenario.recoveryTime} hours`, unit: '' },
                        { metric: 'Revenue Impact', baseline: '$0', scenario: `$${(result.scenario.revenueImpact / 1000).toFixed(0)}K`, unit: '' },
                        { metric: 'RASM Impact', baseline: '0.00¢', scenario: `${result.scenario.rasmImpact}¢`, unit: '' },
                      ].map((row, i) => {
                        const delta = typeof row.baseline === 'number' && typeof row.scenario === 'number'
                          ? getDelta(row.baseline, row.scenario as number)
                          : null;
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-6 py-3 text-sm font-medium text-slate-800">{row.metric}</td>
                            <td className="px-6 py-3 text-sm text-slate-600 text-right">
                              {typeof row.baseline === 'number' ? `${row.baseline}${row.unit}` : row.baseline}
                            </td>
                            <td className="px-6 py-3 text-sm text-slate-600 text-right">
                              {typeof row.scenario === 'number' ? `${row.scenario}${row.unit}` : row.scenario}
                            </td>
                            <td className="px-6 py-3 text-sm text-right">
                              {delta ? (
                                <span className={`flex items-center justify-end gap-1 ${
                                  row.metric === 'Passengers Disrupted'
                                    ? (delta.isPositive ? 'text-red-600' : 'text-emerald-600')
                                    : (delta.isNegative ? 'text-red-600' : delta.isPositive ? 'text-emerald-600' : 'text-slate-600')
                                }`}>
                                  {delta.isPositive ? <TrendingUp className="w-4 h-4" /> : delta.isNegative ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                  {delta.value > 0 ? '+' : ''}{delta.value}{row.unit}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vulnerable Flights */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-200 bg-amber-50">
                    <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Vulnerable Flights (Highest Downstream Impact)
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {result.vulnerableFlights.map((flight, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-bold text-[#002855]">{flight.flight}</span>
                          <span className="text-slate-600">{flight.route}</span>
                          <span className="text-sm text-slate-500">{flight.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">
                            {flight.passengersAffected} passengers affected
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Mitigations */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="p-4 border-b border-slate-200 bg-emerald-50">
                    <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Recommended Mitigations
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {result.recommendedMitigations.map((mitigation, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-emerald-700">{i + 1}</span>
                        </div>
                        <span className="text-sm text-slate-700">{mitigation}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-slate-200 flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#002855] text-white rounded-lg hover:bg-[#001a3d] transition-colors">
                      <CheckCircle className="w-4 h-4" />
                      Apply Mitigations
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                      <Shuffle className="w-4 h-4" />
                      Run Recovery Optimizer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimulateView;
