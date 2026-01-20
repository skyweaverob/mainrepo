'use client';

import {
  Network,
  Plane,
  Users,
  Wrench,
  BarChart3,
  Settings,
  Upload,
  Database,
  Brain,
  TrendingUp,
  Target,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

const navigation = [
  { id: 'network', name: 'Network', icon: Network },
  { id: 'intelligence', name: 'Intelligence', icon: Brain },
  { id: 'booking', name: 'Booking Curves', icon: TrendingUp },
  { id: 'fleet', name: 'Fleet', icon: Plane },
  { id: 'crew', name: 'Crew', icon: Users },
  { id: 'mro', name: 'MRO', icon: Wrench },
  { id: 'scenarios', name: 'Scenarios', icon: BarChart3 },
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

  const getStatusIndicator = (view: string) => {
    if (!dataStatus) return null;

    const statusMap: Record<string, boolean> = {
      network: dataStatus.network_loaded,
      intelligence: dataStatus.network_loaded,
      booking: dataStatus.network_loaded,
      fleet: dataStatus.fleet_loaded,
      crew: dataStatus.crew_loaded,
      mro: dataStatus.mro_loaded,
      scenarios: dataStatus.network_loaded,
    };

    return statusMap[view] ? (
      <div className="w-2 h-2 rounded-full bg-green-500" />
    ) : (
      <div className="w-2 h-2 rounded-full bg-slate-600" />
    );
  };

  return (
    <aside className="w-64 bg-[#0f172a] border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">SkyWeave</h1>
            <p className="text-xs text-slate-500">Airline Optimization</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium flex-1 text-left">{item.name}</span>
                {getStatusIndicator(item.id)}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Data Status */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">Data Status</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Network</span>
            <span className={dataStatus?.network_loaded ? 'text-green-400' : 'text-slate-600'}>
              {dataStatus?.network_rows.toLocaleString() || 0} rows
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Fleet</span>
            <span className={dataStatus?.fleet_loaded ? 'text-green-400' : 'text-slate-600'}>
              {dataStatus?.fleet_rows.toLocaleString() || 0} aircraft
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Crew</span>
            <span className={dataStatus?.crew_loaded ? 'text-green-400' : 'text-slate-600'}>
              {dataStatus?.crew_rows.toLocaleString() || 0} members
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">MRO</span>
            <span className={dataStatus?.mro_loaded ? 'text-green-400' : 'text-slate-600'}>
              {dataStatus?.mro_rows.toLocaleString() || 0} orders
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
