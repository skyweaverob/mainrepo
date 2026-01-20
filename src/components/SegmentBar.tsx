'use client';

import { SEGMENT_COLORS, SEGMENT_LABELS, SegmentType } from '@/types';

interface SegmentBarProps {
  segments: Record<string, number>;
  height?: number;
  showLabels?: boolean;
  showPercentages?: boolean;
}

export function SegmentBar({
  segments,
  height = 24,
  showLabels = true,
  showPercentages = true
}: SegmentBarProps) {
  const segmentOrder: SegmentType[] = ['vfr', 'leisure', 'cruise', 'business', 'other'];

  // Filter to only segments with values > 0
  const activeSegments = segmentOrder.filter(s => (segments[s] || 0) > 0.01);

  return (
    <div className="w-full">
      <div
        className="w-full flex rounded-md overflow-hidden"
        style={{ height }}
      >
        {activeSegments.map((segment) => {
          const value = segments[segment] || 0;
          const percentage = value * 100;

          return (
            <div
              key={segment}
              className="relative group transition-all hover:opacity-90"
              style={{
                width: `${percentage}%`,
                backgroundColor: SEGMENT_COLORS[segment],
              }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                {SEGMENT_LABELS[segment]}: {percentage.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {showLabels && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {activeSegments.map((segment) => {
            const value = segments[segment] || 0;
            const percentage = value * 100;

            return (
              <div key={segment} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: SEGMENT_COLORS[segment] }}
                />
                <span className="text-slate-400">{SEGMENT_LABELS[segment]}</span>
                {showPercentages && (
                  <span className="text-slate-300 font-medium">{percentage.toFixed(0)}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
