'use client';

import { useState, useEffect } from 'react';
import { Plane, Users, Wrench, AlertTriangle, Clock, MapPin, GraduationCap, DollarSign, Activity, TrendingUp, Shield } from 'lucide-react';
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
    { id: 'fleet' as const, label: 'Fleet', icon: Plane, count: dataStatus?.fleet_rows || 0 },
    { id: 'crew' as const, label: 'Crew', icon: Users, count: dataStatus?.crew_rows || 0 },
    { id: 'mro' as const, label: 'MRO', icon: Wrench, count: dataStatus?.mro_rows || 0 },
    { id: 'tailhealth' as const, label: 'Tail Health', icon: Activity, count: null },
    { id: 'stations' as const, label: 'Stations', icon: MapPin, count: null },
    { id: 'recovery' as const, label: 'Recovery', icon: Shield, count: null },
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
                {tab.count !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-[#002855] text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
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
// Station Readiness Content
// ========================================
function StationReadinessContent() {
  // Demo station data - in production would come from API
  const stations = [
    { code: 'ATL', name: 'Atlanta', crewReady: 94, gatesAvail: 88, groundSupport: 92, overall: 91 },
    { code: 'MCO', name: 'Orlando', crewReady: 97, gatesAvail: 95, groundSupport: 96, overall: 96 },
    { code: 'FLL', name: 'Fort Lauderdale', crewReady: 89, gatesAvail: 85, groundSupport: 88, overall: 87 },
    { code: 'DTW', name: 'Detroit', crewReady: 92, gatesAvail: 90, groundSupport: 94, overall: 92 },
    { code: 'LAS', name: 'Las Vegas', crewReady: 96, gatesAvail: 91, groundSupport: 93, overall: 93 },
    { code: 'DEN', name: 'Denver', crewReady: 88, gatesAvail: 82, groundSupport: 85, overall: 85 },
    { code: 'EWR', name: 'Newark', crewReady: 85, gatesAvail: 78, groundSupport: 81, overall: 81 },
    { code: 'ORD', name: 'Chicago', crewReady: 91, gatesAvail: 87, groundSupport: 89, overall: 89 },
    { code: 'DFW', name: 'Dallas', crewReady: 93, gatesAvail: 89, groundSupport: 91, overall: 91 },
    { code: 'LAX', name: 'Los Angeles', crewReady: 87, gatesAvail: 84, groundSupport: 86, overall: 86 },
  ].sort((a, b) => b.overall - a.overall);

  const avgReadiness = stations.reduce((sum, s) => sum + s.overall, 0) / stations.length;
  const greenStations = stations.filter(s => s.overall >= 90).length;
  const yellowStations = stations.filter(s => s.overall >= 80 && s.overall < 90).length;
  const redStations = stations.filter(s => s.overall < 80).length;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50';
    if (score >= 80) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getBarColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Avg Readiness" value={`${avgReadiness.toFixed(0)}%`} icon={Activity} />
        <MetricCard title="Green Stations" value={greenStations} icon={TrendingUp} />
        <MetricCard title="Yellow Stations" value={yellowStations} icon={Clock} />
        <MetricCard title="Red Stations" value={redStations} icon={AlertTriangle} alert={redStations > 0} />
      </div>

      {/* Station Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((station) => (
          <div key={station.code} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-lg font-bold text-[#002855]">{station.code}</span>
                <span className="text-sm text-slate-500 ml-2">{station.name}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(station.overall)}`}>
                {station.overall}%
              </span>
            </div>
            <div className="space-y-2">
              <ReadinessBar label="Crew" value={station.crewReady} />
              <ReadinessBar label="Gates" value={station.gatesAvail} />
              <ReadinessBar label="Ground" value={station.groundSupport} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessBar({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-12">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-8 text-right">{value}%</span>
    </div>
  );
}

// ========================================
// Recovery Cockpit Content
// ========================================
function RecoveryCockpitContent() {
  // Demo active disruption data
  const activeDisruption = {
    type: 'Weather - Thunderstorms',
    airport: 'ATL',
    started: '14:30',
    duration: '3h 45m',
    status: 'RECOVERING',
    progress: 68,
  };

  const recoveryActions = [
    { id: 1, action: 'Pre-cancel NK891 ATL-DEN', status: 'completed', impact: '+45 min recovery', time: '14:35' },
    { id: 2, action: 'Reposition N234NK from MCO', status: 'completed', impact: '+2 flights saved', time: '14:42' },
    { id: 3, action: 'Call 3 reserve crews ATL', status: 'in_progress', impact: '+6 flights covered', time: '15:10' },
    { id: 4, action: 'Rebook 340 PAX via DFW', status: 'in_progress', impact: '-$12K rebooking cost', time: '15:25' },
    { id: 5, action: 'Swap equipment NK567', status: 'pending', impact: '+180 seats', time: '16:00' },
  ];

  const affectedFlights = [
    { flight: 'NK234', route: 'ATL-MCO', status: 'Delayed 2h', pax: 182 },
    { flight: 'NK567', route: 'ATL-FLL', status: 'Delayed 90m', pax: 175 },
    { flight: 'NK891', route: 'ATL-DEN', status: 'Cancelled', pax: 156 },
    { flight: 'NK123', route: 'ATL-LAS', status: 'On Time', pax: 189 },
  ];

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-emerald-500';
    if (status === 'in_progress') return 'bg-blue-500';
    return 'bg-slate-300';
  };

  const getFlightStatusColor = (status: string) => {
    if (status.includes('Cancelled')) return 'text-red-600 bg-red-50';
    if (status.includes('Delayed')) return 'text-amber-600 bg-amber-50';
    return 'text-emerald-600 bg-emerald-50';
  };

  return (
    <div className="space-y-6">
      {/* Active Disruption Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-amber-800">{activeDisruption.type}</h2>
              <p className="text-sm text-amber-700">
                {activeDisruption.airport} • Started {activeDisruption.started} • Duration {activeDisruption.duration}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {activeDisruption.status}
            </span>
            <div className="mt-2 w-32">
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activeDisruption.progress}%` }} />
              </div>
              <span className="text-xs text-amber-600">{activeDisruption.progress}% recovered</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recovery Actions Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Recovery Actions</h3>
          </div>
          <div className="p-4 space-y-4">
            {recoveryActions.map((item, idx) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                  {idx < recoveryActions.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{item.action}</span>
                    <span className="text-xs text-slate-400">{item.time}</span>
                  </div>
                  <span className="text-xs text-emerald-600">{item.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Affected Flights */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Affected Flights</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {affectedFlights.map((flight) => (
              <div key={flight.flight} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-[#002855]">{flight.flight}</span>
                  <span className="text-sm text-slate-500 ml-2">{flight.route}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{flight.pax} PAX</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getFlightStatusColor(flight.status)}`}>
                    {flight.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recovery Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Flights Affected" value="12" icon={Plane} />
        <MetricCard title="PAX Impacted" value="1,840" icon={Users} />
        <MetricCard title="Est. Revenue Loss" value="$340K" icon={DollarSign} alert />
        <MetricCard title="Recovery ETA" value="18:15" icon={Clock} />
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
        // Add computed RASM and profitability metrics per tail
        const enrichedData = aircraftData.map((ac: any, idx: number) => ({
          ...ac,
          rasm: 7.5 + Math.random() * 4, // Demo: 7.5-11.5 cents
          profitScore: 60 + Math.random() * 35, // Demo: 60-95%
          utilization: 8 + Math.random() * 6, // Demo: 8-14 hours/day
          mxEfficiency: 85 + Math.random() * 12, // Demo: 85-97%
          revenuePerDay: 25000 + Math.random() * 50000, // Demo: $25K-$75K
        }));
        // Sort by profitScore descending
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
  if (aircraft.length === 0) return <EmptyState message="No tail data available" />;

  const avgRasm = aircraft.reduce((sum, ac) => sum + ac.rasm, 0) / aircraft.length;
  const avgProfit = aircraft.reduce((sum, ac) => sum + ac.profitScore, 0) / aircraft.length;
  const topPerformers = aircraft.filter(ac => ac.profitScore >= 85).length;
  const underperformers = aircraft.filter(ac => ac.profitScore < 70).length;

  const getRasmColor = (rasm: number) => {
    if (rasm >= 10) return 'bg-emerald-500';
    if (rasm >= 9) return 'bg-emerald-400';
    if (rasm >= 8.5) return 'bg-amber-400';
    if (rasm >= 8) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getProfitColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Avg RASM" value={`${avgRasm.toFixed(2)}¢`} icon={DollarSign} />
        <MetricCard title="Avg Profit Score" value={`${avgProfit.toFixed(0)}%`} icon={TrendingUp} />
        <MetricCard title="Top Performers" value={topPerformers} icon={Activity} />
        <MetricCard title="Underperformers" value={underperformers} icon={AlertTriangle} alert={underperformers > 5} />
      </div>

      {/* RASM Heatmap */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Tail RASM Heatmap</h3>
        <div className="flex flex-wrap gap-1">
          {aircraft.slice(0, 50).map((ac) => (
            <div
              key={ac.aircraft_registration}
              className={`w-12 h-8 rounded flex items-center justify-center text-white text-xs font-mono font-bold ${getRasmColor(ac.rasm)}`}
              title={`${ac.aircraft_registration}: ${ac.rasm.toFixed(1)}¢ RASM`}
            >
              {ac.aircraft_registration?.slice(-3)}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" /> 10+¢</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded" /> 9-10¢</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded" /> 8.5-9¢</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded" /> 8-8.5¢</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded" /> &lt;8¢</div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Tail Performance Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tail</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">RASM</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Profit Score</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Utilization</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">MX Efficiency</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Rev/Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aircraft.slice(0, 20).map((ac) => (
                <tr key={ac.aircraft_registration} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-[#002855]">{ac.aircraft_registration}</td>
                  <td className="px-4 py-3 text-slate-600">{ac.aircraft_type}</td>
                  <td className="px-4 py-3 text-right font-medium">{ac.rasm.toFixed(2)}¢</td>
                  <td className={`px-4 py-3 text-right font-bold ${getProfitColor(ac.profitScore)}`}>
                    {ac.profitScore.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{ac.utilization.toFixed(1)}h/day</td>
                  <td className="px-4 py-3 text-right text-slate-600">{ac.mxEfficiency.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right text-slate-600">${(ac.revenuePerDay / 1000).toFixed(0)}K</td>
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
