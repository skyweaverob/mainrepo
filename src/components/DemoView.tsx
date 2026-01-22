'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, ArrowRight, Check, DollarSign, Plane } from 'lucide-react';

interface DemoViewProps {
  isLiveMode?: boolean;
  onToggleMode?: () => void;
}

const DEMO = {
  before: { rasm: 7.72, revenue: 3.1, otp: 78, loadFactor: 86 },
  after: { rasm: 8.41, revenue: 3.38, otp: 86, loadFactor: 89 },
  route: { name: 'MCO-PHL', beforeProfit: 12400, afterProfit: 27100, annualImpact: 5.4 },
  bcg: [
    { name: 'AI Ops Control', done: true },
    { name: 'Predictive MX', done: true },
    { name: 'Schedule Simulation', done: true },
    { name: 'Real-time Risk', done: true },
    { name: 'Dynamic Dispatch', done: true },
    { name: 'Recovery Cockpit', done: true },
  ],
};

export function DemoView({ isLiveMode = false }: DemoViewProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [roiInputs, setRoiInputs] = useState({ fleet: 120, revenue: 3.5 });
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const roi = {
    uplift: roiInputs.revenue * 0.02 * 1000, // 2% RASM improvement in $M
    savings: roiInputs.fleet * 0.19, // $190K per aircraft in $M
    total: 0,
  };
  roi.total = roi.uplift + roi.savings;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = sectionRefs.current.findIndex((r) => r === entry.target);
            if (i !== -1) setActiveSection(i);
          }
        });
      },
      { threshold: 0.5 }
    );
    sectionRefs.current.forEach((ref) => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (i: number) => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' });

  const sections = ['Problem', 'Solution', 'Proof', 'Example', 'ROI'];

  return (
    <div className="h-full flex">
      {/* Nav */}
      <div className="w-40 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-1">
        {sections.map((s, i) => (
          <button
            key={s}
            onClick={() => scrollTo(i)}
            className={`text-left px-3 py-2 rounded text-sm ${
              activeSection === i ? 'bg-[#002855] text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* 1. Problem */}
        <section ref={(el) => { sectionRefs.current[0] = el; }} className="min-h-screen p-12 flex flex-col justify-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">Airlines are measured on RASM</h1>
            <p className="text-xl text-slate-600 mb-8">Revenue per Available Seat Mile is the North Star metric for airline performance.</p>
            <div className="grid grid-cols-2 gap-8">
              <div className="p-6 bg-slate-100 rounded-lg">
                <div className="text-sm text-slate-500 mb-1">Industry Average</div>
                <div className="text-3xl font-bold text-slate-800">{DEMO.before.rasm}¢</div>
              </div>
              <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm text-red-600 mb-1">The Problem</div>
                <div className="text-lg text-red-800">No existing system optimizes directly for RASM</div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Solution */}
        <section ref={(el) => { sectionRefs.current[1] = el; }} className="min-h-screen p-12 flex flex-col justify-center bg-[#002855]">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-white mb-4">SkyWeave optimizes for RASM</h1>
            <p className="text-xl text-blue-200 mb-8">The first operating system that makes every decision through the lens of revenue per seat mile.</p>
            <div className="grid grid-cols-3 gap-4">
              {DEMO.bcg.map((item) => (
                <div key={item.name} className="p-4 bg-white/10 rounded-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span className="text-white text-sm">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Proof */}
        <section ref={(el) => { sectionRefs.current[2] = el; }} className="min-h-screen p-12 flex flex-col justify-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-slate-800 mb-8">The Results</h1>
            <div className="flex items-center gap-8">
              <div className="flex-1 p-8 bg-slate-100 rounded-xl">
                <div className="text-sm text-slate-500 uppercase mb-2">Before SkyWeave</div>
                <div className="text-5xl font-bold text-slate-800 mb-4">{DEMO.before.rasm}¢</div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div>OTP: {DEMO.before.otp}%</div>
                  <div>Load: {DEMO.before.loadFactor}%</div>
                  <div>Revenue: ${DEMO.before.revenue}M/day</div>
                </div>
              </div>
              <ArrowRight className="w-12 h-12 text-slate-300" />
              <div className="flex-1 p-8 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <div className="text-sm text-emerald-600 uppercase mb-2">After SkyWeave</div>
                <div className="text-5xl font-bold text-emerald-700 mb-4">{DEMO.after.rasm}¢</div>
                <div className="space-y-2 text-sm text-emerald-700">
                  <div>OTP: {DEMO.after.otp}% <span className="text-emerald-500">+{DEMO.after.otp - DEMO.before.otp}</span></div>
                  <div>Load: {DEMO.after.loadFactor}% <span className="text-emerald-500">+{DEMO.after.loadFactor - DEMO.before.loadFactor}</span></div>
                  <div>Revenue: ${DEMO.after.revenue}M/day <span className="text-emerald-500">+${(DEMO.after.revenue - DEMO.before.revenue).toFixed(2)}M</span></div>
                </div>
              </div>
            </div>
            <div className="mt-8 p-6 bg-emerald-600 rounded-xl text-white text-center">
              <div className="text-sm opacity-80">RASM Improvement</div>
              <div className="text-4xl font-bold">+{((DEMO.after.rasm - DEMO.before.rasm) / DEMO.before.rasm * 100).toFixed(1)}%</div>
            </div>
          </div>
        </section>

        {/* 4. Example */}
        <section ref={(el) => { sectionRefs.current[3] = el; }} className="min-h-screen p-12 flex flex-col justify-center bg-slate-50">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">One Decision = Millions</h1>
            <p className="text-xl text-slate-600 mb-8">Route {DEMO.route.name}: Equipment swap recommendation</p>
            <div className="flex gap-8 mb-8">
              <div className="flex-1 p-6 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-500">Before: A320</span>
                </div>
                <div className="text-3xl font-bold">${(DEMO.route.beforeProfit).toLocaleString()}/day</div>
              </div>
              <div className="flex-1 p-6 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-600">After: A321</span>
                </div>
                <div className="text-3xl font-bold text-emerald-700">${(DEMO.route.afterProfit).toLocaleString()}/day</div>
              </div>
            </div>
            <div className="p-6 bg-[#002855] rounded-xl text-white text-center">
              <div className="text-sm opacity-80">Annual Impact (This Route Alone)</div>
              <div className="text-4xl font-bold">${DEMO.route.annualImpact}M</div>
            </div>
          </div>
        </section>

        {/* 5. ROI Calculator */}
        <section ref={(el) => { sectionRefs.current[4] = el; }} className="min-h-screen p-12 flex flex-col justify-center">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-slate-800 mb-8">Your ROI</h1>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-500">Fleet Size</label>
                  <input
                    type="range" min={50} max={300} value={roiInputs.fleet}
                    onChange={(e) => setRoiInputs({ ...roiInputs, fleet: +e.target.value })}
                    className="w-full"
                  />
                  <div className="text-2xl font-bold">{roiInputs.fleet} aircraft</div>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Annual Revenue ($B)</label>
                  <input
                    type="range" min={1} max={10} step={0.5} value={roiInputs.revenue}
                    onChange={(e) => setRoiInputs({ ...roiInputs, revenue: +e.target.value })}
                    className="w-full"
                  />
                  <div className="text-2xl font-bold">${roiInputs.revenue}B</div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-100 rounded-lg">
                  <div className="text-sm text-slate-500">Revenue Uplift (2% RASM)</div>
                  <div className="text-2xl font-bold text-emerald-600">+${roi.uplift.toFixed(0)}M</div>
                </div>
                <div className="p-4 bg-slate-100 rounded-lg">
                  <div className="text-sm text-slate-500">Cost Savings</div>
                  <div className="text-2xl font-bold text-emerald-600">+${roi.savings.toFixed(1)}M</div>
                </div>
                <div className="p-4 bg-emerald-600 rounded-lg text-white">
                  <div className="text-sm opacity-80">Total Annual Impact</div>
                  <div className="text-3xl font-bold">${roi.total.toFixed(0)}M</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DemoView;
