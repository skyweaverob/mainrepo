'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Plane, AlertTriangle, Wrench, MapPin } from 'lucide-react';
import { MetricCard } from './MetricCard';
import * as api from '@/lib/api';

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];

// Map ICAO aircraft type codes to common marketing names
const AIRCRAFT_TYPE_NAMES: Record<string, string> = {
  'A20N': 'A320neo',
  'A21N': 'A321neo',
  'A320': 'A320ceo',
  'A321': 'A321ceo',
  'A319': 'A319',
  'A321X': 'A321XLR',
  'B737': 'B737-800',
  'B738': 'B737-800',
  'B38M': 'B737 MAX 8',
  'B39M': 'B737 MAX 9',
};

// Get display name for aircraft type
const getAircraftDisplayName = (icaoCode: string): string => {
  return AIRCRAFT_TYPE_NAMES[icaoCode] || icaoCode;
};

export function FleetView() {
  const [summary, setSummary] = useState<any>(null);
  const [aircraft, setAircraft] = useState<any[]>([]);
  const [maintenanceDue, setMaintenanceDue] = useState<any[]>([]);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
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

  useEffect(() => {
    async function fetchFilteredAircraft() {
      if (selectedBase) {
        const data = await api.getFleetList({ base: selectedBase, limit: 100 });
        setAircraft(data);
      } else {
        const data = await api.getFleetList({ limit: 50 });
        setAircraft(data);
      }
    }

    if (!loading) {
      fetchFilteredAircraft();
    }
  }, [selectedBase, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400">No fleet data available</p>
      </div>
    );
  }

  // Prepare chart data with human-readable aircraft type names
  const typeData = Object.entries(summary.by_type || {}).map(([name, count]) => ({
    name: getAircraftDisplayName(name),
    value: count as number,
  }));

  const baseData = Object.entries(summary.by_base || {}).map(([name, count]) => ({
    name,
    count: count as number,
  }));

  const statusData = Object.entries(summary.by_status || {}).map(([name, count]) => ({
    name: name.replace('_', ' '),
    count: count as number,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold text-slate-100">Fleet Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Aircraft status, maintenance, and utilization
        </p>
      </div>

      {/* Metrics */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Aircraft"
          value={summary.total_aircraft}
          icon={Plane}
        />
        <MetricCard
          title="Total Seats"
          value={summary.total_seats?.toLocaleString() || '-'}
          icon={Plane}
        />
        <MetricCard
          title="Average Age"
          value={`${summary.avg_age?.toFixed(1) || '-'} yrs`}
          icon={Plane}
        />
        <MetricCard
          title="Maintenance Due"
          value={maintenanceDue.length}
          icon={Wrench}
          color={maintenanceDue.length > 5 ? 'orange' : 'default'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
          {/* Fleet by Type */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Fleet by Aircraft Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Fleet by Base */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Fleet by Base</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={baseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fleet Status */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Fleet Status</h3>
            <div className="space-y-3">
              {statusData.map((status) => (
                <div key={status.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status.name === 'ACTIVE' ? 'bg-green-500' :
                      status.name === 'MAINTENANCE' ? 'bg-orange-500' :
                      status.name === 'GROUNDED' ? 'bg-red-500' : 'bg-slate-500'
                    }`} />
                    <span className="text-sm text-slate-300 capitalize">{status.name}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-100">{status.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Due */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">
              Maintenance Due (60 days)
            </h3>
            {maintenanceDue.length === 0 ? (
              <p className="text-slate-500 text-sm">No maintenance due</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {maintenanceDue.map((item) => (
                  <div
                    key={item.aircraft_registration}
                    className="flex items-center justify-between p-2 bg-slate-800 rounded"
                  >
                    <div>
                      <span className="font-mono text-sm text-slate-100">
                        {item.aircraft_registration}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {getAircraftDisplayName(item.aircraft_type)}
                      </span>
                    </div>
                    <span className="text-xs text-orange-400">
                      {new Date(item.next_c_check_due).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Aircraft List */}
        <div className="card mt-6">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Aircraft List</h3>
            <select
              value={selectedBase || ''}
              onChange={(e) => setSelectedBase(e.target.value || null)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300"
            >
              <option value="">All Bases</option>
              {Object.keys(summary.by_base || {}).map((base) => (
                <option key={base} value={base}>{base}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Registration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Base</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Age</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Seats</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Next C-Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {aircraft.slice(0, 20).map((ac) => (
                  <tr key={ac.aircraft_registration} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-slate-100">{ac.aircraft_registration}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {getAircraftDisplayName(ac.aircraft_type) || <span className="text-slate-500">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {ac.home_base || <span className="text-slate-500">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        ac.current_status === 'ACTIVE' ? 'bg-green-900/50 text-green-300' :
                        ac.current_status === 'MAINTENANCE' ? 'bg-orange-900/50 text-orange-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {ac.current_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {ac.aircraft_age_years?.toFixed(1)} yrs
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{ac.seat_config}</td>
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">
                      {ac.next_c_check_due ? new Date(ac.next_c_check_due).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
