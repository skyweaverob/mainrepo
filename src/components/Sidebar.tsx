'use client';

import { useState } from 'react';
import {
  Network,
  Plane,
  Users,
  Wrench,
  Brain,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Database,
  Shield,
  BarChart3,
  Settings,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useLiveDataStore } from '@/lib/liveDataStore';
import { LiveDot } from './LiveFeedIndicator';

// Navigation structure with Plan/Execute sections
const planNavigation = [
  { id: 'network', name: 'Network', icon: Network },
  { id: 'intelligence', name: 'Intelligence', icon: Brain },
  { id: 'booking', name: 'Booking Curves', icon: TrendingUp },
  { id: 'scenarios', name: 'Simulation', icon: Layers },
] as const;

const executeNavigation = [
  { id: 'fleet', name: 'Fleet & MRO', icon: Plane },
  { id: 'crew', name: 'Crew', icon: Users },
  { id: 'mro', name: 'Operations', icon: Wrench },
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
  const { feeds, isConnected } = useLiveDataStore();
  const [planExpanded, setPlanExpanded] = useState(true);
  const [executeExpanded, setExecuteExpanded] = useState(true);

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

    const lastUpdate = feeds.flights.lastUpdate;

    return statusMap[view] ? (
      <LiveDot lastUpdate={lastUpdate} isConnected={isConnected} />
    ) : (
      <div className="w-2 h-2 rounded-full bg-slate-600" />
    );
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* PLAN Section */}
        <div className="mb-4">
          <button
            onClick={() => setPlanExpanded(!planExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
          >
            {planExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Plan
          </button>
          {planExpanded && (
            <div className="space-y-1 mt-1">
              {planNavigation.map((item) => {
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
          )}
        </div>

        {/* EXECUTE Section */}
        <div className="mb-4">
          <button
            onClick={() => setExecuteExpanded(!executeExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
          >
            {executeExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Execute
          </button>
          {executeExpanded && (
            <div className="space-y-1 mt-1">
              {executeNavigation.map((item) => {
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
          )}
        </div>
      </nav>

      {/* Data Status */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">Data Status</span>
        </div>
        <div className="space-y-2 text-xs">
          <DataStatusRow
            label="Network"
            count={dataStatus?.network_rows || 0}
            loaded={dataStatus?.network_loaded || false}
            lastUpdate={feeds.flights.lastUpdate}
          />
          <DataStatusRow
            label="Fleet"
            count={dataStatus?.fleet_rows || 0}
            unit="aircraft"
            loaded={dataStatus?.fleet_loaded || false}
            lastUpdate={feeds.flights.lastUpdate}
          />
          <DataStatusRow
            label="Crew"
            count={dataStatus?.crew_rows || 0}
            unit="members"
            loaded={dataStatus?.crew_loaded || false}
            lastUpdate={feeds.bookings.lastUpdate}
          />
          <DataStatusRow
            label="MRO"
            count={dataStatus?.mro_rows || 0}
            unit="orders"
            loaded={dataStatus?.mro_loaded || false}
            lastUpdate={feeds.events.lastUpdate}
          />
        </div>
      </div>

      {/* Security Badge */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="w-4 h-4 text-emerald-500" />
          <div>
            <div className="text-emerald-400 font-medium">SOC 2 Compliant</div>
            <div className="text-slate-600">Data never leaves your environment</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * DataStatusRow - Single row in the data status section
 */
function DataStatusRow({
  label,
  count,
  unit = 'rows',
  loaded,
  lastUpdate,
}: {
  label: string;
  count: number;
  unit?: string;
  loaded: boolean;
  lastUpdate: Date | null;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={loaded ? 'text-emerald-400' : 'text-slate-600'}>
          {count.toLocaleString()} {count === 1 ? unit.replace(/s$/, '') : unit}
        </span>
        <LiveDot lastUpdate={lastUpdate} isConnected={loaded} />
      </div>
    </div>
  );
}

export default Sidebar;
