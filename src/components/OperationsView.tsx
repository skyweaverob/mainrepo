'use client';

import { useState, useEffect } from 'react';
import { Plane, Users, Wrench, Activity, MapPin, Shield, AlertTriangle } from 'lucide-react';
import * as api from '@/lib/api';

type OperationsTab = 'fleet' | 'crew' | 'mro' | 'tailhealth' | 'stations' | 'recovery';

interface OperationsViewProps {
  dataStatus?: {
    fleet_rows: number;
    crew_rows: number;
    mro_rows: number;
  } | null;
}

export function OperationsView({ dataStatus }: OperationsViewProps) {
  const [activeTab, setActiveTab] = useState<OperationsTab>('fleet');

  const tabs = [
    { id: 'fleet' as const, label: 'Fleet', icon: Plane },
    { id: 'crew' as const, label: 'Crew', icon: Users },
    { id: 'mro' as const, label: 'MRO', icon: Wrench },
    { id: 'tailhealth' as const, label: 'Tail Health', icon: Activity },
    { id: 'stations' as const, label: 'Stations', icon: MapPin },
    { id: 'recovery' as const, label: 'Recovery', icon: Shield },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Simple tab bar */}
      <div className="border-b border-slate-200 px-4 flex gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-[#002855] text-[#002855] font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'fleet' && <FleetContent />}
        {activeTab === 'crew' && <CrewContent />}
        {activeTab === 'mro' && <MROContent />}
        {activeTab === 'tailhealth' && <TailHealthContent />}
        {activeTab === 'stations' && <StationReadinessContent />}
        {activeTab === 'recovery' && <RecoveryCockpitContent />}
      </div>
    </div>
  );
}

// ========================================
// Fleet Content
// ========================================
function FleetContent() {
  const [summary, setSummary] = useState<any>(null);
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryData, aircraftData] = await Promise.all([
          api.getFleetSummary(),
          api.getFleetList({ limit: 50 }),
        ]);
        setSummary(summaryData);
        setAircraft(aircraftData);
      } catch (error) {
        console.error('Failed to fetch fleet data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!summary) return <EmptyState message="No fleet data" />;

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Aircraft:</span> <span className="font-semibold">{summary.total_aircraft}</span></div>
        <div><span className="text-slate-500">Seats:</span> <span className="font-semibold">{summary.total_seats?.toLocaleString()}</span></div>
        <div><span className="text-slate-500">Avg Age:</span> <span className="font-semibold">{summary.avg_age?.toFixed(1)} yrs</span></div>
      </div>

      {/* Fleet breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">By Type</div>
          {Object.entries(summary.by_type || {}).map(([type, count]) => (
            <div key={type} className="flex justify-between py-1 text-sm">
              <span>{type}</span>
              <span className="font-semibold">{count as number}</span>
            </div>
          ))}
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">By Base</div>
          {Object.entries(summary.by_base || {}).map(([base, count]) => (
            <div key={base} className="flex justify-between py-1 text-sm">
              <span>{base}</span>
              <span className="font-semibold">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Aircraft table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase">
            <th className="py-2">Reg</th>
            <th>Type</th>
            <th>Base</th>
            <th>Status</th>
            <th className="text-right">Age</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {aircraft.slice(0, 12).map((ac) => (
            <tr key={ac.aircraft_registration}>
              <td className="py-2 font-mono font-medium text-[#002855]">{ac.aircraft_registration}</td>
              <td>{ac.aircraft_type}</td>
              <td>{ac.home_base}</td>
              <td><StatusBadge status={ac.current_status} /></td>
              <td className="text-right">{ac.aircraft_age_years?.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========================================
// Crew Content
// ========================================
function CrewContent() {
  const [summary, setSummary] = useState<any>(null);
  const [trainingDue, setTrainingDue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryData, trainingData] = await Promise.all([
          api.getCrewSummary(),
          api.getTrainingDue(60),
        ]);
        setSummary(summaryData);
        setTrainingDue(trainingData);
      } catch (error) {
        console.error('Failed to fetch crew data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!summary) return <EmptyState message="No crew data" />;

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Total:</span> <span className="font-semibold">{summary.total_crew}</span></div>
        <div><span className="text-slate-500">Training Due:</span> <span className="font-semibold text-amber-600">{trainingDue.length}</span></div>
      </div>

      {/* Crew breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">By Position</div>
          {Object.entries(summary.by_type || {}).map(([type, count]) => (
            <div key={type} className="flex justify-between py-1 text-sm">
              <span>{type.replace(/_/g, ' ')}</span>
              <span className="font-semibold">{count as number}</span>
            </div>
          ))}
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">By Base</div>
          {Object.entries(summary.by_base || {}).map(([base, count]) => (
            <div key={base} className="flex justify-between py-1 text-sm">
              <span>{base}</span>
              <span className="font-semibold">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Training due list */}
      {trainingDue.length > 0 && (
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">Training Due (60 days)</div>
          {trainingDue.slice(0, 8).map((item) => (
            <div key={item.employee_id} className="flex justify-between py-1 text-sm">
              <span className="font-mono">{item.employee_id}</span>
              <span className="text-amber-600">{new Date(item.recurrent_training_due).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========================================
// MRO Content
// ========================================
function MROContent() {
  const [summary, setSummary] = useState<any>(null);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryData, scheduledData] = await Promise.all([
          api.getMROSummary(),
          api.getScheduledMaintenance(90),
        ]);
        setSummary(summaryData);
        setScheduled(scheduledData);
      } catch (error) {
        console.error('Failed to fetch MRO data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!summary) return <EmptyState message="No MRO data" />;

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Work Orders:</span> <span className="font-semibold">{summary.total_work_orders}</span></div>
        <div><span className="text-slate-500">Cost:</span> <span className="font-semibold">${(summary.total_cost / 1000000).toFixed(1)}M</span></div>
        <div><span className="text-slate-500">Avg Downtime:</span> <span className="font-semibold">{summary.avg_downtime?.toFixed(1)} days</span></div>
      </div>

      {/* MRO breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">By Type</div>
          {Object.entries(summary.by_type || {}).map(([type, count]) => (
            <div key={type} className="flex justify-between py-1 text-sm">
              <span>{type.replace(/_/g, ' ')}</span>
              <span className="font-semibold">{count as number}</span>
            </div>
          ))}
        </div>
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">By Status</div>
          {Object.entries(summary.by_status || {}).map(([status, count]) => (
            <div key={status} className="flex justify-between py-1 text-sm">
              <StatusBadge status={status} />
              <span className="font-semibold">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled maintenance */}
      {scheduled.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500 uppercase">
              <th className="py-2">Aircraft</th>
              <th>Type</th>
              <th>Priority</th>
              <th className="text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scheduled.slice(0, 10).map((wo: any) => (
              <tr key={wo.work_order_id}>
                <td className="py-2 font-mono">{wo.aircraft_registration}</td>
                <td>{wo.maintenance_type?.replace(/_/g, ' ')}</td>
                <td><PriorityBadge priority={wo.priority} /></td>
                <td className="text-right">{wo.scheduled_start_date ? new Date(wo.scheduled_start_date).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ========================================
// Station Readiness Content
// ========================================
function StationReadinessContent() {
  const stations = [
    { code: 'ATL', crewReady: 94, gatesAvail: 88, groundSupport: 92, overall: 91 },
    { code: 'MCO', crewReady: 97, gatesAvail: 95, groundSupport: 96, overall: 96 },
    { code: 'FLL', crewReady: 89, gatesAvail: 85, groundSupport: 88, overall: 87 },
    { code: 'DTW', crewReady: 92, gatesAvail: 90, groundSupport: 94, overall: 92 },
    { code: 'LAS', crewReady: 96, gatesAvail: 91, groundSupport: 93, overall: 93 },
    { code: 'DEN', crewReady: 88, gatesAvail: 82, groundSupport: 85, overall: 85 },
    { code: 'EWR', crewReady: 85, gatesAvail: 78, groundSupport: 81, overall: 81 },
  ].sort((a, b) => b.overall - a.overall);

  const getColor = (v: number) => v >= 90 ? 'text-emerald-600' : v >= 80 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase">
            <th className="py-2">Station</th>
            <th className="text-right">Crew</th>
            <th className="text-right">Gates</th>
            <th className="text-right">Ground</th>
            <th className="text-right">Overall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stations.map((s) => (
            <tr key={s.code}>
              <td className="py-2 font-semibold">{s.code}</td>
              <td className={`text-right ${getColor(s.crewReady)}`}>{s.crewReady}%</td>
              <td className={`text-right ${getColor(s.gatesAvail)}`}>{s.gatesAvail}%</td>
              <td className={`text-right ${getColor(s.groundSupport)}`}>{s.groundSupport}%</td>
              <td className={`text-right font-semibold ${getColor(s.overall)}`}>{s.overall}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========================================
// Recovery Cockpit Content
// ========================================
function RecoveryCockpitContent() {
  const disruption = { type: 'Weather - ATL', progress: 68 };
  const actions = [
    { action: 'Pre-cancel NK891', status: 'done', time: '14:35' },
    { action: 'Reposition N234NK from MCO', status: 'done', time: '14:42' },
    { action: 'Call 3 reserve crews', status: 'active', time: '15:10' },
    { action: 'Rebook 340 PAX via DFW', status: 'active', time: '15:25' },
    { action: 'Swap equipment NK567', status: 'pending', time: '16:00' },
  ];
  const flights = [
    { flight: 'NK234', route: 'ATL-MCO', status: 'Delayed 2h', pax: 182 },
    { flight: 'NK567', route: 'ATL-FLL', status: 'Delayed 90m', pax: 175 },
    { flight: 'NK891', route: 'ATL-DEN', status: 'Cancelled', pax: 156 },
  ];

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <div className="flex-1">
          <span className="font-medium">{disruption.type}</span>
          <div className="w-32 h-1.5 bg-amber-200 rounded mt-1">
            <div className="h-full bg-emerald-500 rounded" style={{ width: `${disruption.progress}%` }} />
          </div>
        </div>
        <span className="text-sm text-amber-700">{disruption.progress}% recovered</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Actions */}
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">Recovery Actions</div>
          {actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-sm">
              <div className={`w-2 h-2 rounded-full ${a.status === 'done' ? 'bg-emerald-500' : a.status === 'active' ? 'bg-blue-500' : 'bg-slate-300'}`} />
              <span className={a.status === 'done' ? 'text-slate-400' : ''}>{a.action}</span>
              <span className="ml-auto text-xs text-slate-400">{a.time}</span>
            </div>
          ))}
        </div>

        {/* Affected flights */}
        <div className="border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 uppercase mb-2">Affected Flights</div>
          {flights.map((f) => (
            <div key={f.flight} className="flex items-center justify-between py-1 text-sm">
              <span className="font-mono">{f.flight} <span className="text-slate-400">{f.route}</span></span>
              <span className={f.status.includes('Cancel') ? 'text-red-600' : 'text-amber-600'}>{f.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-6 text-sm pt-2 border-t">
        <div><span className="text-slate-500">Flights:</span> <span className="font-semibold">12</span></div>
        <div><span className="text-slate-500">PAX:</span> <span className="font-semibold">1,840</span></div>
        <div><span className="text-slate-500">Revenue Loss:</span> <span className="font-semibold text-red-600">$340K</span></div>
        <div><span className="text-slate-500">ETA:</span> <span className="font-semibold">18:15</span></div>
      </div>
    </div>
  );
}

// ========================================
// Tail Health Content
// ========================================
function TailHealthContent() {
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const aircraftData = await api.getFleetList({ limit: 100 });
        const enrichedData = aircraftData.map((ac: any) => ({
          ...ac,
          rasm: 7.5 + Math.random() * 4,
          profitScore: 60 + Math.random() * 35,
          utilization: 8 + Math.random() * 6,
        }));
        enrichedData.sort((a: any, b: any) => b.profitScore - a.profitScore);
        setAircraft(enrichedData);
      } catch (error) {
        console.error('Failed to fetch tail health data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (aircraft.length === 0) return <EmptyState message="No data" />;

  const avgRasm = aircraft.reduce((sum, ac) => sum + ac.rasm, 0) / aircraft.length;
  const getColor = (v: number) => v >= 85 ? 'text-emerald-600' : v >= 70 ? 'text-amber-600' : 'text-red-600';
  const getRasmBg = (r: number) => r >= 10 ? 'bg-emerald-500' : r >= 9 ? 'bg-emerald-400' : r >= 8 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Avg RASM:</span> <span className="font-semibold">{avgRasm.toFixed(2)}¢</span></div>
        <div><span className="text-slate-500">Top Performers:</span> <span className="font-semibold text-emerald-600">{aircraft.filter(a => a.profitScore >= 85).length}</span></div>
      </div>

      {/* Heatmap */}
      <div className="flex flex-wrap gap-1">
        {aircraft.slice(0, 40).map((ac) => (
          <div
            key={ac.aircraft_registration}
            className={`w-10 h-6 rounded flex items-center justify-center text-white text-xs font-mono ${getRasmBg(ac.rasm)}`}
            title={`${ac.aircraft_registration}: ${ac.rasm.toFixed(1)}¢`}
          >
            {ac.aircraft_registration?.slice(-3)}
          </div>
        ))}
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase">
            <th className="py-2">Tail</th>
            <th>Type</th>
            <th className="text-right">RASM</th>
            <th className="text-right">Profit</th>
            <th className="text-right">Util</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {aircraft.slice(0, 15).map((ac) => (
            <tr key={ac.aircraft_registration}>
              <td className="py-2 font-mono">{ac.aircraft_registration}</td>
              <td>{ac.aircraft_type}</td>
              <td className="text-right">{ac.rasm.toFixed(2)}¢</td>
              <td className={`text-right font-semibold ${getColor(ac.profitScore)}`}>{ac.profitScore.toFixed(0)}%</td>
              <td className="text-right">{ac.utilization.toFixed(1)}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ========================================
// Shared Components
// ========================================
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'text-emerald-600',
    MAINTENANCE: 'text-amber-600',
    GROUNDED: 'text-red-600',
    COMPLETED: 'text-emerald-600',
    IN_PROGRESS: 'text-blue-600',
    SCHEDULED: 'text-amber-600',
  };
  return <span className={`text-xs ${colors[status] || 'text-slate-500'}`}>{status?.replace(/_/g, ' ')}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    AOG: 'text-red-600 font-semibold',
    URGENT: 'text-amber-600',
    ROUTINE: 'text-slate-500',
    SCHEDULED: 'text-blue-600',
  };
  return <span className={`text-xs ${colors[priority] || 'text-slate-500'}`}>{priority}</span>;
}

function LoadingState() {
  return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-2 border-[#002855] border-t-transparent" /></div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex items-center justify-center h-32 text-slate-400">{message}</div>;
}

export default OperationsView;
