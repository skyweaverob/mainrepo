'use client';

import { useEffect, useState } from 'react';
import { useLiveDataStore } from '@/lib/liveDataStore';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

/**
 * ConnectionStatus - Shows connection state at top of screen
 *
 * States:
 * - Connected: Green bar (fades after 3s)
 * - Reconnecting: Yellow pulsing bar (always visible)
 * - Disconnected: Red persistent bar with message
 * - Data Stale: Orange bar warning
 */
export function ConnectionStatus() {
  const { isConnected, feeds, connectionAttempts } = useLiveDataStore();
  const [showConnected, setShowConnected] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  // Check if any feed is stale (>5 min old)
  const isAnyStale = Object.values(feeds).some((f) => {
    if (!f.lastUpdate) return false;
    const ageMs = Date.now() - f.lastUpdate.getTime();
    return ageMs > 5 * 60 * 1000; // 5 minutes
  });

  // Show green bar briefly when reconnecting
  useEffect(() => {
    if (isConnected && wasDisconnected) {
      setShowConnected(true);
      const timer = setTimeout(() => setShowConnected(false), 3000);
      return () => clearTimeout(timer);
    }
    setWasDisconnected(!isConnected);
  }, [isConnected, wasDisconnected]);

  // Reconnecting state
  const isReconnecting = !isConnected && connectionAttempts > 0;

  // Don't show anything in normal state
  if (isConnected && !showConnected && !isAnyStale) {
    return null;
  }

  return (
    <>
      {/* Thin status bar at very top */}
      <div
        className={`
          connection-bar
          ${showConnected ? 'connection-bar-connected' : ''}
          ${isReconnecting ? 'connection-bar-reconnecting' : ''}
          ${!isConnected && !isReconnecting ? 'connection-bar-disconnected' : ''}
        `}
      />

      {/* Message bar for disconnected/stale states */}
      {(!isConnected || isAnyStale) && (
        <div
          className={`
            fixed top-[124px] left-0 right-0 z-40 py-2 px-4
            flex items-center justify-center gap-2
            text-sm font-medium
            ${!isConnected ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}
          `}
        >
          {!isConnected ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span>
                Connection lost
                {isReconnecting && ` - Retrying (attempt ${connectionAttempts})...`}
              </span>
            </>
          ) : isAnyStale ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              <span>Some data may be outdated - last update more than 5 minutes ago</span>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

/**
 * ConnectionIndicator - Compact indicator for use in sidebars etc.
 */
export function ConnectionIndicator() {
  const { isConnected, connectionAttempts } = useLiveDataStore();

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs
        ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}
      `}
    >
      {isConnected ? (
        <>
          <Wifi className="w-3 h-3" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>
            {connectionAttempts > 0 ? `Reconnecting (${connectionAttempts})` : 'Disconnected'}
          </span>
        </>
      )}
    </div>
  );
}

export default ConnectionStatus;
