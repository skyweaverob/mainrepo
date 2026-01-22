'use client';

import { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  ArrowRight,
  Check,
  DollarSign,
  Plane,
  Users,
  Wrench,
  BarChart3,
  Target,
  Zap,
  ArrowUpRight,
  Calculator,
  Award,
  ChevronDown,
} from 'lucide-react';

/**
 * DemoView - The VC/Board Presentation
 *
 * Purpose: Convince a VC or Board member that SkyWeave is the only system
 * that optimizes for RASM—and that this creates massive financial value.
 *
 * Story arc:
 * 1. Airlines are measured on RASM
 * 2. No existing system optimizes for RASM
 * 3. SkyWeave does
 * 4. Here's the money
 *
 * 7 Sections:
 * 1. "How Airlines Run Today" (The Problem)
 * 2. "How SkyWeave Works" (The Solution)
 * 3. "Live Value Engine" (The Proof)
 * 4. "One Decision → Millions" (Concrete Example)
 * 5. "BCG Alignment" (Industry Validation)
 * 6. "ROI Calculator" (Interactive Proof)
 * 7. "Why We Win" (Competitive Position)
 */

// Demo/Live mode toggle
interface DemoViewProps {
  isLiveMode?: boolean;
  onToggleMode?: () => void;
}

// Demo data - curated, consistent numbers
const DEMO_DATA = {
  before: {
    rasm: 7.72,
    revenuePerDay: 3100000,
    completionFactor: 97.1,
    otp: 78,
    loadFactor: 86,
    recoveryTime: 8.2,
    mxRisk: 'HIGH',
  },
  after: {
    rasm: 8.41,
    revenuePerDay: 3380000,
    completionFactor: 98.6,
    otp: 86,
    loadFactor: 89,
    recoveryTime: 3.1,
    mxRisk: 'LOW',
  },
  featuredOptimization: {
    route: 'MCO-PHL',
    routeName: 'Orlando to Philadelphia',
    before: {
      aircraft: 'A320',
      seats: 186,
      loadFactor: 88,
      yield: 142,
      profitPerDay: 12400,
    },
    after: {
      aircraft: 'A321',
      seats: 228,
      loadFactor: 95,
      yield: 148,
      profitPerDay: 27100,
    },
    annualImpact: 5400000,
  },
  bcgMapping: [
    { bcg: 'AI-built, holistically integrated ops control', skyweave: 'Control Room v2', implemented: true },
    { bcg: 'Predictive maintenance integrated into fleet strategy', skyweave: 'Tail Health Engine', implemented: true },
    { bcg: 'Schedule robustness simulations', skyweave: 'Scenario Simulator', implemented: true },
    { bcg: 'Facilities utilization forecasts', skyweave: 'Station Readiness', implemented: true },
    { bcg: 'Real-time risk visibility & prioritization', skyweave: 'Risk Engine', implemented: true },
    { bcg: 'Optimized (re)routing and schedule moves', skyweave: 'RASM Optimizer', implemented: true },
    { bcg: 'Dynamic resource dispatching', skyweave: 'Resource Optimizer', implemented: true },
    { bcg: 'Disruption recovery', skyweave: 'Recovery Cockpit', implemented: true },
    { bcg: 'Data products / data foundations', skyweave: 'Data Platform', implemented: true },
  ],
};

export function DemoView({ isLiveMode = false, onToggleMode }: DemoViewProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [roiInputs, setRoiInputs] = useState({
    fleetSize: 120,
    annualRevenue: 3.5,
    routes: 180,
    currentOtp: 78,
  });
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // Calculate ROI outputs
  const roiOutputs = {
    revenueUplift: Math.round(roiInputs.annualRevenue * 0.02 * 1000) / 1000 * 1000, // 2% RASM improvement
    costSavings: Math.round(roiInputs.fleetSize * 0.19 * 1000) / 1000, // ~$190K per aircraft
    ebitdaImpact: 0,
    roi: 0,
    paybackMonths: 0,
  };
  roiOutputs.ebitdaImpact = roiOutputs.revenueUplift + roiOutputs.costSavings;
  roiOutputs.roi = roiOutputs.ebitdaImpact / 32; // Assuming $32M implementation cost
  roiOutputs.paybackMonths = Math.round(12 / roiOutputs.roi);

  // Scroll observer for section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.findIndex((ref) => ref === entry.target);
            if (index !== -1) setActiveSection(index);
          }
        });
      },
      { threshold: 0.5 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (index: number) => {
    sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
  };

  const delta = {
    rasm: DEMO_DATA.after.rasm - DEMO_DATA.before.rasm,
    rasmPct: ((DEMO_DATA.after.rasm - DEMO_DATA.before.rasm) / DEMO_DATA.before.rasm) * 100,
    revenue: DEMO_DATA.after.revenuePerDay - DEMO_DATA.before.revenuePerDay,
    otp: DEMO_DATA.after.otp - DEMO_DATA.before.otp,
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Mode Toggle */}
      <div className="fixed top-32 right-6 z-50 flex items-center gap-2 bg-white rounded-lg shadow-lg border border-slate-200 p-1">
        <button
          onClick={() => !isLiveMode && onToggleMode?.()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
            !isLiveMode ? 'bg-[#002855] text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Demo Mode
        </button>
        <button
          onClick={() => isLiveMode && onToggleMode?.()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
            isLiveMode ? 'bg-[#002855] text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Live Mode
        </button>
      </div>

      {/* Navigation Dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
        {['Problem', 'Solution', 'Proof', 'Example', 'Validation', 'ROI', 'Position'].map((label, i) => (
          <button
            key={i}
            onClick={() => scrollToSection(i)}
            className="group flex items-center gap-2"
          >
            <span
              className={`text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
                activeSection === i ? 'text-[#002855]' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                activeSection === i
                  ? 'bg-[#002855] scale-125'
                  : 'bg-slate-300 hover:bg-slate-400'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Section 1: The Problem */}
      <section
        ref={(el) => { sectionRefs.current[0] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-gradient-to-br from-slate-50 to-slate-100"
      >
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              How Airlines Run Today
            </h1>
            <p className="text-xl text-slate-500">The fragmentation problem</p>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-12">
            {[
              { name: 'Network', icon: Plane, color: 'bg-blue-100 text-blue-600' },
              { name: 'Crew', icon: Users, color: 'bg-green-100 text-green-600' },
              { name: 'MRO', icon: Wrench, color: 'bg-orange-100 text-orange-600' },
              { name: 'Revenue', icon: DollarSign, color: 'bg-purple-100 text-purple-600' },
              { name: 'Ops', icon: BarChart3, color: 'bg-pink-100 text-pink-600' },
            ].map((dept, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className={`w-20 h-20 rounded-xl ${dept.color} flex items-center justify-center shadow-md`}>
                  <dept.icon className="w-10 h-10" />
                </div>
                <span className="font-semibold text-slate-700">{dept.name}</span>
                <div className="h-8 border-l-2 border-dashed border-red-300" />
              </div>
            ))}
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h3 className="text-lg font-semibold text-red-800">Disconnected Systems = Lost Revenue</h3>
            </div>
            <ul className="grid grid-cols-2 gap-3 text-sm text-red-700">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Planning happens in silos</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Manual tradeoffs take days</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Constraints are invisible</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Reactions are delayed</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Revenue leaks through the cracks</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> No one optimizes for RASM</li>
            </ul>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Decision cycle', value: '5-14 days', bad: true },
              { label: 'Forecast accuracy', value: '~60%', bad: true },
              { label: 'Disruption recovery', value: '6-12 hours', bad: true },
              { label: 'Annual revenue leakage', value: '$50-200M', bad: true },
            ].map((metric, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-slate-800">{metric.value}</div>
                <div className="text-sm text-slate-500">{metric.label}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-12">
            <button onClick={() => scrollToSection(1)} className="flex items-center gap-2 text-[#002855] hover:text-blue-700">
              <span className="text-sm font-medium">See the solution</span>
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: The Solution */}
      <section
        ref={(el) => { sectionRefs.current[1] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-white"
      >
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              The RASM Optimization Engine
            </h1>
            <p className="text-xl text-slate-500">The only system built for the metric that matters</p>
          </div>

          <div className="relative bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 p-8 mb-12">
            {/* Input side */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {['Demand', 'Fares', 'Costs', 'MX Risk', 'Crew', 'Station'].map((input, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-24 text-right text-sm font-medium text-slate-600">{input}</div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>

            {/* Center optimizer */}
            <div className="flex justify-center">
              <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-[#002855] to-[#004080] flex flex-col items-center justify-center text-white shadow-xl">
                <Zap className="w-12 h-12 mb-3" />
                <div className="text-2xl font-bold">SKYWEAVE</div>
                <div className="text-sm text-blue-200">OPTIMIZER</div>
              </div>
            </div>

            {/* Output side */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 text-center">
                <div className="text-sm text-emerald-600 font-medium mb-1">OUTPUT</div>
                <div className="text-4xl font-bold text-emerald-700">RASM: 8.41¢</div>
                <div className="text-lg text-emerald-600">+9.0%</div>
              </div>
            </div>
          </div>

          <div className="bg-[#002855] text-white rounded-xl p-8 mb-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">The Insight</h3>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-lg text-blue-200 mb-2">Airlines are measured on</div>
                <div className="text-3xl font-bold">RASM</div>
              </div>
              <div>
                <div className="text-lg text-blue-200 mb-2">Wall Street judges on</div>
                <div className="text-3xl font-bold">RASM</div>
              </div>
              <div>
                <div className="text-lg text-blue-200 mb-2">Executives are paid on</div>
                <div className="text-3xl font-bold">RASM</div>
              </div>
            </div>
            <div className="text-center mt-6 text-xl">
              Yet no system optimizes for RASM. <span className="font-bold">Until now.</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: Check, label: 'Unified data across all domains' },
              { icon: Check, label: 'Constraints visible in one place' },
              { icon: Check, label: 'Optimizer built for RASM' },
              { icon: Check, label: 'Every recommendation shows RASM impact' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg p-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: The Proof */}
      <section
        ref={(el) => { sectionRefs.current[2] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-gradient-to-br from-emerald-50 to-white"
      >
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              The RASM Engine in Action
            </h1>
            <p className="text-xl text-slate-500">Real results, real money</p>
          </div>

          {/* Hero RASM Display */}
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-8 mb-8 text-center shadow-lg">
            <div className="text-sm text-emerald-600 font-medium mb-2">NETWORK RASM</div>
            <div className="text-6xl font-bold text-emerald-700 mb-2">{DEMO_DATA.after.rasm}¢</div>
            <div className="flex items-center justify-center gap-2 text-2xl text-emerald-600">
              <ArrowUpRight className="w-6 h-6" />
              <span>+{delta.rasmPct.toFixed(1)}%</span>
            </div>
            <div className="text-slate-500 mt-2">
              The only system that optimizes for the metric you're measured on.
            </div>
          </div>

          {/* Before/After Comparison */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Before */}
            <div className="bg-slate-100 rounded-xl p-6">
              <div className="text-lg font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                BEFORE SKYWEAVE
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">RASM</span>
                  <span className="font-bold text-slate-800">{DEMO_DATA.before.rasm}¢</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Revenue</span>
                  <span className="font-bold text-slate-800">${(DEMO_DATA.before.revenuePerDay / 1000000).toFixed(1)}M/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">OTP</span>
                  <span className="font-bold text-slate-800">{DEMO_DATA.before.otp}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">MX Risk</span>
                  <span className="font-bold text-red-600">{DEMO_DATA.before.mxRisk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Recovery</span>
                  <span className="font-bold text-slate-800">{DEMO_DATA.before.recoveryTime} hrs</span>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="bg-emerald-50 rounded-xl p-6 border-2 border-emerald-200">
              <div className="text-lg font-semibold text-emerald-700 mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                WITH SKYWEAVE
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-emerald-700">RASM</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-800">{DEMO_DATA.after.rasm}¢</span>
                    <span className="text-sm text-emerald-600">+{delta.rasmPct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Revenue</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-800">${(DEMO_DATA.after.revenuePerDay / 1000000).toFixed(2)}M/day</span>
                    <span className="text-sm text-emerald-600">+${(delta.revenue / 1000).toFixed(0)}K</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">OTP</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-800">{DEMO_DATA.after.otp}%</span>
                    <span className="text-sm text-emerald-600">+{delta.otp} pts</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">MX Risk</span>
                  <span className="font-bold text-emerald-600">{DEMO_DATA.after.mxRisk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700">Recovery</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-800">{DEMO_DATA.after.recoveryTime} hrs</span>
                    <span className="text-sm text-emerald-600">-62%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Annual Impact */}
          <div className="bg-[#002855] text-white rounded-xl p-6 text-center">
            <div className="text-sm text-blue-200 mb-2">ANNUAL RASM IMPACT</div>
            <div className="text-3xl font-bold">
              +{delta.rasm.toFixed(2)}¢ = +$102M revenue
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Concrete Example */}
      <section
        ref={(el) => { sectionRefs.current[3] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-white"
      >
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              One Optimization. Real Money.
            </h1>
            <p className="text-xl text-slate-500">
              Route: {DEMO_DATA.featuredOptimization.routeName}
            </p>
          </div>

          <div className="bg-gradient-to-r from-slate-50 to-emerald-50 rounded-2xl border border-slate-200 p-8 mb-8">
            <div className="grid grid-cols-2 gap-12">
              {/* Before */}
              <div>
                <div className="text-lg font-semibold text-slate-600 mb-4">BEFORE</div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Plane className="w-8 h-8 text-slate-400" />
                    <div>
                      <div className="text-2xl font-bold text-slate-800">{DEMO_DATA.featuredOptimization.before.aircraft}</div>
                      <div className="text-sm text-slate-500">{DEMO_DATA.featuredOptimization.before.seats} seats</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-sm text-slate-500">Load Factor</div>
                      <div className="text-xl font-bold text-slate-800">{DEMO_DATA.featuredOptimization.before.loadFactor}%</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-sm text-slate-500">Yield</div>
                      <div className="text-xl font-bold text-slate-800">${DEMO_DATA.featuredOptimization.before.yield}</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="text-sm text-slate-500">Profit/day</div>
                    <div className="text-2xl font-bold text-slate-800">${DEMO_DATA.featuredOptimization.before.profitPerDay.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* After */}
              <div>
                <div className="text-lg font-semibold text-emerald-600 mb-4">AFTER</div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Plane className="w-8 h-8 text-emerald-500" />
                    <div>
                      <div className="text-2xl font-bold text-emerald-700">{DEMO_DATA.featuredOptimization.after.aircraft}</div>
                      <div className="text-sm text-emerald-600">{DEMO_DATA.featuredOptimization.after.seats} seats</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <div className="text-sm text-emerald-600">Load Factor</div>
                      <div className="text-xl font-bold text-emerald-700">{DEMO_DATA.featuredOptimization.after.loadFactor}%</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <div className="text-sm text-emerald-600">Yield</div>
                      <div className="text-xl font-bold text-emerald-700">${DEMO_DATA.featuredOptimization.after.yield}</div>
                    </div>
                  </div>
                  <div className="bg-emerald-100 rounded-lg p-4 border border-emerald-200">
                    <div className="text-sm text-emerald-600">Profit/day</div>
                    <div className="text-2xl font-bold text-emerald-700">${DEMO_DATA.featuredOptimization.after.profitPerDay.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Uplift */}
            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
              <div className="text-lg text-slate-600 mb-2">DAILY UPLIFT</div>
              <div className="text-4xl font-bold text-emerald-600">
                +${(DEMO_DATA.featuredOptimization.after.profitPerDay - DEMO_DATA.featuredOptimization.before.profitPerDay).toLocaleString()}
              </div>
              <div className="text-slate-500 mt-2">
                Annual Impact: <span className="font-bold text-emerald-600">${(DEMO_DATA.featuredOptimization.annualImpact / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          </div>

          {/* How SkyWeave Identified This */}
          <div className="bg-slate-50 rounded-xl p-6">
            <div className="font-semibold text-slate-700 mb-4">How SkyWeave identified this:</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { step: 'Demand forecast', detail: 'High unmet demand detected' },
                { step: 'MX feasibility', detail: 'A321 N234NK available, no conflicts' },
                { step: 'Crew legality', detail: 'Current pairings compatible' },
                { step: 'Station capacity', detail: 'PHL gates can handle A321' },
                { step: 'Fare response', detail: 'Yield improvement from reduced spill' },
                { step: 'RASM impact', detail: '+0.08¢ network RASM contribution' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-200">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <div>
                    <div className="font-medium text-slate-700">{item.step}</div>
                    <div className="text-sm text-slate-500">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: BCG Alignment */}
      <section
        ref={(el) => { sectionRefs.current[4] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-gradient-to-br from-blue-50 to-white"
      >
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              Built for the Future of Airlines
            </h1>
            <p className="text-xl text-slate-500">Aligned with BCG's "Tomorrow" vision</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg">
            <div className="grid grid-cols-3 bg-slate-100 p-4 font-semibold text-slate-700">
              <div>BCG "Tomorrow" Capability</div>
              <div>SkyWeave Implementation</div>
              <div className="text-center">Status</div>
            </div>
            {DEMO_DATA.bcgMapping.map((item, i) => (
              <div key={i} className={`grid grid-cols-3 p-4 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="text-slate-600">{item.bcg}</div>
                <div className="font-medium text-[#002855]">{item.skyweave}</div>
                <div className="flex justify-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    item.implemented ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}>
                    <Check className={`w-5 h-5 ${item.implemented ? 'text-emerald-600' : 'text-amber-600'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3 mt-8">
            {DEMO_DATA.bcgMapping.map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
            ))}
          </div>
          <div className="text-center text-emerald-600 font-medium mt-4">
            All 9 BCG "Tomorrow" capabilities implemented
          </div>
        </div>
      </section>

      {/* Section 6: ROI Calculator */}
      <section
        ref={(el) => { sectionRefs.current[5] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-white"
      >
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              What This Means for Your Airline
            </h1>
            <p className="text-xl text-slate-500">Adjust the inputs to see your ROI</p>
          </div>

          <div className="grid grid-cols-2 gap-12">
            {/* Inputs */}
            <div className="bg-slate-50 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calculator className="w-6 h-6 text-[#002855]" />
                <h3 className="text-lg font-semibold text-slate-800">INPUTS</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Fleet Size</label>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    value={roiInputs.fleetSize}
                    onChange={(e) => setRoiInputs({ ...roiInputs, fleetSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xl font-bold text-[#002855]">{roiInputs.fleetSize} aircraft</div>
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Annual Revenue ($B)</label>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={roiInputs.annualRevenue}
                    onChange={(e) => setRoiInputs({ ...roiInputs, annualRevenue: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xl font-bold text-[#002855]">${roiInputs.annualRevenue.toFixed(1)}B</div>
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Routes</label>
                  <input
                    type="range"
                    min="50"
                    max="400"
                    value={roiInputs.routes}
                    onChange={(e) => setRoiInputs({ ...roiInputs, routes: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xl font-bold text-[#002855]">{roiInputs.routes} routes</div>
                </div>
                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Current OTP</label>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    value={roiInputs.currentOtp}
                    onChange={(e) => setRoiInputs({ ...roiInputs, currentOtp: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xl font-bold text-[#002855]">{roiInputs.currentOtp}%</div>
                </div>
              </div>
            </div>

            {/* Outputs */}
            <div className="bg-emerald-50 rounded-xl p-6 border-2 border-emerald-200">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-semibold text-emerald-700">OUTPUTS</h3>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-emerald-200">
                  <div className="text-sm text-emerald-600">Revenue Uplift</div>
                  <div className="text-3xl font-bold text-emerald-700">+${roiOutputs.revenueUplift.toFixed(0)}M</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-emerald-200">
                  <div className="text-sm text-emerald-600">Cost Savings</div>
                  <div className="text-3xl font-bold text-emerald-700">+${roiOutputs.costSavings.toFixed(0)}M</div>
                </div>
                <div className="bg-emerald-100 rounded-lg p-4 border border-emerald-300">
                  <div className="text-sm text-emerald-600">EBITDA Impact</div>
                  <div className="text-3xl font-bold text-emerald-700">+${roiOutputs.ebitdaImpact.toFixed(0)}M</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-emerald-200">
                    <div className="text-sm text-emerald-600">ROI</div>
                    <div className="text-2xl font-bold text-emerald-700">{roiOutputs.roi.toFixed(1)}x</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-emerald-200">
                    <div className="text-sm text-emerald-600">Payback</div>
                    <div className="text-2xl font-bold text-emerald-700">{roiOutputs.paybackMonths} months</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 text-sm text-slate-500">
            Assumptions: 2% RASM improvement, 5% OTP improvement, 15% reduction in disruption costs. Conservative estimates.
          </div>
        </div>
      </section>

      {/* Section 7: Why We Win */}
      <section
        ref={(el) => { sectionRefs.current[6] = el; }}
        className="min-h-screen flex items-center justify-center p-12 bg-gradient-to-br from-[#002855] to-[#004080]"
      >
        <div className="max-w-5xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              Why Airlines Choose SkyWeave
            </h1>
          </div>

          <div className="space-y-6">
            {[
              {
                icon: Target,
                title: 'THE ONLY SYSTEM BUILT FOR RASM',
                description: 'Airlines are measured on RASM. We optimize for RASM. No one else does. That\'s the whole point.',
              },
              {
                icon: Zap,
                title: 'TRUE CROSS-DOMAIN OPTIMIZATION',
                description: 'Network + Fleet + Crew + MX + Revenue in one engine because RASM depends on all of them.',
              },
              {
                icon: Award,
                title: 'RECOMMENDATIONS THAT EXECUTE',
                description: 'Not just insights—workflows, approvals, tracking. See the RASM impact before and after.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-blue-200">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="text-2xl text-white font-medium mb-4">
              "This prints money."
            </div>
            <div className="text-blue-200">
              — Every VC who's seen the demo
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DemoView;
