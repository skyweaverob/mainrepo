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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api.getStationReadiness();
        setData(result.data);
      } catch (error) {
        console.error('Failed to fetch station readiness:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState message="No station data" />;

  const getColor = (v: number) => v >= 85 ? 'text-emerald-600' : v >= 70 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Avg:</span> <span className="font-semibold">{data.summary.avg_readiness}%</span></div>
        <div><span className="text-emerald-600">{data.summary.stations_green} green</span></div>
        <div><span className="text-amber-600">{data.summary.stations_yellow} yellow</span></div>
        <div><span className="text-red-600">{data.summary.stations_red} red</span></div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase">
            <th className="py-2">Station</th>
            <th className="text-right">Crew</th>
            <th className="text-right">Gates</th>
            <th className="text-right">Ground</th>
            <th className="text-right">Weather</th>
            <th className="text-right">Overall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.stations.slice(0, 12).map((s: any) => (
            <tr key={s.station}>
              <td className="py-2 font-semibold">{s.station}</td>
              <td className={`text-right ${getColor(s.crew_readiness)}`}>{s.crew_readiness}%</td>
              <td className={`text-right ${getColor(s.gate_availability)}`}>{s.gate_availability}%</td>
              <td className={`text-right ${getColor(s.ground_ops)}`}>{s.ground_ops}%</td>
              <td className={`text-right ${getColor(s.weather_impact)}`}>{s.weather_impact}%</td>
              <td className={`text-right font-semibold ${getColor(s.overall_score)}`}>{s.overall_score}%</td>
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api.getActiveDisruptions();
        setData(result.data);
      } catch (error) {
        console.error('Failed to fetch disruptions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!data || data.disruptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400">
        <Shield className="w-8 h-8 mb-2 text-emerald-500" />
        <span>No active disruptions</span>
      </div>
    );
  }

  const getSeverityColor = (s: string) => s === 'high' ? 'border-red-200 bg-red-50' : s === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50';
  const getSeverityIcon = (s: string) => s === 'high' ? 'text-red-600' : s === 'medium' ? 'text-amber-600' : 'text-slate-500';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Active:</span> <span className="font-semibold text-amber-600">{data.summary.active_count}</span></div>
        <div><span className="text-slate-500">Flights:</span> <span className="font-semibold">{data.summary.total_flights_affected}</span></div>
        <div><span className="text-slate-500">PAX:</span> <span className="font-semibold">{data.summary.total_pax_affected.toLocaleString()}</span></div>
        <div><span className="text-slate-500">Revenue:</span> <span className="font-semibold text-red-600">${Math.abs(data.summary.total_revenue_impact / 1000).toFixed(0)}K</span></div>
      </div>

      {/* Disruption cards */}
      {data.disruptions.map((d: any) => (
        <div key={d.id} className={`border rounded p-3 ${getSeverityColor(d.severity)}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${getSeverityIcon(d.severity)}`} />
            <span className="font-medium">{d.type} - {d.station}</span>
            <span className="ml-auto text-xs text-slate-500">{d.id}</span>
          </div>
          <p className="text-sm text-slate-600 mb-2">{d.description}</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>{d.flights_affected} flights</span>
            <span>{d.pax_affected.toLocaleString()} PAX</span>
            <span className="text-red-600">${Math.abs(d.revenue_impact / 1000).toFixed(0)}K impact</span>
          </div>
          {d.recovery_actions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Actions:</div>
              {d.recovery_actions.slice(0, 3).map((a: string, i: number) => (
                <div key={i} className="text-xs flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ========================================
// Tail Health Content
// ========================================
function TailHealthContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api.getTailHealth();
        setData(result.data);
      } catch (error) {
        console.error('Failed to fetch tail health data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!data || data.tails.length === 0) return <EmptyState message="No data" />;

  const getRasmBg = (r: number) => r >= 9 ? 'bg-emerald-500' : r >= 8.5 ? 'bg-emerald-400' : r >= 8 ? 'bg-amber-400' : 'bg-red-500';
  const getTrendIcon = (t: string) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
  const getTrendColor = (t: string) => t === 'up' ? 'text-emerald-600' : t === 'down' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex gap-6 text-sm">
        <div><span className="text-slate-500">Avg RASM:</span> <span className="font-semibold">{data.summary.avg_rasm}¢</span></div>
        <div><span className="text-slate-500">Avg Util:</span> <span className="font-semibold">{data.summary.avg_utilization}h</span></div>
        <div><span className="text-slate-500">Daily Profit:</span> <span className="font-semibold text-emerald-600">${(data.summary.total_daily_profit / 1000).toFixed(0)}K</span></div>
      </div>

      {/* Heatmap */}
      <div className="flex flex-wrap gap-1">
        {data.tails.slice(0, 30).map((t: any) => (
          <div
            key={t.tail}
            className={`w-10 h-6 rounded flex items-center justify-center text-white text-xs font-mono ${getRasmBg(t.rasm_cents)}`}
            title={`${t.tail}: ${t.rasm_cents}¢`}
          >
            {t.tail?.slice(-3)}
          </div>
        ))}
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 uppercase">
            <th className="py-2">Tail</th>
            <th>Type</th>
            <th>Base</th>
            <th className="text-right">RASM</th>
            <th className="text-right">Util</th>
            <th className="text-right">$/day</th>
            <th className="text-center">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.tails.slice(0, 15).map((t: any) => (
            <tr key={t.tail}>
              <td className="py-2 font-mono">{t.tail}</td>
              <td>{t.aircraft_type}</td>
              <td>{t.base}</td>
              <td className="text-right">{t.rasm_cents}¢</td>
              <td className="text-right">{t.utilization_hours}h</td>
              <td className="text-right font-semibold">${(t.daily_profit / 1000).toFixed(1)}K</td>
              <td className={`text-center ${getTrendColor(t.trend)}`}>{getTrendIcon(t.trend)}</td>
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
