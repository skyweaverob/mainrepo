'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, Plane, Users, Wrench, DollarSign } from 'lucide-react';

interface SubComponent {
  label: string;
  delta: number;
  explanation: string;
}

interface RASMComponent {
  domain: 'NETWORK' | 'REVENUE' | 'CREW' | 'FLEET';
  label: string;
  delta: number;
  color: string;
  icon: React.ReactNode;
  subComponents?: SubComponent[];
}

interface RASMWaterfallProps {
  baseline: number;
  optimized: number;
  components: RASMComponent[];
  showDetails?: boolean;
}

const DOMAIN_ICONS = {
  NETWORK: <Plane className="w-4 h-4" />,
  REVENUE: <DollarSign className="w-4 h-4" />,
  CREW: <Users className="w-4 h-4" />,
  FLEET: <Wrench className="w-4 h-4" />,
};

const DOMAIN_COLORS = {
  NETWORK: { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' },
  REVENUE: { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700' },
  CREW: { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700' },
  FLEET: { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
};

export function RASMWaterfall({ baseline, optimized, components, showDetails = true }: RASMWaterfallProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  const totalDelta = optimized - baseline;
  const improvementPct = ((totalDelta / baseline) * 100).toFixed(1);

  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain);
    } else {
      newExpanded.add(domain);
    }
    setExpandedDomains(newExpanded);
  };

  // Calculate cumulative values for waterfall visualization
  let cumulative = baseline;
  const waterfallData = components.map(c => {
    const start = cumulative;
    cumulative += c.delta;
    return { ...c, start, end: cumulative };
  });

  const maxValue = Math.max(baseline, optimized) * 1.1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
        <h3 className="text-lg font-bold text-slate-800 mb-4">RASM Improvement Breakdown</h3>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Baseline RASM</div>
            <div className="text-2xl font-bold text-slate-600">{baseline.toFixed(2)}¢</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <div className="text-sm text-emerald-600 mb-1">Optimized RASM</div>
            <div className="text-2xl font-bold text-emerald-700">{optimized.toFixed(2)}¢</div>
            <div className="text-sm text-emerald-600">+{improvementPct}%</div>
          </div>
        </div>
      </div>

      {/* Waterfall Visualization */}
      <div className="p-6 border-b border-slate-200">
        <div className="relative h-16 bg-slate-100 rounded-lg overflow-hidden">
          {/* Baseline */}
          <div
            className="absolute top-0 h-full bg-slate-300 flex items-center justify-center"
            style={{ left: 0, width: `${(baseline / maxValue) * 100}%` }}
          >
            <span className="text-xs font-semibold text-slate-600">Baseline</span>
          </div>

          {/* Component bars */}
          {waterfallData.map((item, i) => (
            <div
              key={item.domain}
              className={`absolute top-0 h-full ${DOMAIN_COLORS[item.domain].bg} opacity-80 flex items-center justify-center`}
              style={{
                left: `${(item.start / maxValue) * 100}%`,
                width: `${(item.delta / maxValue) * 100}%`,
              }}
            >
              {item.delta / maxValue > 0.05 && (
                <span className="text-xs font-semibold text-white">+{item.delta.toFixed(2)}¢</span>
              )}
            </div>
          ))}

          {/* End marker */}
          <div
            className="absolute top-0 h-full w-1 bg-emerald-600"
            style={{ left: `${(optimized / maxValue) * 100}%` }}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4">
          {components.map(c => (
            <div key={c.domain} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${DOMAIN_COLORS[c.domain].bg}`} />
              <span className="text-sm text-slate-600">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="divide-y divide-slate-100">
          {components.map(component => {
            const isExpanded = expandedDomains.has(component.domain);
            const colors = DOMAIN_COLORS[component.domain];

            return (
              <div key={component.domain}>
                <button
                  onClick={() => component.subComponents && toggleDomain(component.domain)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${colors.light} ${colors.text} flex items-center justify-center`}>
                    {DOMAIN_ICONS[component.domain]}
                  </div>

                  <div className="flex-1 text-left">
                    <div className="font-semibold text-slate-800">{component.label}</div>
                    {component.subComponents && (
                      <div className="text-sm text-slate-500">
                        {component.subComponents.length} optimization factors
                      </div>
                    )}
                  </div>

                  <div className="text-right mr-4">
                    <div className={`text-lg font-bold ${colors.text}`}>
                      +{component.delta.toFixed(2)}¢
                    </div>
                    <div className="text-sm text-slate-500">
                      {((component.delta / totalDelta) * 100).toFixed(0)}% of improvement
                    </div>
                  </div>

                  {component.subComponents && (
                    isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )
                  )}
                </button>

                {/* Sub-components */}
                {isExpanded && component.subComponents && (
                  <div className="bg-slate-50 px-4 pb-4">
                    <div className="ml-14 space-y-2">
                      {component.subComponents.map((sub, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200"
                        >
                          <div>
                            <div className="font-medium text-slate-700">{sub.label}</div>
                            <div className="text-sm text-slate-500">{sub.explanation}</div>
                          </div>
                          <div className={`font-semibold ${colors.text}`}>
                            +{sub.delta.toFixed(2)}¢
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      <div className="p-4 bg-[#002855] text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-80">Total RASM Improvement</div>
            <div className="text-2xl font-bold">+{totalDelta.toFixed(2)}¢</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-400">+{improvementPct}%</div>
            <div className="text-sm opacity-80">network-wide</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to generate waterfall data from optimization results
export function generateWaterfallFromOptimization(
  baselineRasm: number,
  networkImpact: { equipment: number; frequency: number; timing: number },
  revenueImpact: { pricing: number; competitive: number; ancillary: number },
  crewImpact: { deadhead: number; utilization: number },
  fleetImpact: { aogReduction: number; tailAssignment: number }
): RASMWaterfallProps {
  const components: RASMComponent[] = [
    {
      domain: 'NETWORK',
      label: 'Network Optimization',
      delta: networkImpact.equipment + networkImpact.frequency + networkImpact.timing,
      color: '#3B82F6',
      icon: <Plane className="w-4 h-4" />,
      subComponents: [
        { label: 'Equipment right-sizing', delta: networkImpact.equipment, explanation: 'Match aircraft capacity to route demand' },
        { label: 'Frequency optimization', delta: networkImpact.frequency, explanation: 'Optimize departures per route' },
        { label: 'Schedule timing', delta: networkImpact.timing, explanation: 'Align with demand peaks' },
      ],
    },
    {
      domain: 'REVENUE',
      label: 'Revenue Management',
      delta: revenueImpact.pricing + revenueImpact.competitive + revenueImpact.ancillary,
      color: '#10B981',
      icon: <DollarSign className="w-4 h-4" />,
      subComponents: [
        { label: 'Demand-aligned pricing', delta: revenueImpact.pricing, explanation: 'Price to optimized capacity' },
        { label: 'Competitive response', delta: revenueImpact.competitive, explanation: 'React to competitor moves' },
        { label: 'Ancillary optimization', delta: revenueImpact.ancillary, explanation: 'Improve attach rates' },
      ],
    },
    {
      domain: 'CREW',
      label: 'Crew Efficiency',
      delta: crewImpact.deadhead + crewImpact.utilization,
      color: '#F59E0B',
      icon: <Users className="w-4 h-4" />,
      subComponents: [
        { label: 'Reduced deadhead', delta: crewImpact.deadhead, explanation: 'Less non-revenue positioning' },
        { label: 'Better utilization', delta: crewImpact.utilization, explanation: 'More productive pairings' },
      ],
    },
    {
      domain: 'FLEET',
      label: 'Fleet/MRO Optimization',
      delta: fleetImpact.aogReduction + fleetImpact.tailAssignment,
      color: '#8B5CF6',
      icon: <Wrench className="w-4 h-4" />,
      subComponents: [
        { label: 'Reduced AOG risk', delta: fleetImpact.aogReduction, explanation: 'Proactive maintenance' },
        { label: 'Better tail assignment', delta: fleetImpact.tailAssignment, explanation: 'Match reliability to RASM' },
      ],
    },
  ];

  const totalDelta = components.reduce((sum, c) => sum + c.delta, 0);

  return {
    baseline: baselineRasm,
    optimized: baselineRasm + totalDelta,
    components,
  };
}

export default RASMWaterfall;
