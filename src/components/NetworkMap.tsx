'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, formatRASM } from '@/lib/formatters';

// Hub coordinates (approximate US map positions)
const HUB_COORDINATES: Record<string, { x: number; y: number; name: string }> = {
  DTW: { x: 580, y: 180, name: 'Detroit' },
  MCO: { x: 620, y: 380, name: 'Orlando' },
  FLL: { x: 640, y: 420, name: 'Fort Lauderdale' },
  LAS: { x: 180, y: 240, name: 'Las Vegas' },
  EWR: { x: 680, y: 170, name: 'Newark' },
  // Additional airports for routes
  LAX: { x: 120, y: 300, name: 'Los Angeles' },
  DEN: { x: 300, y: 230, name: 'Denver' },
  DFW: { x: 380, y: 330, name: 'Dallas' },
  ATL: { x: 560, y: 320, name: 'Atlanta' },
  ORD: { x: 520, y: 180, name: 'Chicago' },
  BOS: { x: 720, y: 140, name: 'Boston' },
  MIA: { x: 640, y: 440, name: 'Miami' },
  SEA: { x: 130, y: 100, name: 'Seattle' },
  SFO: { x: 90, y: 220, name: 'San Francisco' },
  PHX: { x: 200, y: 320, name: 'Phoenix' },
  MSP: { x: 440, y: 140, name: 'Minneapolis' },
};

interface HubData {
  code: string;
  dailyRevenue: number;
  rasmCents: number;
  isProfitable: boolean;
  hasAlert: boolean;
  routeCount: number;
  dailyFlights: number;
}

interface RouteFlow {
  origin: string;
  destination: string;
  dailyRevenue: number;
  dailyPassengers: number;
  isProfitable: boolean;
}

interface NetworkMapProps {
  hubs: HubData[];
  routes?: RouteFlow[];
  selectedHub?: string | null;
  onHubClick?: (hubCode: string) => void;
  onRouteClick?: (origin: string, destination: string) => void;
  showRoutes?: boolean;
  height?: number;
}

/**
 * NetworkMap - Interactive US map showing hub health and route flows
 *
 * Features:
 * - Hub circles sized by daily revenue
 * - Circle color reflects profitability
 * - Flow lines between hubs (thickness = passengers, color = profitability)
 * - Click hub to drill down
 * - Hover for quick stats
 */
export function NetworkMap({
  hubs,
  routes = [],
  selectedHub,
  onHubClick,
  onRouteClick,
  showRoutes = true,
  height = 400,
}: NetworkMapProps) {
  const [hoveredHub, setHoveredHub] = useState<string | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<{ origin: string; dest: string } | null>(null);

  // Calculate circle sizes based on revenue (normalized)
  const maxRevenue = Math.max(...hubs.map((h) => h.dailyRevenue), 1);
  const minRadius = 15;
  const maxRadius = 40;

  const getHubRadius = (revenue: number) => {
    const normalized = revenue / maxRevenue;
    return minRadius + normalized * (maxRadius - minRadius);
  };

  // Get hub color based on profitability/RASM
  const getHubColor = (hub: HubData) => {
    if (hub.hasAlert) return '#f59e0b'; // amber for alerts
    if (hub.rasmCents >= 12) return '#10b981'; // green for good RASM
    if (hub.rasmCents >= 10) return '#22c55e'; // lighter green
    if (hub.rasmCents >= 8) return '#f59e0b'; // amber for moderate
    return '#ef4444'; // red for poor
  };

  // Get route line properties
  const getRouteLineWidth = (passengers: number) => {
    const maxPax = Math.max(...routes.map((r) => r.dailyPassengers), 1);
    const normalized = passengers / maxPax;
    return 1 + normalized * 4; // 1-5px
  };

  // Filter routes to only show those between visible hubs
  const visibleRoutes = useMemo(() => {
    const hubCodes = new Set(hubs.map((h) => h.code));
    return routes.filter(
      (r) =>
        (hubCodes.has(r.origin) || HUB_COORDINATES[r.origin]) &&
        (hubCodes.has(r.destination) || HUB_COORDINATES[r.destination])
    );
  }, [hubs, routes]);

  return (
    <div className="relative bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <svg
        viewBox="0 0 800 500"
        className="w-full"
        style={{ height }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="800" height="500" fill="url(#mapGradient)" />

        {/* Simplified US outline (decorative) */}
        <path
          d="M 100 150 Q 150 100 300 100 L 700 120 Q 750 130 750 200 L 740 400 Q 700 450 600 450 L 200 400 Q 100 350 100 250 Z"
          fill="none"
          stroke="#334155"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* Route lines */}
        {showRoutes &&
          visibleRoutes.map((route, i) => {
            const origin = HUB_COORDINATES[route.origin];
            const dest = HUB_COORDINATES[route.destination];
            if (!origin || !dest) return null;

            const isHovered =
              hoveredRoute?.origin === route.origin &&
              hoveredRoute?.dest === route.destination;

            // Curved path for visual appeal
            const midX = (origin.x + dest.x) / 2;
            const midY = (origin.y + dest.y) / 2 - 30;
            const path = `M ${origin.x} ${origin.y} Q ${midX} ${midY} ${dest.x} ${dest.y}`;

            return (
              <g key={`route-${i}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={route.isProfitable ? '#10b981' : '#ef4444'}
                  strokeWidth={getRouteLineWidth(route.dailyPassengers)}
                  opacity={isHovered ? 1 : 0.4}
                  className="route-line cursor-pointer"
                  onMouseEnter={() =>
                    setHoveredRoute({ origin: route.origin, dest: route.destination })
                  }
                  onMouseLeave={() => setHoveredRoute(null)}
                  onClick={() => onRouteClick?.(route.origin, route.destination)}
                />
              </g>
            );
          })}

        {/* Hub circles */}
        {hubs.map((hub) => {
          const coords = HUB_COORDINATES[hub.code];
          if (!coords) return null;

          const radius = getHubRadius(hub.dailyRevenue);
          const color = getHubColor(hub);
          const isSelected = selectedHub === hub.code;
          const isHovered = hoveredHub === hub.code;

          return (
            <g
              key={hub.code}
              className="hub-node"
              onClick={() => onHubClick?.(hub.code)}
              onMouseEnter={() => setHoveredHub(hub.code)}
              onMouseLeave={() => setHoveredHub(null)}
            >
              {/* Outer glow for selected */}
              {isSelected && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={radius + 8}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  opacity="0.6"
                />
              )}

              {/* Alert ring */}
              {hub.hasAlert && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={radius + 4}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  opacity="0.8"
                  className="animate-pulse"
                />
              )}

              {/* Main circle */}
              <circle
                cx={coords.x}
                cy={coords.y}
                r={radius}
                fill={color}
                opacity={isHovered || isSelected ? 1 : 0.8}
                filter={isHovered ? 'url(#glow)' : undefined}
                style={{
                  transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                  transformOrigin: `${coords.x}px ${coords.y}px`,
                  transition: 'transform 0.2s ease',
                }}
              />

              {/* Hub code label */}
              <text
                x={coords.x}
                y={coords.y + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="white"
                className="pointer-events-none"
              >
                {hub.code}
              </text>

              {/* Revenue label below */}
              <text
                x={coords.x}
                y={coords.y + radius + 14}
                textAnchor="middle"
                fontSize="10"
                fill="#94a3b8"
                className="pointer-events-none"
              >
                {formatCurrency(hub.dailyRevenue, { compact: true })}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredHub && (
        <HubTooltip
          hub={hubs.find((h) => h.code === hoveredHub)!}
          coords={HUB_COORDINATES[hoveredHub]}
        />
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-400">High RASM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-400">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-slate-400">Low RASM</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 text-xs text-slate-500">
        Click a hub to view details
      </div>
    </div>
  );
}

/**
 * HubTooltip - Popup showing hub details on hover
 */
function HubTooltip({
  hub,
  coords,
}: {
  hub: HubData;
  coords: { x: number; y: number; name: string };
}) {
  return (
    <div
      className="absolute bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl pointer-events-none z-10"
      style={{
        left: `${(coords.x / 800) * 100}%`,
        top: `${(coords.y / 500) * 100 - 15}%`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="text-sm font-bold text-white mb-1">
        {hub.code} - {coords.name}
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Daily Revenue:</span>
          <span className="text-white font-medium">
            {formatCurrency(hub.dailyRevenue, { compact: true })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">RASM:</span>
          <span className="text-white font-medium">{formatRASM(hub.rasmCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Routes:</span>
          <span className="text-white font-medium">{hub.routeCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Flights/day:</span>
          <span className="text-white font-medium">{hub.dailyFlights}</span>
        </div>
      </div>
      {hub.hasAlert && (
        <div className="mt-2 text-xs text-amber-400">⚠ Alert: Review required</div>
      )}
    </div>
  );
}

export default NetworkMap;
