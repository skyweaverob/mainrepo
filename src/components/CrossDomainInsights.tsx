'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plane, Users, Wrench, DollarSign, Network, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { formatCurrency, formatRASM } from '@/lib/formatters';
import * as api from '@/lib/api';

/**
 * CrossDomainInsights - Unified view of how all 5 domains interact
 *
 * This is the core visualization for SkyWeave's value proposition:
 * showing how Network, Fleet, Crew, MRO, and Revenue Management
 * constraints interact and impact RASM optimization.
 */
export function CrossDomainInsights() {
  const [fleetAlignment, setFleetAlignment] = useState<any>(null);
  const [crewAlignment, setCrewAlignment] = useState<any>(null);
  const [mroImpact, setMroImpact] = useState<any>(null);
  const [networkPosition, setNetworkPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [fleet, crew, mro, network] = await Promise.all([
          api.getFleetAlignment().catch(() => null),
          api.getCrewAlignment().catch(() => null),
          api.getMROImpact().catch(() => null),
          api.getNetworkPosition().catch(() => null),
        ]);

        setFleetAlignment(fleet);
        setCrewAlignment(crew);
        setMroImpact(mro);
        setNetworkPosition(network);
      } catch (error) {
        console.error('Failed to fetch cross-domain data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate unified RASM optimization score
  const rasmOpportunities = useMemo(() => {
    const opportunities: Array<{
      domain: string;
      icon: typeof Plane;
      color: string;
      issue: string;
      rasmImpact: string;
      status: 'opportunity' | 'constraint' | 'optimal';
    }> = [];

    // Fleet opportunities
    if (fleetAlignment?.recommendations) {
      fleetAlignment.recommendations.forEach((rec: any) => {
        if (rec.message?.includes('underutilized') || rec.message?.includes('constrained')) {
          opportunities.push({
            domain: 'Fleet',
            icon: Plane,
            color: 'cyan',
            issue: rec.message,
            rasmImpact: '+0.2-0.5¢',
            status: 'opportunity',
          });
        }
      });
    }

    // Crew constraints
    if (crewAlignment?.training_alerts) {
      const urgentTraining = crewAlignment.training_alerts.filter(
        (a: any) => a.due_30_days && a.due_30_days > 10
      );
      if (urgentTraining.length > 0) {
        opportunities.push({
          domain: 'Crew',
          icon: Users,
          color: 'purple',
          issue: `${urgentTraining.length} bases with training due - capacity risk`,
          rasmImpact: '-0.1-0.3¢',
          status: 'constraint',
        });
      }
    }

    // MRO constraints
    if (mroImpact?.network_impact) {
      const severeImpacts = mroImpact.network_impact.filter((i: any) => i.severity === 'high');
      if (severeImpacts.length > 0) {
        opportunities.push({
          domain: 'MRO',
          icon: Wrench,
          color: 'orange',
          issue: `${severeImpacts.length} high-impact maintenance events scheduled`,
          rasmImpact: '-0.2-0.4¢',
          status: 'constraint',
        });
      }
    }

    // Network opportunities
    if (networkPosition) {
      if (networkPosition.fare_advantage_markets > networkPosition.fare_disadvantage_markets) {
        opportunities.push({
          domain: 'Network',
          icon: Network,
          color: 'blue',
          issue: `Leading on fare in ${networkPosition.fare_advantage_markets} markets`,
          rasmImpact: '+0.3-0.6¢',
          status: 'optimal',
        });
      }
      if (networkPosition.nk_only_markets > 10) {
        opportunities.push({
          domain: 'Network',
          icon: Network,
          color: 'blue',
          issue: `${networkPosition.nk_only_markets} uncontested markets - capacity opportunity`,
          rasmImpact: '+0.4-0.8¢',
          status: 'opportunity',
        });
      }
    }

    // Revenue Management (placeholder - would come from fare intelligence)
    opportunities.push({
      domain: 'Revenue Mgmt',
      icon: DollarSign,
      color: 'emerald',
      issue: 'Fare optimization active on all routes',
      rasmImpact: 'Baseline',
      status: 'optimal',
    });

    return opportunities;
  }, [fleetAlignment, crewAlignment, mroImpact, networkPosition]);

  // Calculate net RASM impact
  const netRasmImpact = useMemo(() => {
    let positiveCount = 0;
    let constraintCount = 0;

    rasmOpportunities.forEach(opp => {
      if (opp.status === 'opportunity') positiveCount++;
      if (opp.status === 'constraint') constraintCount++;
    });

    return {
      opportunities: positiveCount,
      constraints: constraintCount,
      score: positiveCount - constraintCount,
    };
  }, [rasmOpportunities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold text-slate-100">Cross-Domain RASM Optimization</h1>
        <p className="text-sm text-slate-400 mt-1">
          Unified view of Network, Fleet, Crew, MRO, and Revenue Management constraints
        </p>
      </div>

      {/* RASM Impact Summary */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">System RASM Optimization Status</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">{netRasmImpact.opportunities} Opportunities</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-bold">{netRasmImpact.constraints} Constraints</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-1">Net RASM Impact Potential</p>
            <span className={`text-2xl font-bold ${
              netRasmImpact.score > 0 ? 'text-emerald-400' :
              netRasmImpact.score < 0 ? 'text-red-400' : 'text-slate-400'
            }`}>
              {netRasmImpact.score > 0 ? '+' : ''}{(netRasmImpact.score * 0.3).toFixed(1)}¢
            </span>
          </div>
        </div>
      </div>

      {/* 5-Domain Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-5 gap-4 mb-6">
          <DomainCard
            title="Network"
            icon={Network}
            color="blue"
            status={networkPosition ? 'connected' : 'disconnected'}
            metric={networkPosition?.total_markets ? `${networkPosition.total_markets} markets` : '—'}
            submetric={networkPosition?.avg_nk_market_share ? `${(networkPosition.avg_nk_market_share * 100).toFixed(0)}% avg share` : '—'}
          />
          <DomainCard
            title="Fleet"
            icon={Plane}
            color="cyan"
            status={fleetAlignment ? 'connected' : 'disconnected'}
            metric={fleetAlignment?.fleet_summary?.by_base ? `${Object.values(fleetAlignment.fleet_summary.by_base).reduce((a: any, b: any) => a + b, 0)} aircraft` : '—'}
            submetric={fleetAlignment?.recommendations?.length ? `${fleetAlignment.recommendations.length} recommendations` : 'Optimized'}
          />
          <DomainCard
            title="Crew"
            icon={Users}
            color="purple"
            status={crewAlignment ? 'connected' : 'disconnected'}
            metric={crewAlignment?.crew_summary?.total_crew ? `${crewAlignment.crew_summary.total_crew} crew` : '—'}
            submetric={crewAlignment?.training_alerts?.length ? `${crewAlignment.training_alerts.length} training alerts` : 'Compliant'}
          />
          <DomainCard
            title="MRO"
            icon={Wrench}
            color="orange"
            status={mroImpact ? 'connected' : 'disconnected'}
            metric={mroImpact?.upcoming_events?.length ? `${mroImpact.upcoming_events.length} events` : '—'}
            submetric={mroImpact?.network_impact?.length ? `${mroImpact.network_impact.length} network impacts` : 'Clear'}
          />
          <DomainCard
            title="Revenue Mgmt"
            icon={DollarSign}
            color="emerald"
            status="connected"
            metric="Active"
            submetric="Real-time fares"
          />
        </div>

        {/* Cross-Domain Interactions */}
        <h3 className="text-sm font-medium text-slate-300 mb-3">RASM Optimization Levers</h3>
        <div className="space-y-2">
          {rasmOpportunities.map((opp, i) => (
            <CrossDomainRow
              key={i}
              domain={opp.domain}
              icon={opp.icon}
              color={opp.color}
              issue={opp.issue}
              rasmImpact={opp.rasmImpact}
              status={opp.status}
            />
          ))}
        </div>

        {/* Action Items */}
        {rasmOpportunities.filter(o => o.status === 'opportunity').length > 0 && (
          <div className="mt-6 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
            <h3 className="text-sm font-medium text-emerald-400 mb-3">Recommended Actions</h3>
            <div className="space-y-2">
              {rasmOpportunities
                .filter(o => o.status === 'opportunity')
                .map((opp, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300">{opp.issue}</span>
                    <span className="ml-auto text-emerald-400 font-medium">{opp.rasmImpact} RASM</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Constraint Warnings */}
        {rasmOpportunities.filter(o => o.status === 'constraint').length > 0 && (
          <div className="mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
            <h3 className="text-sm font-medium text-amber-400 mb-3">Active Constraints</h3>
            <div className="space-y-2">
              {rasmOpportunities
                .filter(o => o.status === 'constraint')
                .map((opp, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-300">{opp.issue}</span>
                    <span className="ml-auto text-amber-400 font-medium">{opp.rasmImpact} RASM</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DomainCard - Shows status of each of the 5 domains
 */
function DomainCard({
  title,
  icon: Icon,
  color,
  status,
  metric,
  submetric,
}: {
  title: string;
  icon: typeof Plane;
  color: string;
  status: 'connected' | 'disconnected';
  metric: string;
  submetric: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClasses[color]?.split(' ')[0]}`} />
        <span className="text-xs font-medium text-white">{title}</span>
        <span className={`ml-auto w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'
        }`} />
      </div>
      <p className="text-sm font-bold text-white">{metric}</p>
      <p className="text-xs text-slate-400">{submetric}</p>
    </div>
  );
}

/**
 * CrossDomainRow - Shows a single cross-domain interaction
 */
function CrossDomainRow({
  domain,
  icon: Icon,
  color,
  issue,
  rasmImpact,
  status,
}: {
  domain: string;
  icon: typeof Plane;
  color: string;
  issue: string;
  rasmImpact: string;
  status: 'opportunity' | 'constraint' | 'optimal';
}) {
  const statusColors = {
    opportunity: 'border-emerald-500/30 bg-emerald-900/10',
    constraint: 'border-amber-500/30 bg-amber-900/10',
    optimal: 'border-slate-700 bg-slate-800/50',
  };

  const iconColors: Record<string, string> = {
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${statusColors[status]}`}>
      <Icon className={`w-4 h-4 ${iconColors[color] || 'text-slate-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-300">{domain}</span>
          <span className={`text-xs ${
            status === 'opportunity' ? 'text-emerald-400' :
            status === 'constraint' ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {status === 'opportunity' ? '↑' : status === 'constraint' ? '⚠' : '✓'}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate">{issue}</p>
      </div>
      <div className="text-right">
        <span className={`text-xs font-medium ${
          status === 'opportunity' ? 'text-emerald-400' :
          status === 'constraint' ? 'text-amber-400' : 'text-slate-500'
        }`}>
          {rasmImpact}
        </span>
        <p className="text-[10px] text-slate-500">RASM</p>
      </div>
    </div>
  );
}

export default CrossDomainInsights;
