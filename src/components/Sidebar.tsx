'use client';

import {
  Network,
  Cpu,
  Settings2,
  BarChart3,
  Database,
  Shield,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useLiveDataStore } from '@/lib/liveDataStore';

/**
 * SkyWeave Sidebar - IKEA-simple navigation
 *
 * Only 4 tabs - everything else is a sub-view or modal:
 * 1. Network - Routes, markets, intelligence
 * 2. Optimize - RASM solver, equipment decisions
 * 3. Operations - Fleet, Crew, MRO unified view
 * 4. Analytics - Booking curves, scenarios, insights
 */
const navigation = [
  { id: 'network', name: 'Network', icon: Network, desc: 'Routes & Markets' },
  { id: 'tradeoffs', name: 'Optimize', icon: Cpu, desc: 'RASM Solver' },
  { id: 'operations', name: 'Operations', icon: Settings2, desc: 'Fleet • Crew • MRO' },
  { id: 'analytics', name: 'Analytics', icon: BarChart3, desc: 'Curves & Scenarios' },
] as const;

interface SidebarProps {
  dataStatus: {
    network_loaded: boolean;
    network_rows: number;
    fleet_loaded: boolean;
    fleet_rows: number;
    crew_loaded: boolean;
    crew_rows: number;
    mro_loaded: boolean;
    mro_rows: number;
  } | null;
}

export function Sidebar({ dataStatus }: SidebarProps) {
  const { activeView, setActiveView } = useAppStore();
  const { isConnected } = useLiveDataStore();

  // Map legacy views to new 4-tab structure
  const mapToNewView = (view: string) => {
    const mapping: Record<string, string> = {
      intelligence: 'network',
      crossdomain: 'network',
      booking: 'analytics',
      scenarios: 'analytics',
      fleet: 'operations',
      crew: 'operations',
      mro: 'operations',
    };
    return mapping[view] || view;
  };

  const currentTab = mapToNewView(activeView);

  const getStatusColor = (id: string) => {
    if (!dataStatus) return 'bg-slate-600';

    const statusMap: Record<string, boolean> = {
      network: dataStatus.network_loaded,
      tradeoffs: dataStatus.network_loaded,
      operations: dataStatus.fleet_loaded && dataStatus.crew_loaded && dataStatus.mro_loaded,
      analytics: dataStatus.network_loaded,
    };

    return statusMap[id] && isConnected ? 'bg-emerald-500' : 'bg-slate-600';
  };

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Simple 4-Tab Navigation */}
      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-600'}`}>
                    {item.desc}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(item.id)}`} />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Compact Data Status */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Data</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <DataBadge
            label="Routes"
            value={dataStatus?.network_rows || 0}
            loaded={dataStatus?.network_loaded || false}
          />
          <DataBadge
            label="Fleet"
            value={dataStatus?.fleet_rows || 0}
            loaded={dataStatus?.fleet_loaded || false}
          />
          <DataBadge
            label="Crew"
            value={dataStatus?.crew_rows || 0}
            loaded={dataStatus?.crew_loaded || false}
          />
          <DataBadge
            label="MRO"
            value={dataStatus?.mro_rows || 0}
            loaded={dataStatus?.mro_loaded || false}
          />
        </div>
      </div>

      {/* Security Badge */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <div className="text-[10px]">
            <span className="text-emerald-400 font-medium">SOC 2</span>
            <span className="text-slate-600 ml-1">Compliant</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DataBadge({ label, value, loaded }: { label: string; value: number; loaded: boolean }) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();

  return (
    <div className={`px-2 py-1 rounded ${loaded ? 'bg-slate-800' : 'bg-slate-800/50'}`}>
      <div className="text-slate-500">{label}</div>
      <div className={loaded ? 'text-emerald-400 font-medium' : 'text-slate-600'}>
        {formatted}
      </div>
    </div>
  );
}

export default Sidebar;
