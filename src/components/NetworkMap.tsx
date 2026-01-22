'use client';

import { useMemo, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { formatCurrency, formatRASM } from '@/lib/formatters';

// Real hub coordinates (lat/lng)
const HUB_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  DTW: { lat: 42.2124, lng: -83.3534, name: 'Detroit' },
  MCO: { lat: 28.4294, lng: -81.3089, name: 'Orlando' },
  FLL: { lat: 26.0726, lng: -80.1527, name: 'Fort Lauderdale' },
  LAS: { lat: 36.0840, lng: -115.1537, name: 'Las Vegas' },
  EWR: { lat: 40.6895, lng: -74.1745, name: 'Newark' },
  // Additional airports for routes
  LAX: { lat: 33.9416, lng: -118.4085, name: 'Los Angeles' },
  DEN: { lat: 39.8561, lng: -104.6737, name: 'Denver' },
  DFW: { lat: 32.8998, lng: -97.0403, name: 'Dallas' },
  ATL: { lat: 33.6407, lng: -84.4277, name: 'Atlanta' },
  ORD: { lat: 41.9742, lng: -87.9073, name: 'Chicago' },
  BOS: { lat: 42.3656, lng: -71.0096, name: 'Boston' },
  MIA: { lat: 25.7959, lng: -80.2870, name: 'Miami' },
  SEA: { lat: 47.4502, lng: -122.3088, name: 'Seattle' },
  SFO: { lat: 37.6213, lng: -122.3790, name: 'San Francisco' },
  PHX: { lat: 33.4373, lng: -112.0078, name: 'Phoenix' },
  MSP: { lat: 44.8848, lng: -93.2223, name: 'Minneapolis' },
};

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%',
};

// Center of continental US
const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795,
};

// Map styling for McKinsey theme
const mapStyles = [
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9d6e3' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }, { weight: 1 }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#94a3b8' }, { weight: 2 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];

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

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBaV9fbmuAegG_3v5STO-JPfaPnYEpTr_o';

/**
 * NetworkMap - Interactive Google Map showing hub health and route flows
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
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Get hub color based on RASM
  const getHubColor = (hub: HubData) => {
    if (hub.hasAlert) return '#f59e0b'; // amber for alerts
    if (hub.rasmCents >= 12) return '#10b981'; // green for good RASM
    if (hub.rasmCents >= 10) return '#22c55e'; // lighter green
    if (hub.rasmCents >= 8) return '#f59e0b'; // amber for moderate
    return '#ef4444'; // red for poor
  };

  // Calculate circle scale based on revenue
  const maxRevenue = Math.max(...hubs.map((h) => h.dailyRevenue), 1);
  const getMarkerScale = (revenue: number) => {
    const normalized = revenue / maxRevenue;
    return 0.8 + normalized * 0.7; // Scale between 0.8 and 1.5
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

  // Map options
  const mapOptions = useMemo(
    () => ({
      styles: mapStyles,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      minZoom: 3,
      maxZoom: 8,
    }),
    []
  );

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
        <div className="text-center text-slate-500">
          <p className="font-medium">Map failed to load</p>
          <p className="text-xs mt-1">Check API key configuration</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#002855] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: height }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={4}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* Route lines */}
        {showRoutes &&
          visibleRoutes.map((route, i) => {
            const origin = HUB_COORDINATES[route.origin];
            const dest = HUB_COORDINATES[route.destination];
            if (!origin || !dest) return null;

            return (
              <Polyline
                key={`route-${i}`}
                path={[
                  { lat: origin.lat, lng: origin.lng },
                  { lat: dest.lat, lng: dest.lng },
                ]}
                options={{
                  strokeColor: route.isProfitable ? '#10b981' : '#ef4444',
                  strokeOpacity: 0.5,
                  strokeWeight: 2,
                  geodesic: true,
                }}
              />
            );
          })}

        {/* Hub markers */}
        {hubs.map((hub) => {
          const coords = HUB_COORDINATES[hub.code];
          if (!coords) return null;

          const color = getHubColor(hub);
          const scale = getMarkerScale(hub.dailyRevenue);
          const isSelected = selectedHub === hub.code;

          return (
            <Marker
              key={hub.code}
              position={{ lat: coords.lat, lng: coords.lng }}
              onClick={() => onHubClick?.(hub.code)}
              onMouseOver={() => setHoveredHub(hub.code)}
              onMouseOut={() => setHoveredHub(null)}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: isSelected ? '#002855' : '#ffffff',
                strokeWeight: isSelected ? 3 : 2,
                scale: 12 * scale,
              }}
              label={{
                text: hub.code,
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
            />
          );
        })}

        {/* Info window for hovered hub */}
        {hoveredHub && HUB_COORDINATES[hoveredHub] && (
          <InfoWindow
            position={{
              lat: HUB_COORDINATES[hoveredHub].lat,
              lng: HUB_COORDINATES[hoveredHub].lng,
            }}
            onCloseClick={() => setHoveredHub(null)}
            options={{
              pixelOffset: new google.maps.Size(0, -20),
              disableAutoPan: true,
            }}
          >
            <HubTooltipContent
              hub={hubs.find((h) => h.code === hoveredHub)!}
              name={HUB_COORDINATES[hoveredHub].name}
            />
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-slate-200 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600">High RASM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-600">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-slate-600">Low RASM</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-slate-500 shadow-sm border border-slate-200">
        Click a hub for details
      </div>
    </div>
  );
}

/**
 * HubTooltipContent - Content for the info window
 */
function HubTooltipContent({ hub, name }: { hub: HubData; name: string }) {
  if (!hub) return null;

  return (
    <div className="p-1 min-w-[150px]">
      <div className="text-sm font-bold text-slate-800 mb-2">
        {hub.code} - {name}
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Daily Revenue:</span>
          <span className="text-slate-800 font-medium">
            {formatCurrency(hub.dailyRevenue, { compact: true })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">RASM:</span>
          <span className="text-slate-800 font-medium">{formatRASM(hub.rasmCents)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Routes:</span>
          <span className="text-slate-800 font-medium">{hub.routeCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Flights/day:</span>
          <span className="text-slate-800 font-medium">{hub.dailyFlights}</span>
        </div>
      </div>
      {hub.hasAlert && (
        <div className="mt-2 text-xs text-amber-600 font-medium">⚠ Alert: Review required</div>
      )}
    </div>
  );
}

export default NetworkMap;
