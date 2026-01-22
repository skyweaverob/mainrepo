'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Info,
  Zap,
} from 'lucide-react';
import * as api from '@/lib/api';
import { useLiveDataStore } from '@/lib/liveDataStore';

/**
 * DataView - Data Platform Health Dashboard
 *
 * Per spec (Section 19.2):
 * Provides transparency into data health, freshness, quality, and platform status.
 */

interface DomainHealthScore {
  domain: string;
  score: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  lastRefresh: Date | null;
  recordCount: number;
  completeness: number;
  issues: DataHealthIssue[];
}

interface DataHealthIssue {
  id: string;
  domain: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  type: string;
  description: string;
  affectedRecords?: number;
  detectedAt: Date;
  acknowledged: boolean;
}

interface DataAnomaly {
  id: string;
  domain: string;
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviationPercent: number;
  detectedAt: Date;
  explanation?: string;
}

// Metric definitions for the registry
const METRIC_REGISTRY = [
  {
    id: 'rasm',
    name: 'RASM',
    description: 'Revenue per Available Seat Mile',
    formula: 'Total Revenue / ASMs',
    unit: '¢',
    minValid: 5,
    maxValid: 25,
    refreshFrequency: 'real-time',
  },
  {
    id: 'market_share',
    name: 'Market Share',
    description: 'Airline share of O&D market passengers',
    formula: 'Airline Passengers / Total Market Passengers × 100',
    unit: '%',
    minValid: 0,
    maxValid: 100,
    refreshFrequency: 'daily',
  },
  {
    id: 'load_factor',
    name: 'Load Factor',
    description: 'Capacity utilization',
    formula: 'RPMs / ASMs × 100',
    unit: '%',
    minValid: 0,
    maxValid: 100,
    refreshFrequency: 'real-time',
  },
  {
    id: 'otp',
    name: 'On-Time Performance',
    description: 'Flights departing within 15 minutes of schedule',
    formula: 'D-15 On-time Flights / Total Flights × 100',
    unit: '%',
    minValid: 0,
    maxValid: 100,
    refreshFrequency: 'real-time',
  },
  {
    id: 'completion_factor',
    name: 'Completion Factor',
    description: 'Operated vs scheduled flights',
    formula: 'Operated Flights / Scheduled Flights × 100',
    unit: '%',
    minValid: 0,
    maxValid: 100,
    refreshFrequency: 'real-time',
  },
  {
    id: 'yield',
    name: 'Yield',
    description: 'Revenue per passenger mile',
    formula: 'Passenger Revenue / RPMs',
    unit: '¢',
    minValid: 5,
    maxValid: 50,
    refreshFrequency: 'daily',
  },
];

export function DataView() {
  const { feeds, isConnected, lastGlobalUpdate } = useLiveDataStore();
  const [dataStatus, setDataStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'health' | 'metrics' | 'issues'>('health');

  // Mock domain health data
  const [domainHealth, setDomainHealth] = useState<DomainHealthScore[]>([
    {
      domain: 'Flights',
      score: 98,
      status: 'HEALTHY',
      lastRefresh: new Date(),
      recordCount: 18043,
      completeness: 99.9,
      issues: [],
    },
    {
      domain: 'Aircraft',
      score: 95,
      status: 'HEALTHY',
      lastRefresh: new Date(Date.now() - 5 * 60 * 1000),
      recordCount: 180,
      completeness: 100,
      issues: [],
    },
    {
      domain: 'Crew',
      score: 91,
      status: 'HEALTHY',
      lastRefresh: new Date(Date.now() - 15 * 60 * 1000),
      recordCount: 1200,
      completeness: 98.2,
      issues: [
        {
          id: 'crew-1',
          domain: 'Crew',
          severity: 'WARNING',
          type: 'COMPLETENESS',
          description: 'Crew roster missing 3 new hires',
          affectedRecords: 3,
          detectedAt: new Date(),
          acknowledged: false,
        },
      ],
    },
    {
      domain: 'Maintenance',
      score: 87,
      status: 'DEGRADED',
      lastRefresh: new Date(Date.now() - 2 * 60 * 60 * 1000),
      recordCount: 520,
      completeness: 96.1,
      issues: [
        {
          id: 'mx-1',
          domain: 'Maintenance',
          severity: 'WARNING',
          type: 'FRESHNESS',
          description: 'MRO parts inventory data stale (4 hours)',
          detectedAt: new Date(),
          acknowledged: false,
        },
        {
          id: 'mx-2',
          domain: 'Maintenance',
          severity: 'WARNING',
          type: 'SYNC',
          description: 'Maintenance work order sync delayed',
          detectedAt: new Date(),
          acknowledged: false,
        },
      ],
    },
    {
      domain: 'Commercial',
      score: 94,
      status: 'HEALTHY',
      lastRefresh: new Date(Date.now() - 60 * 60 * 1000),
      recordCount: 811,
      completeness: 99.4,
      issues: [],
    },
    {
      domain: 'Stations',
      score: 89,
      status: 'HEALTHY',
      lastRefresh: new Date(Date.now() - 30 * 60 * 1000),
      recordCount: 101,
      completeness: 97.8,
      issues: [
        {
          id: 'station-1',
          domain: 'Stations',
          severity: 'WARNING',
          type: 'COMPLETENESS',
          description: 'Gate allocation data incomplete for 2 stations',
          affectedRecords: 2,
          detectedAt: new Date(),
          acknowledged: false,
        },
      ],
    },
    {
      domain: 'MRO',
      score: 82,
      status: 'DEGRADED',
      lastRefresh: new Date(Date.now() - 4 * 60 * 60 * 1000),
      recordCount: 45,
      completeness: 94.2,
      issues: [
        {
          id: 'mro-1',
          domain: 'MRO',
          severity: 'WARNING',
          type: 'FRESHNESS',
          description: 'Parts inventory data stale',
          detectedAt: new Date(),
          acknowledged: false,
        },
        {
          id: 'mro-2',
          domain: 'MRO',
          severity: 'WARNING',
          type: 'COMPLETENESS',
          description: 'Vendor reliability scores missing',
          affectedRecords: 8,
          detectedAt: new Date(),
          acknowledged: false,
        },
        {
          id: 'mro-3',
          domain: 'MRO',
          severity: 'ERROR',
          type: 'VALIDITY',
          description: 'Invalid cost values detected',
          affectedRecords: 3,
          detectedAt: new Date(),
          acknowledged: false,
        },
      ],
    },
  ]);

  // Calculate overall score
  const overallScore = Math.round(
    domainHealth.reduce((sum, d) => sum + d.score, 0) / domainHealth.length
  );
  const overallStatus = overallScore >= 90 ? 'HEALTHY' : overallScore >= 70 ? 'DEGRADED' : 'CRITICAL';
  const totalIssues = domainHealth.reduce((sum, d) => sum + d.issues.length, 0);

  useEffect(() => {
    async function fetchData() {
      try {
        const status = await api.getStatus();
        setDataStatus(status);
      } catch (err) {
        console.error('Failed to fetch data status:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatTimestamp = (date: Date | null) => {
    if (!date) return 'Never';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'text-emerald-600 bg-emerald-100';
      case 'DEGRADED':
        return 'text-amber-600 bg-amber-100';
      case 'CRITICAL':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'ERROR':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'WARNING':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="h-full overflow-auto p-6 bg-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Database className="w-7 h-7 text-[#002855]" />
              Data Platform Health
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Monitor data quality, freshness, and system status
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#002855] text-white rounded-lg hover:bg-[#001a3d] transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Status Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke={overallScore >= 90 ? '#10b981' : overallScore >= 70 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(overallScore / 100) * 276.46} 276.46`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                    {overallScore}%
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Overall Status</div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(overallStatus)}`}>
                  {overallStatus === 'HEALTHY' && <CheckCircle className="w-4 h-4" />}
                  {overallStatus === 'DEGRADED' && <AlertTriangle className="w-4 h-4" />}
                  {overallStatus === 'CRITICAL' && <XCircle className="w-4 h-4" />}
                  {overallStatus}
                </div>
                <div className="text-sm text-slate-500 mt-2">
                  Last updated: {formatTimestamp(lastGlobalUpdate)}
                </div>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800">{domainHealth.length}</div>
                <div className="text-sm text-slate-500">Domains</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">{totalIssues}</div>
                <div className="text-sm text-slate-500">Active Issues</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800">
                  {domainHealth.reduce((sum, d) => sum + d.recordCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-slate-500">Total Records</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'health', label: 'Domain Health', icon: Activity },
            { id: 'metrics', label: 'Metric Registry', icon: Info },
            { id: 'issues', label: 'Active Issues', icon: AlertTriangle, count: totalIssues },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#002855] text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count && tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'health' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Domain</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Score</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Freshness</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Completeness</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Records</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {domainHealth.map((domain, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(domain.status)}`}>
                          <Database className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-slate-800">{domain.domain}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              domain.score >= 90 ? 'bg-emerald-500' : domain.score >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${domain.score}%` }}
                          />
                        </div>
                        <span className={`font-semibold ${getScoreColor(domain.score)}`}>{domain.score}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{formatTimestamp(domain.lastRefresh)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{domain.completeness.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-800">
                        {domain.recordCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {domain.issues.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          {domain.issues.length}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          0
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Metric Registry</h3>
              <p className="text-sm text-slate-500">Definitions and validation rules for all metrics</p>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Metric</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Description</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Formula</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Valid Range</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-slate-700">Refresh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {METRIC_REGISTRY.map((metric, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-[#002855]">{metric.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{metric.description}</td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {metric.formula}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {metric.minValid}{metric.unit} - {metric.maxValid}{metric.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        metric.refreshFrequency === 'real-time'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Zap className="w-3 h-3" />
                        {metric.refreshFrequency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="space-y-4">
            {domainHealth.flatMap((d) => d.issues).length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">All Clear</h3>
                <p className="text-slate-500">No active data quality issues detected</p>
              </div>
            ) : (
              domainHealth
                .flatMap((d) => d.issues)
                .sort((a, b) => {
                  const severityOrder = { CRITICAL: 0, ERROR: 1, WARNING: 2 };
                  return severityOrder[a.severity] - severityOrder[b.severity];
                })
                .map((issue, i) => (
                  <div
                    key={issue.id}
                    className={`bg-white rounded-xl border p-4 ${getSeverityColor(issue.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                          issue.severity === 'CRITICAL' ? 'text-red-500' :
                          issue.severity === 'ERROR' ? 'text-orange-500' : 'text-amber-500'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-800">{issue.domain}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              issue.severity === 'ERROR' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{issue.description}</p>
                          {issue.affectedRecords && (
                            <p className="text-xs text-slate-500 mt-1">
                              Affected records: {issue.affectedRecords}
                            </p>
                          )}
                        </div>
                      </div>
                      <button className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DataView;
