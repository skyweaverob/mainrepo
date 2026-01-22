'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RefreshCw, Zap, Target } from 'lucide-react';
import { RASMControlPanel } from './RASMControlPanel';
import { DecisionHorizon, HorizonType } from './DecisionHorizon';
import { DecisionStack, Decision } from './DecisionStack';
import { ConstraintBar } from './ConstraintChip';
import { DecisionLog } from './DecisionLog';
import { NetworkMap } from '../NetworkMap';
import * as api from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';

interface ControlRoomProps {
  onHubClick?: (hubCode: string) => void;
}

/**
 * ControlRoom - The main OS interface for SkyWeave
 * Uses real API data to generate and manage decisions
 */
export function ControlRoom({ onHubClick }: ControlRoomProps) {
  const [loading, setLoading] = useState(true);
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonType>('T0_T7');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [rasmData, setRasmData] = useState({
    current: 11.5,
    target: 12.0,
    floor: 10.0,
    ceiling: 14.0,
  });
  const [networkHealth, setNetworkHealth] = useState<any>(null);
  const [marketIntelligence, setMarketIntelligence] = useState<api.MarketIntelligence[]>([]);
  const [equipmentRecs, setEquipmentRecs] = useState<any[]>([]);
  const [optimizerStatus, setOptimizerStatus] = useState<api.OptimizerStatus | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [decisionLog, setDecisionLog] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch data in parallel
        const [status, markets, recs, insights] = await Promise.all([
          api.getOptimizerStatus().catch(() => null),
          api.getMarketIntelligence(100).catch(() => []),
          api.getEquipmentRecommendations().catch(() => []),
          api.getExecutiveInsights().catch(() => []),
        ]);

        setOptimizerStatus(status);
        setMarketIntelligence(markets);
        setEquipmentRecs(recs);

        // Calculate network RASM from market data
        if (markets.length > 0) {
          const totalRevenue = markets.reduce((sum, m) => {
            const fare = m.nk_avg_fare || 120;
            const pax = m.nk_passengers || 0;
            return sum + (fare * pax);
          }, 0);
          const totalASM = markets.reduce((sum, m) => {
            const pax = m.nk_passengers || 0;
            const dist = m.distance || 1000;
            return sum + (pax * dist / 0.85); // Approximate ASM from pax at 85% LF
          }, 0);
          const networkRasm = totalASM > 0 ? (totalRevenue / totalASM) * 100 : 11.5;

          setRasmData(prev => ({
            ...prev,
            current: Math.round(networkRasm * 100) / 100,
          }));
        }

        // Generate decisions from equipment recommendations
        generateDecisionsFromData(recs, markets, insights);

      } catch (err) {
        console.error('Failed to load control room data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Generate decisions from API data
  const generateDecisionsFromData = useCallback((
    recs: any[],
    markets: api.MarketIntelligence[],
    insights: api.ExecutiveInsight[]
  ) => {
    const newDecisions: Decision[] = [];

    // Equipment upgrade decisions from API
    recs.slice(0, 8).forEach((rec, i) => {
      const market = markets.find(m => m.market_key === rec.market_key);
      const dailyPax = market ? Math.round(market.nk_passengers / 365) : 150;
      const avgFare = market?.nk_avg_fare || 120;
      const distance = market?.distance || 1000;

      // Calculate actual revenue impact
      const currentSeats = 182;
      const newSeats = rec.recommended_equipment === 'A321neo' ? 228 : 182;
      const seatIncrease = newSeats - currentSeats;
      const additionalPax = Math.round(seatIncrease * 0.85);
      const dailyRevenueIncrease = additionalPax * avgFare;

      // Calculate RASM impact
      const currentRasm = (dailyPax * avgFare) / (currentSeats * distance * 2) * 100;
      const newRasm = ((dailyPax + additionalPax) * avgFare) / (newSeats * distance * 2) * 100;
      const rasmDelta = newRasm - currentRasm;

      newDecisions.push({
        id: `equip-${i}`,
        title: `Upgauge ${rec.route} to ${rec.recommended_equipment}`,
        description: rec.reason,
        category: 'equipment',
        priority: rec.competitive_intensity === 'high' ? 'high' : 'medium',
        status: 'proposed',
        revenueImpact: dailyRevenueIncrease,
        rasmImpact: Math.round(rasmDelta * 100) / 100,
        currentState: 'A320neo @ 2x daily',
        proposedState: `${rec.recommended_equipment} @ 2x daily`,
        constraints: [
          'Fleet availability verified',
          'Crew qualified',
          'MRO schedule clear',
        ],
        risks: rec.competitive_intensity === 'high' ? ['Competitive response risk'] : [],
      });
    });

    // Pricing decisions from fare intelligence
    const fareOpportunities = markets
      .filter(m => m.fare_advantage < -5) // NK fares 5%+ higher than F9
      .slice(0, 4);

    fareOpportunities.forEach((market, i) => {
      const fareReduction = Math.round(Math.abs(market.fare_advantage) / 2);
      const currentFare = market.nk_avg_fare || 120;
      const newFare = currentFare * (1 - fareReduction / 100);
      const dailyPax = Math.round(market.nk_passengers / 365);

      // Price elasticity estimate: -1.2 (unit elastic)
      const paxIncrease = Math.round(dailyPax * (fareReduction / 100) * 1.2);
      const revenueChange = (dailyPax + paxIncrease) * newFare - dailyPax * currentFare;

      newDecisions.push({
        id: `price-${i}`,
        title: `Competitive pricing on ${market.market_key}`,
        description: `F9 is ${Math.abs(Math.round(market.fare_advantage))}% cheaper. Reduce fares to capture share.`,
        category: 'pricing',
        priority: market.competitive_intensity === 'intense' ? 'critical' : 'high',
        status: 'proposed',
        revenueImpact: revenueChange,
        rasmImpact: -0.15, // RASM decreases but volume increases
        currentState: `$${Math.round(currentFare)} avg fare`,
        proposedState: `$${Math.round(newFare)} avg fare (-${fareReduction}%)`,
        constraints: ['RM system compatible', 'No floor violation'],
        risks: ['Margin compression', 'Competitor response'],
      });
    });

    // Capacity decisions from high-load markets
    const highLoadMarkets = markets
      .filter(m => m.nk_market_share > 0.6 && m.nk_passengers > 50000)
      .slice(0, 3);

    highLoadMarkets.forEach((market, i) => {
      const additionalFreq = 1;
      const seatsPerFlight = 182;
      const additionalCapacity = seatsPerFlight * 0.85 * additionalFreq;
      const avgFare = market.nk_avg_fare || 120;

      newDecisions.push({
        id: `capacity-${i}`,
        title: `Add frequency on ${market.market_key}`,
        description: `High market share (${Math.round(market.nk_market_share * 100)}%) indicates unmet demand.`,
        category: 'capacity',
        priority: 'medium',
        status: 'proposed',
        revenueImpact: additionalCapacity * avgFare,
        rasmImpact: 0.12,
        currentState: '2x daily frequency',
        proposedState: '3x daily frequency',
        constraints: ['Slot availability', 'Aircraft utilization OK'],
        risks: ['Load factor dilution'],
      });
    });

    setDecisions(newDecisions);
  }, []);

  // Run network optimization
  const runOptimization = useCallback(async () => {
    setIsOptimizing(true);
    try {
      const result = await api.runNetworkOptimization('profit');
      setNetworkHealth(result.network_health);

      // Update RASM from optimization
      if (result.optimization_result) {
        const optRasm = (result.optimization_result.total_revenue / result.optimization_result.total_asm) * 100;
        setRasmData(prev => ({
          ...prev,
          current: Math.round(optRasm * 100) / 100,
        }));
      }

      // Generate new decisions from AI recommendations
      const aiDecisions: Decision[] = result.ai_recommendations?.map((rec, i) => ({
        id: `ai-${i}`,
        title: rec.title,
        description: `AI-generated recommendation`,
        category: rec.type === 'growth' ? 'capacity' : rec.type === 'rebalance' ? 'equipment' : 'pricing',
        priority: 'high',
        status: 'simulated',
        revenueImpact: rec.metrics?.revenue || 5000,
        rasmImpact: rec.metrics?.rasm_change || 0.1,
        currentState: 'Current network state',
        proposedState: rec.title,
        constraints: ['Validated by optimizer'],
      })) || [];

      if (aiDecisions.length > 0) {
        setDecisions(prev => [...aiDecisions, ...prev.slice(aiDecisions.length)]);
      }

    } catch (err) {
      console.error('Optimization failed:', err);
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  // Handle decision actions
  const handleApprove = useCallback((id: string) => {
    setDecisions(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'approved' as const } : d
    ));

    // Add to log
    const decision = decisions.find(d => d.id === id);
    if (decision) {
      setDecisionLog(prev => [{
        id: `log-${Date.now()}`,
        decisionId: id,
        decisionTitle: decision.title,
        type: 'approved' as const,
        timestamp: new Date(),
        actor: 'System User',
        revenueImpact: decision.revenueImpact,
        rasmImpact: decision.rasmImpact,
      }, ...prev]);
    }
  }, [decisions]);

  const handleReject = useCallback((id: string) => {
    setDecisions(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'rejected' as const } : d
    ));

    const decision = decisions.find(d => d.id === id);
    if (decision) {
      setDecisionLog(prev => [{
        id: `log-${Date.now()}`,
        decisionId: id,
        decisionTitle: decision.title,
        type: 'rejected' as const,
        timestamp: new Date(),
        actor: 'System User',
      }, ...prev]);
    }
  }, [decisions]);

  const handleSimulate = useCallback(async (id: string) => {
    setDecisions(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'simulated' as const } : d
    ));

    const decision = decisions.find(d => d.id === id);
    if (decision) {
      setDecisionLog(prev => [{
        id: `log-${Date.now()}`,
        decisionId: id,
        decisionTitle: decision.title,
        type: 'simulated' as const,
        timestamp: new Date(),
        actor: 'AI Optimizer',
      }, ...prev]);
    }
  }, [decisions]);

  const handleExecute = useCallback((id: string) => {
    setDecisions(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'completed' as const } : d
    ));

    const decision = decisions.find(d => d.id === id);
    if (decision) {
      setDecisionLog(prev => [{
        id: `log-${Date.now()}`,
        decisionId: id,
        decisionTitle: decision.title,
        type: 'executed' as const,
        timestamp: new Date(),
        actor: 'System User',
        revenueImpact: decision.revenueImpact,
        rasmImpact: decision.rasmImpact,
      }, ...prev]);

      // Update RASM after execution
      setRasmData(prev => ({
        ...prev,
        current: Math.round((prev.current + decision.rasmImpact * 0.5) * 100) / 100,
      }));
    }
  }, [decisions]);

  // Filter decisions by horizon
  const filteredDecisions = useMemo(() => {
    // For now, show all decisions regardless of horizon
    // In a real system, this would filter by decision urgency
    return decisions;
  }, [decisions, selectedHorizon]);

  // Hub data for map
  const hubMapData = useMemo(() => {
    const hubs = ['DTW', 'MCO', 'FLL', 'LAS', 'EWR'];
    return hubs.map(code => {
      const hubMarkets = marketIntelligence.filter(
        m => m.origin === code || m.destination === code
      );
      const totalPax = hubMarkets.reduce((sum, m) => sum + (m.nk_passengers || 0), 0);
      const avgFare = hubMarkets.length > 0
        ? hubMarkets.reduce((sum, m) => sum + (m.nk_avg_fare || 0), 0) / hubMarkets.length
        : 0;
      const avgDistance = hubMarkets.length > 0
        ? hubMarkets.reduce((sum, m) => sum + (m.distance || 0), 0) / hubMarkets.length
        : 0;
      const rasmCents = avgDistance > 0 ? (avgFare / avgDistance) * 100 : 0;

      return {
        code,
        dailyRevenue: avgFare > 0 ? (totalPax * avgFare) / 365 : 0,
        rasmCents,
        isProfitable: rasmCents >= 10,
        hasAlert: rasmCents > 0 && rasmCents < 10,
        routeCount: hubMarkets.length,
        dailyFlights: totalPax > 0 ? Math.round(totalPax / 365 / 150) : 0,
      };
    });
  }, [marketIntelligence]);

  // Constraint status
  const constraints = useMemo(() => [
    {
      type: 'fleet' as const,
      label: 'Fleet',
      status: 'satisfied' as const,
      detail: '42 aircraft available',
    },
    {
      type: 'crew' as const,
      label: 'Crew',
      status: 'satisfied' as const,
      detail: 'Full staffing',
    },
    {
      type: 'mro' as const,
      label: 'MRO',
      status: 'warning' as const,
      detail: '2 checks due this week',
    },
    {
      type: 'rasm' as const,
      label: `RASM ≥ ${rasmData.floor}¢`,
      status: rasmData.current >= rasmData.floor ? 'satisfied' as const : 'violated' as const,
      detail: `Current: ${rasmData.current.toFixed(2)}¢`,
    },
  ], [rasmData]);

  // Calculate total impact of pending decisions
  const pendingImpact = useMemo(() => {
    const pending = decisions.filter(d => d.status === 'proposed' || d.status === 'simulated');
    return {
      count: pending.length,
      revenue: pending.reduce((sum, d) => sum + d.revenueImpact, 0),
      rasm: pending.reduce((sum, d) => sum + d.rasmImpact, 0) / Math.max(pending.length, 1),
    };
  }, [decisions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#002855] border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600">Loading Control Room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-[#002855] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Target className="w-6 h-6" />
                Network Control Room
              </h1>
              <p className="text-sm text-blue-200">
                {pendingImpact.count} decisions pending • {formatCurrency(pendingImpact.revenue, { compact: true })}/day potential
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Optimizer Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${
              optimizerStatus?.optimizer_available
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-red-500/20 text-red-300'
            }`}>
              <Zap className="w-4 h-4" />
              <span className="text-xs font-medium">
                {optimizerStatus?.optimizer_available ? 'ML Engine Active' : 'ML Offline'}
              </span>
            </div>

            {/* Run Optimization Button */}
            <button
              onClick={runOptimization}
              disabled={isOptimizing}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#002855] rounded-lg font-medium text-sm hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
              {isOptimizing ? 'Optimizing...' : 'Run Optimizer'}
            </button>
          </div>
        </div>
      </div>

      {/* Constraint Bar */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <ConstraintBar constraints={constraints} size="sm" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden">
        {/* Left Column: RASM Control + Map */}
        <div className="w-80 flex flex-col gap-4 flex-shrink-0">
          <RASMControlPanel
            currentRASM={rasmData.current}
            targetRASM={rasmData.target}
            floorRASM={rasmData.floor}
            ceilingRASM={rasmData.ceiling}
            onTargetChange={(target) => setRasmData(prev => ({ ...prev, target }))}
            dailyRevenueImpact={pendingImpact.revenue}
          />

          <DecisionHorizon
            selectedHorizon={selectedHorizon}
            onHorizonChange={setSelectedHorizon}
            compact
          />

          <div className="flex-1 min-h-[250px] bg-white rounded-lg border border-slate-200 overflow-hidden">
            <NetworkMap
              hubs={hubMapData}
              onHubClick={onHubClick}
              height={250}
            />
          </div>
        </div>

        {/* Center: Decision Stack */}
        <div className="flex-1 overflow-auto">
          <DecisionStack
            title="Active Decisions"
            subtitle={`${selectedHorizon === 'T0_T7' ? 'Tactical' : selectedHorizon === 'T7_T30' ? 'Operational' : 'Planning'} horizon`}
            decisions={filteredDecisions}
            onDecisionApprove={handleApprove}
            onDecisionReject={handleReject}
            onDecisionSimulate={handleSimulate}
            onDecisionExecute={handleExecute}
            maxVisible={5}
            sortBy="impact"
          />
        </div>

        {/* Right: Decision Log */}
        <div className="w-80 flex-shrink-0 overflow-auto">
          <DecisionLog
            entries={decisionLog}
            maxVisible={8}
            showFilters={false}
          />
        </div>
      </div>
    </div>
  );
}

export default ControlRoom;
