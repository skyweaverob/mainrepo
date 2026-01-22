'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Target, BarChart3, Activity } from 'lucide-react';
import * as api from '@/lib/api';

type AnalyticsTab = 'intelligence' | 'booking';

export function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('intelligence');

  const tabs = [
    { id: 'intelligence' as const, label: 'Market Intelligence', icon: Target },
    { id: 'booking' as const, label: 'Booking Curves', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {/* Header */}
      <div className="bg-[#002855] px-6 py-4">
        <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
        <p className="text-blue-200 text-sm">Market Intelligence • Booking Curves</p>
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'intelligence' && <IntelligenceContent />}
        {activeTab === 'booking' && <BookingContent />}
      </div>
    </div>
  );
}

// ========================================
// Intelligence Content
// ========================================
function IntelligenceContent() {
  const [position, setPosition] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [positionData, marketsData, insightsData] = await Promise.all([
          api.getNetworkPosition().catch(() => null),
          api.getMarketIntelligence(30),
          api.getExecutiveInsights().catch(() => []),
        ]);
        setPosition(positionData);
        setMarkets(marketsData);
        setInsights(insightsData);
      } catch (error) {
        console.error('Failed to fetch intelligence data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Network Position */}
      {position && (
        <div className="grid grid-cols-4 gap-4">
          <MetricCard title="Total Markets" value={position.total_markets} icon={Target} />
          <MetricCard title="NK Share" value={`${(position.avg_nk_market_share * 100).toFixed(1)}%`} icon={TrendingUp} />
          <MetricCard title="Fare Advantage" value={position.fare_advantage_markets} icon={BarChart3} positive />
          <MetricCard title="Fare Disadvantage" value={position.fare_disadvantage_markets} icon={BarChart3} alert />
        </div>
      )}

      {/* Executive Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Executive Insights</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {insights.slice(0, 5).map((insight, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    insight.priority === 'high' ? 'bg-red-500' :
                    insight.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{insight.headline}</p>
                    <p className="text-sm text-slate-500 mt-1">{insight.detail}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-[#002855] font-medium">{insight.metric}</span>
                      <span className="text-xs text-slate-400">{insight.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Market Intelligence</h3>
        </div>
        {markets.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No market data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Market</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">NK Pax</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">NK Share</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">NK Fare</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">F9 Fare</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Fare Adv.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Intensity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {markets.slice(0, 15).map((m) => (
                  <tr key={m.market_key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-[#002855]">{m.origin}-{m.destination}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{m.nk_passengers?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{(m.nk_market_share * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">${m.nk_avg_fare?.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">${m.f9_avg_fare?.toFixed(0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        m.fare_advantage > 0 ? 'bg-emerald-100 text-emerald-700' :
                        m.fare_advantage < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {m.fare_advantage > 0 ? '+' : ''}{(m.fare_advantage * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <IntensityBadge intensity={m.competitive_intensity} />
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
// Booking Content
// ========================================
function BookingContent() {
  const [bookingData, setBookingData] = useState<any>(null);
  const [selectedRoute, setSelectedRoute] = useState({ origin: 'DTW', destination: 'MCO' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api.getBookingCurve(selectedRoute.origin, selectedRoute.destination);
        setBookingData(data);
      } catch (error) {
        console.error('Failed to fetch booking curve:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedRoute]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Route Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-600">Select Route:</label>
          <select
            value={`${selectedRoute.origin}-${selectedRoute.destination}`}
            onChange={(e) => {
              const [origin, destination] = e.target.value.split('-');
              setSelectedRoute({ origin, destination });
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="DTW-MCO">DTW - MCO</option>
            <option value="DTW-FLL">DTW - FLL</option>
            <option value="DTW-LAS">DTW - LAS</option>
            <option value="EWR-MCO">EWR - MCO</option>
            <option value="EWR-FLL">EWR - FLL</option>
          </select>
        </div>
      </div>

      {bookingData ? (
        <>
          {/* Segment Mix */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Segment Mix</h3>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(bookingData.segment_mix || {}).map(([segment, share]) => (
                <div key={segment} className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase">{segment}</p>
                  <p className="text-2xl font-bold text-[#002855]">{((share as number) * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Booking Curve */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Booking Curve</h3>
            <div className="h-64 flex items-end justify-between gap-1 px-4">
              {(bookingData.booking_curve || []).slice(0, 20).map((point: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-[#002855] rounded-t"
                    style={{ height: `${point.cumulative_booked_pct * 2}px` }}
                  />
                  {i % 4 === 0 && (
                    <span className="text-xs text-slate-400 mt-1">D-{point.days_before_departure}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Recommendations */}
          {bookingData.pricing_recommendations && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pricing Recommendations</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {bookingData.pricing_recommendations.map((rec: any, i: number) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-[#002855] text-white text-xs rounded font-medium">{rec.window}</span>
                      <span className="font-medium text-slate-700">{rec.strategy}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{rec.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-400">
          No booking curve data available for this route
        </div>
      )}
    </div>
  );
}

// ========================================
// Shared Components
// ========================================

function MetricCard({ title, value, icon: Icon, positive = false, alert = false }: {
  title: string;
  value: string | number;
  icon: any;
  positive?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          positive ? 'bg-emerald-100' : alert ? 'bg-red-100' : 'bg-slate-100'
        }`}>
          <Icon className={`w-5 h-5 ${
            positive ? 'text-emerald-600' : alert ? 'text-red-600' : 'text-[#002855]'
          }`} />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold ${
            positive ? 'text-emerald-600' : alert ? 'text-red-600' : 'text-slate-800'
          }`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function IntensityBadge({ intensity }: { intensity: string }) {
  const colors: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700',
    moderate: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    intense: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[intensity] || 'bg-slate-100 text-slate-600'}`}>
      {intensity}
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

export default AnalyticsView;
