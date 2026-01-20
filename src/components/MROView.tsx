'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Wrench, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { MetricCard } from './MetricCard';
import * as api from '@/lib/api';

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#22c55e',
  IN_PROGRESS: '#3b82f6',
  SCHEDULED: '#f97316',
  CANCELLED: '#ef4444',
  DEFERRED: '#8b5cf6',
};

export function MROView() {
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
        <p className="text-slate-400">No MRO data available</p>
      </div>
    );
  }

  // Prepare chart data
  const typeData = Object.entries(summary.by_type || {}).map(([name, count]) => ({
    name: name.replace('_', ' '),
    value: count as number,
  }));

  const statusData = Object.entries(summary.by_status || {}).map(([name, count]) => ({
    name,
    value: count as number,
    color: STATUS_COLORS[name] || '#6b7280',
  }));

  const providerData = Object.entries(summary.by_provider || {}).map(([name, count]) => ({
    name: name.replace('_', ' '),
    count: count as number,
  }));

  // Count upcoming by urgency
  const urgentCount = scheduled.filter((s: any) => s.priority === 'AOG' || s.priority === 'URGENT').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold text-slate-100">MRO Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Maintenance scheduling, costs, and compliance
        </p>
      </div>

      {/* Metrics */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Work Orders"
          value={summary.total_work_orders}
          icon={Wrench}
        />
        <MetricCard
          title="Total Cost"
          value={summary.total_cost ? `$${(summary.total_cost / 1000000).toFixed(1)}M` : '-'}
          icon={DollarSign}
        />
        <MetricCard
          title="Avg Downtime"
          value={`${summary.avg_downtime?.toFixed(1) || '-'} days`}
          icon={Clock}
        />
        <MetricCard
          title="Urgent/AOG"
          value={urgentCount}
          icon={AlertTriangle}
          color={urgentCount > 5 ? 'red' : urgentCount > 0 ? 'orange' : 'default'}
        />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
          {/* Work Orders by Type */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Work Orders by Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
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
            <div className="flex flex-wrap justify-center gap-3 mt-4">
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

          {/* Work Orders by Status */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Work Order Status</h3>
            <div className="space-y-3">
              {statusData.map((status) => {
                const percentage = (status.value / summary.total_work_orders) * 100;
                return (
                  <div key={status.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{status.name}</span>
                      <span className="text-sm font-medium text-slate-100">{status.value}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: status.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Orders by Provider */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Work by Provider</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={providerData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming Maintenance */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">
              Upcoming Maintenance (90 days)
            </h3>
            {scheduled.length === 0 ? (
              <p className="text-slate-500 text-sm">No scheduled maintenance</p>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {scheduled.slice(0, 15).map((item: any) => (
                  <div
                    key={item.work_order_id}
                    className="flex items-start justify-between p-2 bg-slate-800 rounded"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-slate-100">
                          {item.aircraft_registration}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          item.priority === 'AOG' ? 'bg-red-900/50 text-red-300' :
                          item.priority === 'URGENT' ? 'bg-orange-900/50 text-orange-300' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                        {item.maintenance_type?.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">
                        {item.scheduled_start_date
                          ? new Date(item.scheduled_start_date).toLocaleDateString()
                          : '-'}
                      </span>
                      <p className="text-xs text-slate-600">{item.mro_location}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Work Orders Table */}
        <div className="card mt-6">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-300">Recent Work Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Work Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Aircraft</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Provider</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Downtime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {scheduled.slice(0, 20).map((wo: any) => (
                  <tr key={wo.work_order_id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-slate-300 text-xs">{wo.work_order_id}</td>
                    <td className="px-4 py-3 font-mono text-slate-100">{wo.aircraft_registration}</td>
                    <td className="px-4 py-3 text-slate-300">{wo.maintenance_type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        wo.status === 'COMPLETED' ? 'bg-green-900/50 text-green-300' :
                        wo.status === 'IN_PROGRESS' ? 'bg-blue-900/50 text-blue-300' :
                        wo.status === 'SCHEDULED' ? 'bg-orange-900/50 text-orange-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{wo.mro_provider?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {wo.total_cost_usd ? `$${wo.total_cost_usd.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {wo.downtime_days || 0} days
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
