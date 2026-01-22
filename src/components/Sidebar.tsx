'use client';

import {
  Presentation,
  Target,
  Cpu,
  Settings2,
  FlaskConical,
  Database,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useLiveDataStore } from '@/lib/liveDataStore';

/**
 * SkyWeave Sidebar - 6 primary navigation items per spec
 *
 * 1. Demo - VC/Board view (investment presentation)
 * 2. Control Room - Primary operational workspace
 * 3. Optimize - Network/Fleet/Schedule optimization
 * 4. Operations - Flight/Crew/Maintenance status
 * 5. Simulate - What-if scenario analysis
 * 6. Data - Data health and platform status
 */
const navigation = [
  { id: 'demo', name: 'Demo', icon: Presentation, desc: 'VC/Board View' },
  { id: 'controlroom', name: 'Control Room', icon: Target, desc: 'Decision OS' },
  { id: 'optimize', name: 'Optimize', icon: Cpu, desc: 'RASM Solver' },
  { id: 'operations', name: 'Operations', icon: Settings2, desc: 'Fleet • Crew • MRO' },
  { id: 'simulate', name: 'Simulate', icon: FlaskConical, desc: 'What-If Analysis' },
  { id: 'data', name: 'Data', icon: Database, desc: 'Data Health' },
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

  const mapToNewView = (view: string) => {
    const mapping: Record<string, string> = {
      intelligence: 'controlroom',
      crossdomain: 'controlroom',
      network: 'controlroom',
      tradeoffs: 'optimize',
      booking: 'simulate',
      scenarios: 'simulate',
      analytics: 'simulate',
      fleet: 'operations',
      crew: 'operations',
      mro: 'operations',
    };
    return mapping[view] || view;
  };

  const currentTab = mapToNewView(activeView);

  const getStatusColor = (id: string) => {
    if (!dataStatus) return 'bg-slate-300';
    const statusMap: Record<string, boolean> = {
      demo: true, // Demo always has curated data
      controlroom: dataStatus.network_loaded,
      optimize: dataStatus.network_loaded,
      operations: dataStatus.fleet_loaded && dataStatus.crew_loaded && dataStatus.mro_loaded,
      simulate: dataStatus.network_loaded,
      data: true, // Data health page always works
    };
    return statusMap[id] && isConnected ? 'bg-emerald-500' : 'bg-slate-300';
  };

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-[#002855] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#002855]'}`} />
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold">{item.name}</div>
                  <div className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                    {item.desc}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(item.id)}`} />
                  {isActive && <ChevronRight className="w-4 h-4 text-blue-200" />}
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Data Status Card */}
      <div className="p-4 border-t border-slate-200">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-[#002855]" />
            <span className="text-xs font-semibold text-[#002855] uppercase tracking-wider">Data Sources</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DataBadge label="Routes" value={dataStatus?.network_rows || 0} loaded={dataStatus?.network_loaded || false} />
            <DataBadge label="Fleet" value={dataStatus?.fleet_rows || 0} loaded={dataStatus?.fleet_loaded || false} />
            <DataBadge label="Crew" value={dataStatus?.crew_rows || 0} loaded={dataStatus?.crew_loaded || false} />
            <DataBadge label="MRO" value={dataStatus?.mro_rows || 0} loaded={dataStatus?.mro_loaded || false} />
          </div>
        </div>
      </div>

      {/* Security Badge */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
          <Shield className="w-4 h-4 text-emerald-600" />
          <div className="text-xs">
            <span className="font-semibold text-emerald-700">SOC 2</span>
            <span className="text-emerald-600 ml-1">Compliant</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function DataBadge({ label, value, loaded }: { label: string; value: number; loaded: boolean }) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();

  return (
    <div className={`px-2 py-1.5 rounded text-center ${loaded ? 'bg-white border border-slate-200' : 'bg-slate-100'}`}>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`text-sm font-bold ${loaded ? 'text-[#002855]' : 'text-slate-400'}`}>
        {formatted}
      </div>
    </div>
  );
}

export default Sidebar;
