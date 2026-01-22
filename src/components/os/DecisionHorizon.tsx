'use client';

import { Clock, Calendar, CalendarDays, CalendarRange } from 'lucide-react';

export type HorizonType = 'T0_T7' | 'T7_T30' | 'T30_T120' | 'SEASONAL';

interface HorizonConfig {
  id: HorizonType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const HORIZONS: HorizonConfig[] = [
  {
    id: 'T0_T7',
    label: 'Tactical',
    shortLabel: 'T-0 to T-7',
    description: 'Next 7 days - Immediate actions',
    icon: Clock,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
  {
    id: 'T7_T30',
    label: 'Operational',
    shortLabel: 'T-7 to T-30',
    description: 'Week 2-4 - Schedule adjustments',
    icon: Calendar,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'T30_T120',
    label: 'Planning',
    shortLabel: 'T-30 to T-120',
    description: 'Month 2-4 - Network planning',
    icon: CalendarDays,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'SEASONAL',
    label: 'Strategic',
    shortLabel: 'Seasonal',
    description: '120+ days - Long-term strategy',
    icon: CalendarRange,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
];

interface DecisionHorizonProps {
  selectedHorizon: HorizonType;
  onHorizonChange: (horizon: HorizonType) => void;
  compact?: boolean;
  showDescriptions?: boolean;
}

/**
 * DecisionHorizon - Select the decision time horizon
 * Different horizons unlock different types of decisions and constraints
 */
export function DecisionHorizon({
  selectedHorizon,
  onHorizonChange,
  compact = false,
  showDescriptions = true,
}: DecisionHorizonProps) {
  const selectedConfig = HORIZONS.find((h) => h.id === selectedHorizon)!;

  if (compact) {
    return (
      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
        {HORIZONS.map((horizon) => {
          const Icon = horizon.icon;
          const isSelected = horizon.id === selectedHorizon;
          return (
            <button
              key={horizon.id}
              onClick={() => onHorizonChange(horizon.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? `${horizon.bgColor} ${horizon.color} border`
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
              title={horizon.description}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{horizon.shortLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#002855] to-[#003d7a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            Decision Horizon
          </span>
        </div>
        <span className={`text-xs ${selectedConfig.color} bg-white px-2 py-0.5 rounded font-medium`}>
          {selectedConfig.label}
        </span>
      </div>

      {/* Horizon Selector */}
      <div className="p-3">
        <div className="grid grid-cols-4 gap-2">
          {HORIZONS.map((horizon) => {
            const Icon = horizon.icon;
            const isSelected = horizon.id === selectedHorizon;
            return (
              <button
                key={horizon.id}
                onClick={() => onHorizonChange(horizon.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? `${horizon.bgColor} ${horizon.color}`
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <div className="text-center">
                  <div className="text-xs font-bold">{horizon.shortLabel}</div>
                  {showDescriptions && (
                    <div className="text-[10px] mt-0.5 opacity-75">{horizon.label}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Horizon Description */}
        <div className={`mt-3 p-2 rounded ${selectedConfig.bgColor} ${selectedConfig.color}`}>
          <p className="text-xs">{selectedConfig.description}</p>
        </div>
      </div>
    </div>
  );
}

export default DecisionHorizon;
