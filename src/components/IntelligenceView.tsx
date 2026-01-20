'use client';

import { useState, useEffect } from 'react';
import {
  getNetworkPosition,
  getMarketIntelligence,
  getMarketOpportunities,
  getExecutiveInsights,
  getFareIntelligence,
  getFleetAlignment,
  getCrewAlignment,
  getMROImpact,
  type NetworkPosition,
  type MarketIntelligence,
  type MarketOpportunity,
  type ExecutiveInsight,
} from '@/lib/api';
import { TrendingUp, TrendingDown, AlertCircle, Target, DollarSign, Users, Plane, Wrench, Lightbulb } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#6b7280', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export default function IntelligenceView() {
  const [position, setPosition] = useState<NetworkPosition | null>(null);
  const [markets, setMarkets] = useState<MarketIntelligence[]>([]);
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [insights, setInsights] = useState<ExecutiveInsight[]>([]);
  const [fareIntel, setFareIntel] = useState<{
    nk_win_rate?: number;
    avg_fare_difference?: number;
    total_observations?: number;
    nk_metrics?: { avg_fare: number };
    f9_metrics?: { avg_fare: number };
  } | null>(null);
  const [fleetAlignment, setFleetAlignment] = useState<{
    base_analysis: Record<string, { aircraft: number; annual_passengers: number; pax_per_aircraft: number }>;
    recommendations: Array<{ type: string; base: string; message: string }>;
  } | null>(null);
  const [crewAlignment, setCrewAlignment] = useState<{
    base_analysis: Record<string, { pilots: number; flight_attendants: number; fa_pilot_ratio: number }>;
    training_alerts: Array<{ due_30_days?: number; due_60_days?: number; due_90_days?: number }>;
  } | null>(null);
  const [mroImpact, setMroImpact] = useState<{
    upcoming_events: Array<{ aircraft: string; base: string; maintenance_type: string; start_date: string; downtime_days: number }>;
    network_impact: Array<{ base: string; impact: string; severity: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'markets' | 'opportunities' | 'cross-domain'>('overview');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [posData, marketsData, oppData, insightsData, fareData, fleetData, crewData, mroData] = await Promise.all([
          getNetworkPosition(),
          getMarketIntelligence(100),
          getMarketOpportunities(),
          getExecutiveInsights(),
          getFareIntelligence(),
          getFleetAlignment(),
          getCrewAlignment(),
          getMROImpact(),
        ]);
        setPosition(posData);
        setMarkets(marketsData);
        setOpportunities(oppData);
        setInsights(insightsData);
        setFareIntel(fareData);
        setFleetAlignment(fleetData);
        setCrewAlignment(crewData);
        setMroImpact(mroData);
      } catch (err) {
        console.error('Error loading intelligence data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: Lightbulb },
    { id: 'markets', label: 'Market Intelligence', icon: Target },
    { id: 'opportunities', label: 'Growth Opportunities', icon: TrendingUp },
    { id: 'cross-domain', label: 'Cross-Domain', icon: Plane },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-slate-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          position={position}
          insights={insights}
          fareIntel={fareIntel}
          markets={markets}
        />
      )}
      {activeTab === 'markets' && (
        <MarketsTab markets={markets} fareIntel={fareIntel} />
      )}
      {activeTab === 'opportunities' && (
        <OpportunitiesTab opportunities={opportunities} />
      )}
      {activeTab === 'cross-domain' && (
        <CrossDomainTab
          fleetAlignment={fleetAlignment}
          crewAlignment={crewAlignment}
          mroImpact={mroImpact}
        />
      )}
    </div>
  );
}

function OverviewTab({
  position,
  insights,
  fareIntel,
  markets,
}: {
  position: NetworkPosition | null;
  insights: ExecutiveInsight[];
  fareIntel: { nk_win_rate?: number; avg_fare_difference?: number; nk_metrics?: { avg_fare: number }; f9_metrics?: { avg_fare: number } } | null;
  markets: MarketIntelligence[];
}) {
  // Prepare data for charts
  const intensityData = markets.reduce((acc, m) => {
    const key = m.competitive_intensity;
    const existing = acc.find(a => a.name === key);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: key, value: 1 });
    }
    return acc;
  }, [] as Array<{ name: string; value: number }>);

  const marketShareData = markets.slice(0, 10).map(m => ({
    market: m.market_key,
    nk: m.nk_market_share,
    f9: 100 - m.nk_market_share,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Overlap Markets"
          value={position?.overlap_markets || 0}
          subtitle={`${position?.total_markets || 0} total markets`}
          icon={<Target className="w-5 h-5 text-blue-400" />}
        />
        <KPICard
          title="NK Market Share"
          value={`${position?.avg_nk_market_share?.toFixed(1) || 0}%`}
          subtitle="Avg. in overlaps"
          icon={<TrendingUp className="w-5 h-5 text-green-400" />}
          trend={position?.avg_nk_market_share && position.avg_nk_market_share > 50 ? 'up' : 'down'}
        />
        <KPICard
          title="Price Win Rate"
          value={`${fareIntel?.nk_win_rate?.toFixed(0) || 0}%`}
          subtitle={`$${Math.abs(fareIntel?.avg_fare_difference || 0).toFixed(0)} avg diff`}
          icon={<DollarSign className="w-5 h-5 text-yellow-400" />}
          trend={fareIntel?.nk_win_rate && fareIntel.nk_win_rate > 50 ? 'up' : 'down'}
        />
        <KPICard
          title="Fare Advantage"
          value={position?.fare_advantage_markets || 0}
          subtitle={`vs ${position?.fare_disadvantage_markets || 0} disadvantage`}
          icon={<AlertCircle className="w-5 h-5 text-orange-400" />}
        />
      </div>

      {/* Executive Insights */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          Executive Insights
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${
                insight.priority === 'high'
                  ? 'border-red-500/30 bg-red-500/5'
                  : insight.priority === 'medium'
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-slate-600 bg-slate-700/30'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 uppercase">
                  {insight.category}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    insight.priority === 'high'
                      ? 'bg-red-500/20 text-red-400'
                      : insight.priority === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-slate-600 text-slate-300'
                  }`}
                >
                  {insight.priority}
                </span>
              </div>
              <p className="text-white font-medium mb-1">{insight.headline}</p>
              <p className="text-sm text-slate-400 mb-2">{insight.detail}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-400">{insight.metric}</span>
                <span className="text-green-400">{insight.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Competitive Intensity Distribution */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Competition Intensity</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={intensityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {intensityData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Share Comparison */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Top 10 Markets - Share</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketShareData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
                <YAxis dataKey="market" type="category" width={60} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="nk" stackId="a" fill="#3b82f6" name="NK Share" />
                <Bar dataKey="f9" stackId="a" fill="#f97316" name="F9 Share" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketsTab({
  markets,
  fareIntel,
}: {
  markets: MarketIntelligence[];
  fareIntel: { nk_win_rate?: number; avg_fare_difference?: number } | null;
}) {
  const [sortBy, setSortBy] = useState<'passengers' | 'share' | 'fare'>('passengers');

  const sortedMarkets = [...markets].sort((a, b) => {
    if (sortBy === 'passengers') return b.total_passengers - a.total_passengers;
    if (sortBy === 'share') return b.nk_market_share - a.nk_market_share;
    return b.fare_advantage - a.fare_advantage;
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">Total Markets</p>
          <p className="text-2xl font-bold text-white">{markets.length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">NK Price Wins</p>
          <p className="text-2xl font-bold text-green-400">{fareIntel?.nk_win_rate?.toFixed(0) || 0}%</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-sm text-slate-400">Avg Fare Diff</p>
          <p className="text-2xl font-bold text-blue-400">
            ${Math.abs(fareIntel?.avg_fare_difference || 0).toFixed(0)}
            <span className="text-sm text-slate-400 ml-1">
              {(fareIntel?.avg_fare_difference || 0) > 0 ? 'cheaper' : 'higher'}
            </span>
          </p>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2">
        <span className="text-sm text-slate-400">Sort by:</span>
        {(['passengers', 'share', 'fare'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setSortBy(opt)}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === opt ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {opt === 'passengers' ? 'Passengers' : opt === 'share' ? 'NK Share' : 'Fare Advantage'}
          </button>
        ))}
      </div>

      {/* Markets Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-2 text-slate-400">Market</th>
              <th className="text-right py-2 px-2 text-slate-400">Total Pax</th>
              <th className="text-right py-2 px-2 text-slate-400">NK Pax</th>
              <th className="text-right py-2 px-2 text-slate-400">NK Share</th>
              <th className="text-right py-2 px-2 text-slate-400">NK Fare</th>
              <th className="text-right py-2 px-2 text-slate-400">F9 Fare</th>
              <th className="text-right py-2 px-2 text-slate-400">Fare Adv</th>
              <th className="text-center py-2 px-2 text-slate-400">Intensity</th>
            </tr>
          </thead>
          <tbody>
            {sortedMarkets.slice(0, 50).map((m) => (
              <tr key={m.market_key} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="py-2 px-2 font-medium text-white">{m.market_key}</td>
                <td className="py-2 px-2 text-right text-slate-300">{m.total_passengers.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-slate-300">{m.nk_passengers.toLocaleString()}</td>
                <td className="py-2 px-2 text-right">
                  <span
                    className={`${
                      m.nk_market_share > 60 ? 'text-green-400' : m.nk_market_share < 40 ? 'text-red-400' : 'text-yellow-400'
                    }`}
                  >
                    {m.nk_market_share.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-slate-300">
                  {m.nk_avg_fare ? `$${m.nk_avg_fare.toFixed(0)}` : '-'}
                </td>
                <td className="py-2 px-2 text-right text-slate-300">
                  {m.f9_avg_fare ? `$${m.f9_avg_fare.toFixed(0)}` : '-'}
                </td>
                <td className="py-2 px-2 text-right">
                  <span
                    className={`${m.fare_advantage > 5 ? 'text-green-400' : m.fare_advantage < -5 ? 'text-red-400' : 'text-slate-400'}`}
                  >
                    {m.fare_advantage > 0 ? '+' : ''}{m.fare_advantage.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      m.competitive_intensity === 'intense'
                        ? 'bg-red-500/20 text-red-400'
                        : m.competitive_intensity === 'high'
                        ? 'bg-orange-500/20 text-orange-400'
                        : m.competitive_intensity === 'moderate'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {m.competitive_intensity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunitiesTab({ opportunities }: { opportunities: MarketOpportunity[] }) {
  const highPriority = opportunities.filter((o) => o.priority === 'high');
  const mediumPriority = opportunities.filter((o) => o.priority === 'medium');

  return (
    <div className="space-y-6">
      {/* High Priority */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          High Priority Opportunities ({highPriority.length})
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {highPriority.map((opp, idx) => (
            <OpportunityCard key={idx} opportunity={opp} />
          ))}
        </div>
      </div>

      {/* Medium Priority */}
      {mediumPriority.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Medium Priority Opportunities ({mediumPriority.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mediumPriority.slice(0, 6).map((opp, idx) => (
              <OpportunityCard key={idx} opportunity={opp} />
            ))}
          </div>
        </div>
      )}

      {opportunities.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          No market opportunities identified. Network position is strong.
        </div>
      )}
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: MarketOpportunity }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-start justify-between mb-2">
        <span className="text-lg font-bold text-white">{opportunity.market}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            opportunity.type === 'share_opportunity' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
          }`}
        >
          {opportunity.type === 'share_opportunity' ? 'Share' : 'Pricing'}
        </span>
      </div>
      <p className="text-sm text-slate-300 mb-3">{opportunity.insight}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {opportunity.current_share !== undefined && (
          <div>
            <span className="text-slate-400">Current Share:</span>
            <span className="text-white ml-1">{opportunity.current_share.toFixed(1)}%</span>
          </div>
        )}
        {opportunity.total_market_size !== undefined && (
          <div>
            <span className="text-slate-400">Market Size:</span>
            <span className="text-white ml-1">{(opportunity.total_market_size / 1000).toFixed(0)}K</span>
          </div>
        )}
        {opportunity.fare_advantage_pct !== undefined && (
          <div>
            <span className="text-slate-400">Fare Adv:</span>
            <span className="text-green-400 ml-1">+{opportunity.fare_advantage_pct.toFixed(0)}%</span>
          </div>
        )}
        {opportunity.fare_position && (
          <div>
            <span className="text-slate-400">Position:</span>
            <span className="text-white ml-1">{opportunity.fare_position}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CrossDomainTab({
  fleetAlignment,
  crewAlignment,
  mroImpact,
}: {
  fleetAlignment: {
    base_analysis: Record<string, { aircraft: number; annual_passengers: number; pax_per_aircraft: number }>;
    recommendations: Array<{ type: string; base: string; message: string }>;
  } | null;
  crewAlignment: {
    base_analysis: Record<string, { pilots: number; flight_attendants: number; fa_pilot_ratio: number }>;
    training_alerts: Array<{ due_30_days?: number; due_60_days?: number; due_90_days?: number }>;
  } | null;
  mroImpact: {
    upcoming_events: Array<{ aircraft: string; base: string; maintenance_type: string; start_date: string; downtime_days: number }>;
    network_impact: Array<{ base: string; impact: string; severity: string }>;
  } | null;
}) {
  // Prepare fleet data for chart
  const fleetData = fleetAlignment?.base_analysis
    ? Object.entries(fleetAlignment.base_analysis).map(([base, data]) => ({
        base,
        aircraft: data.aircraft,
        pax_per_ac: Math.round(data.pax_per_aircraft / 1000),
      }))
    : [];

  // Prepare crew data
  const crewData = crewAlignment?.base_analysis
    ? Object.entries(crewAlignment.base_analysis).map(([base, data]) => ({
        base,
        pilots: data.pilots,
        fas: data.flight_attendants,
        ratio: data.fa_pilot_ratio,
      }))
    : [];

  // Type assertion for training_alerts which can have multiple shapes
  const trainingAlert = crewAlignment?.training_alerts?.find(
    (a): a is { type: string; due_30_days?: number; due_60_days?: number; due_90_days?: number } =>
      'type' in a && a.type === 'training_summary'
  );

  return (
    <div className="space-y-6">
      {/* Fleet-Network Alignment */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plane className="w-5 h-5 text-blue-400" />
          Fleet-Network Alignment
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="base" stroke="#94a3b8" />
                <YAxis yAxisId="left" stroke="#94a3b8" />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="aircraft" fill="#3b82f6" name="Aircraft" />
                <Bar yAxisId="right" dataKey="pax_per_ac" fill="#22c55e" name="Pax/AC (K)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-400">Recommendations</h4>
            {fleetAlignment?.recommendations?.map((rec, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border ${
                  rec.type === 'capacity_constraint'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-yellow-500/30 bg-yellow-500/5'
                }`}
              >
                <p className="text-sm text-white">{rec.message}</p>
              </div>
            ))}
            {(!fleetAlignment?.recommendations || fleetAlignment.recommendations.length === 0) && (
              <p className="text-slate-400 text-sm">Fleet is well-aligned with network demand.</p>
            )}
          </div>
        </div>
      </div>

      {/* Crew Alignment */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400" />
          Crew-Network Alignment
        </h3>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-sm text-slate-400">Training Due 30d</p>
            <p className="text-2xl font-bold text-yellow-400">{trainingAlert?.due_30_days || 0}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-sm text-slate-400">Training Due 60d</p>
            <p className="text-2xl font-bold text-orange-400">{trainingAlert?.due_60_days || 0}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-sm text-slate-400">Training Due 90d</p>
            <p className="text-2xl font-bold text-slate-300">{trainingAlert?.due_90_days || 0}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-2 text-slate-400">Base</th>
                <th className="text-right py-2 px-2 text-slate-400">Pilots</th>
                <th className="text-right py-2 px-2 text-slate-400">Flight Attendants</th>
                <th className="text-right py-2 px-2 text-slate-400">FA/Pilot Ratio</th>
              </tr>
            </thead>
            <tbody>
              {crewData.map((row) => (
                <tr key={row.base} className="border-b border-slate-800">
                  <td className="py-2 px-2 text-white font-medium">{row.base}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{row.pilots}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{row.fas}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={row.ratio < 2.0 ? 'text-red-400' : row.ratio > 3.5 ? 'text-yellow-400' : 'text-green-400'}>
                      {row.ratio.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MRO Impact */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-400" />
          MRO Network Impact
        </h3>
        {mroImpact?.network_impact && mroImpact.network_impact.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-red-400 mb-2">Network Impact Alerts</h4>
            <div className="space-y-2">
              {mroImpact.network_impact.map((impact, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded border ${
                    impact.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'
                  }`}
                >
                  <p className="text-sm text-white">
                    <span className="font-medium">{impact.base}:</span> {impact.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-2 text-slate-400">Aircraft</th>
                <th className="text-left py-2 px-2 text-slate-400">Base</th>
                <th className="text-left py-2 px-2 text-slate-400">Type</th>
                <th className="text-left py-2 px-2 text-slate-400">Start</th>
                <th className="text-right py-2 px-2 text-slate-400">Downtime</th>
              </tr>
            </thead>
            <tbody>
              {mroImpact?.upcoming_events?.slice(0, 10).map((event, idx) => (
                <tr key={idx} className="border-b border-slate-800">
                  <td className="py-2 px-2 text-white font-medium">{event.aircraft}</td>
                  <td className="py-2 px-2 text-slate-300">{event.base}</td>
                  <td className="py-2 px-2 text-slate-300">{event.maintenance_type}</td>
                  <td className="py-2 px-2 text-slate-300">{event.start_date}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={event.downtime_days > 14 ? 'text-red-400' : event.downtime_days > 7 ? 'text-yellow-400' : 'text-slate-300'}>
                      {event.downtime_days}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
        {trend && (
          trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
