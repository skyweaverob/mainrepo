'use client';

import { useState, useEffect } from 'react';
import { Plane, Users, Wrench, AlertTriangle, Clock, MapPin, GraduationCap, DollarSign } from 'lucide-react';
import * as api from '@/lib/api';

type OperationsTab = 'fleet' | 'crew' | 'mro';

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
    { id: 'fleet' as const, label: 'Fleet', icon: Plane, count: dataStatus?.fleet_rows || 0 },
    { id: 'crew' as const, label: 'Crew', icon: Users, count: dataStatus?.crew_rows || 0 },
    { id: 'mro' as const, label: 'MRO', icon: Wrench, count: dataStatus?.mro_rows || 0 },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {/* Header */}
      <div className="bg-[#002855] px-6 py-4">
        <h1 className="text-xl font-bold text-white">Operations Overview</h1>
        <p className="text-blue-200 text-sm">Fleet • Crew • MRO</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#002855] text-[#002855] bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{tab.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-[#002855] text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'fleet' && <FleetContent />}
        {activeTab === 'crew' && <CrewContent />}
        {activeTab === 'mro' && <MROContent />}
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
  const [maintenanceDue, setMaintenanceDue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryData, aircraftData, maintenanceData] = await Promise.all([
          api.getFleetSummary(),
          api.getFleetList({ limit: 50 }),
          api.getMaintenanceDue(60),
        ]);
        setSummary(summaryData);
        setAircraft(aircraftData);
        setMaintenanceDue(maintenanceData);
      } catch (error) {
        console.error('Failed to fetch fleet data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;
  if (!summary) return <EmptyState message="No fleet data available" />;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Total Aircraft" value={summary.total_aircraft} icon={Plane} />
        <MetricCard title="Total Seats" value={summary.total_seats?.toLocaleString() || '-'} icon={Users} />
        <MetricCard title="Average Age" value={`${summary.avg_age?.toFixed(1) || '-'} yrs`} icon={Clock} />
        <MetricCard
          title="Maintenance Due"
          value={maintenanceDue.length}
          icon={AlertTriangle}
          alert={maintenanceDue.length > 5}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Fleet by Type */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Fleet by Aircraft Type</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_type || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">{type}</span>
                <span className="text-lg font-bold text-[#002855]">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet by Base */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Fleet by Base</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_base || {}).map(([base, count]) => (
              <div key={base} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-700">{base}</span>
                </div>
                <span className="text-lg font-bold text-[#002855]">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aircraft Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Aircraft List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Registration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Base</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Age</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Seats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aircraft.slice(0, 15).map((ac) => (
                <tr key={ac.aircraft_registration} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-[#002855]">{ac.aircraft_registration}</td>
                  <td className="px-4 py-3 text-slate-600">{ac.aircraft_type}</td>
                  <td className="px-4 py-3 text-slate-600">{ac.home_base}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ac.current_status} />
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{ac.aircraft_age_years?.toFixed(1)} yrs</td>
                  <td className="px-4 py-3 text-right text-slate-600">{ac.seat_config}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  if (!summary) return <EmptyState message="No crew data available" />;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Total Crew" value={summary.total_crew} icon={Users} />
        <MetricCard title="Avg Total Hours" value={summary.avg_total_hours ? Math.round(summary.avg_total_hours).toLocaleString() : '-'} icon={Clock} />
        <MetricCard title="Avg 30-Day Hours" value={summary.avg_30_day_hours ? `${summary.avg_30_day_hours.toFixed(0)}` : '-'} icon={Clock} />
        <MetricCard
          title="Training Due"
          value={trainingDue.length}
          icon={GraduationCap}
          alert={trainingDue.length > 20}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Crew by Type */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Crew by Position</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_type || {}).map(([type, count]) => {
              const label = type === 'CAPTAIN' ? 'Captains' : type === 'FIRST_OFFICER' ? 'First Officers' : type === 'FLIGHT_ATTENDANT' ? 'Flight Attendants' : type;
              return (
                <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="text-lg font-bold text-[#002855]">{count as number}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Crew by Base */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Crew by Base</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_base || {}).map(([base, count]) => (
              <div key={base} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-700">{base}</span>
                </div>
                <span className="text-lg font-bold text-[#002855]">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Training Due */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Training Due (60 days)</h3>
        </div>
        {trainingDue.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No training due</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {trainingDue.slice(0, 10).map((item) => (
              <div key={item.employee_id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="font-mono font-semibold text-[#002855]">{item.employee_id}</span>
                  <span className="text-sm text-slate-500 ml-2">{item.crew_type?.replace('_', ' ')}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-amber-600 font-medium">
                    {new Date(item.recurrent_training_due).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-slate-400 block">{item.home_base}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  if (!summary) return <EmptyState message="No MRO data available" />;

  const urgentCount = scheduled.filter((s: any) => s.priority === 'AOG' || s.priority === 'URGENT').length;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Work Orders" value={summary.total_work_orders} icon={Wrench} />
        <MetricCard title="Total Cost" value={summary.total_cost ? `$${(summary.total_cost / 1000000).toFixed(1)}M` : '-'} icon={DollarSign} />
        <MetricCard title="Avg Downtime" value={`${summary.avg_downtime?.toFixed(1) || '-'} days`} icon={Clock} />
        <MetricCard
          title="Urgent/AOG"
          value={urgentCount}
          icon={AlertTriangle}
          alert={urgentCount > 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Work Orders by Type */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Work Orders by Type</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_type || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">{type.replace('_', ' ')}</span>
                <span className="text-lg font-bold text-[#002855]">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Work Orders by Status */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Work Order Status</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_status || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <StatusBadge status={status} />
                <span className="text-lg font-bold text-[#002855]">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduled Maintenance */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Upcoming Maintenance (90 days)</h3>
        </div>
        {scheduled.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No scheduled maintenance</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Aircraft</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduled.slice(0, 15).map((wo: any) => (
                  <tr key={wo.work_order_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#002855]">{wo.aircraft_registration}</td>
                    <td className="px-4 py-3 text-slate-600">{wo.maintenance_type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={wo.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{wo.mro_provider?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {wo.scheduled_start_date ? new Date(wo.scheduled_start_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// Shared Components
// ========================================

function MetricCard({ title, value, icon: Icon, alert = false }: {
  title: string;
  value: string | number;
  icon: any;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          alert ? 'bg-amber-100' : 'bg-slate-100'
        }`}>
          <Icon className={`w-5 h-5 ${alert ? 'text-amber-600' : 'text-[#002855]'}`} />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold ${alert ? 'text-amber-600' : 'text-slate-800'}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    MAINTENANCE: 'bg-amber-100 text-amber-700',
    GROUNDED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    SCHEDULED: 'bg-amber-100 text-amber-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    AOG: 'bg-red-100 text-red-700',
    URGENT: 'bg-amber-100 text-amber-700',
    ROUTINE: 'bg-slate-100 text-slate-600',
    SCHEDULED: 'bg-blue-100 text-blue-700',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#002855] border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

export default OperationsView;
