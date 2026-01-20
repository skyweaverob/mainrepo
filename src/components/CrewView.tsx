'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Users, Clock, AlertTriangle, GraduationCap } from 'lucide-react';
import { MetricCard } from './MetricCard';
import * as api from '@/lib/api';

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899'];

export function CrewView() {
  const [summary, setSummary] = useState<any>(null);
  const [trainingDue, setTrainingDue] = useState<any[]>([]);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [baseData, setBaseData] = useState<any>(null);
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

  useEffect(() => {
    async function fetchBaseData() {
      if (selectedBase) {
        try {
          const data = await api.getCrewByBase(selectedBase);
          setBaseData(data);
        } catch (error) {
          console.error('Failed to fetch base data:', error);
        }
      } else {
        setBaseData(null);
      }
    }

    fetchBaseData();
  }, [selectedBase]);

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
        <p className="text-slate-400">No crew data available</p>
      </div>
    );
  }

  // Prepare chart data
  const typeData = Object.entries(summary.by_type || {}).map(([name, count]) => ({
    name: name === 'CAPTAIN' ? 'Captains' : name === 'FIRST_OFFICER' ? 'First Officers' : name === 'FLIGHT_ATTENDANT' ? 'Flight Attendants' : name,
    value: count as number,
  }));

  const baseChartData = Object.entries(summary.by_base || {}).map(([name, count]) => ({
    name,
    count: count as number,
  }));

  const statusData = Object.entries(summary.by_status || {}).map(([name, count]) => ({
    name,
    value: count as number,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold text-slate-100">Crew Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Staffing, qualifications, and training compliance
        </p>
      </div>

      {/* Metrics */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Crew"
          value={summary.total_crew}
          icon={Users}
        />
        <MetricCard
          title="Avg Total Hours"
          value={summary.avg_total_hours ? `${Math.round(summary.avg_total_hours).toLocaleString()}` : '-'}
          icon={Clock}
        />
        <MetricCard
          title="Avg 30-Day Hours"
          value={summary.avg_30_day_hours ? `${summary.avg_30_day_hours.toFixed(0)}` : '-'}
          icon={Clock}
        />
        <MetricCard
          title="Training Due"
          value={trainingDue.length}
          icon={GraduationCap}
          color={trainingDue.length > 20 ? 'orange' : 'default'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
          {/* Crew by Type */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Crew by Position</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${value}`}
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
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {typeData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-slate-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Crew by Base */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Crew by Base</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={baseChartData}>
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
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Crew Status */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Employment Status</h3>
            <div className="space-y-3">
              {statusData.map((status) => (
                <div key={status.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status.name === 'ACTIVE' ? 'bg-green-500' :
                      status.name === 'ON_LEAVE' ? 'bg-yellow-500' :
                      status.name === 'TRAINING' ? 'bg-blue-500' : 'bg-slate-500'
                    }`} />
                    <span className="text-sm text-slate-300 capitalize">
                      {status.name.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-100">{status.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Training Due */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">
              Training Due (60 days)
            </h3>
            {trainingDue.length === 0 ? (
              <p className="text-slate-500 text-sm">No training due</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {trainingDue.slice(0, 15).map((item) => (
                  <div
                    key={item.employee_id}
                    className="flex items-center justify-between p-2 bg-slate-800 rounded"
                  >
                    <div>
                      <span className="font-mono text-sm text-slate-100">
                        {item.employee_id}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        {item.crew_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-orange-400">
                        {new Date(item.recurrent_training_due).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-slate-500 block">{item.home_base}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Base Detail */}
        <div className="card mt-6">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Base Details</h3>
            <select
              value={selectedBase || ''}
              onChange={(e) => setSelectedBase(e.target.value || null)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300"
            >
              <option value="">Select a base</option>
              {Object.keys(summary.by_base || {}).map((base) => (
                <option key={base} value={base}>{base}</option>
              ))}
            </select>
          </div>

          {selectedBase && baseData ? (
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-slate-800 rounded">
                  <p className="text-xs text-slate-500">Total Crew</p>
                  <p className="text-xl font-semibold text-slate-100">{baseData.total}</p>
                </div>
                {Object.entries(baseData.by_type || {}).map(([type, count]) => (
                  <div key={type} className="p-3 bg-slate-800 rounded">
                    <p className="text-xs text-slate-500">
                      {type === 'CAPTAIN' ? 'Captains' : type === 'FIRST_OFFICER' ? 'First Officers' : 'Flight Attendants'}
                    </p>
                    <p className="text-xl font-semibold text-slate-100">{count as number}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Position</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Total Hours</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">30-Day Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(baseData.crew || []).slice(0, 10).map((crew: any) => (
                      <tr key={crew.employee_id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-2 font-mono text-slate-300">{crew.employee_id}</td>
                        <td className="px-4 py-2 text-slate-100">
                          {crew.first_name} {crew.last_name}
                        </td>
                        <td className="px-4 py-2 text-slate-400">
                          {crew.crew_type?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-300">
                          {crew.total_flight_hours?.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-300">
                          {crew.hours_last_30_days}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              Select a base to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
