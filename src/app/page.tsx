'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NetworkView } from '@/components/NetworkView';
import { FleetView } from '@/components/FleetView';
import { CrewView } from '@/components/CrewView';
import { MROView } from '@/components/MROView';
import { OperationsView } from '@/components/OperationsView';
import { AnalyticsView } from '@/components/AnalyticsView';
import IntelligenceView from '@/components/IntelligenceView';
import BookingCurveView from '@/components/BookingCurveView';
import { GlobalHeader } from '@/components/GlobalHeader';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { HubDetailView } from '@/components/HubDetailView';
import { OptimizationDemo } from '@/components/OptimizationDemo';
import { CrossDomainInsights } from '@/components/CrossDomainInsights';
import { ControlRoom } from '@/components/os/ControlRoom';
import { DemoView } from '@/components/DemoView';
import { DataView } from '@/components/DataView';
import { SimulateView } from '@/components/SimulateView';
import { useAppStore } from '@/lib/store';
import { useLiveDataStore } from '@/lib/liveDataStore';
import { useLiveData } from '@/hooks/useLiveData';
import * as api from '@/lib/api';

// Hub names mapping
const HUB_NAMES: Record<string, string> = {
  DTW: 'Detroit Metropolitan Airport',
  MCO: 'Orlando International Airport',
  FLL: 'Fort Lauderdale-Hollywood International',
  LAS: 'Harry Reid International Airport',
  EWR: 'Newark Liberty International',
  P2P: 'Point-to-Point Network',
};

export default function Home() {
  const { activeView, dataStatus, setDataStatus, selectedHub, setSelectedHub, setSelectedRoute } = useAppStore();
  const { setIsConnected } = useLiveDataStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingHubDetail, setViewingHubDetail] = useState<string | null>(null);

  // Initialize live data polling
  useLiveData({
    enabled: !loading && !error,
    onError: (feed, err) => {
      console.error(`Live data error for ${feed}:`, err);
    },
  });

  useEffect(() => {
    async function fetchStatus() {
      try {
        const status = await api.getStatus();
        setDataStatus(status);
        setIsConnected(true);
      } catch (err) {
        setError('Failed to connect to backend. Make sure the API server is running.');
        setIsConnected(false);
        console.error('Failed to fetch status:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, [setDataStatus, setIsConnected]);

  // Handle hub click from header
  const handleHubClick = (hubCode: string) => {
    if (hubCode === 'P2P') {
      // For P2P, just filter the network view
      setSelectedHub(hubCode);
      setViewingHubDetail(null);
    } else {
      setViewingHubDetail(hubCode);
    }
  };

  // Handle route click from hub detail
  const handleRouteClick = (origin: string, destination: string) => {
    setSelectedRoute({ origin, destination });
    // Could open a modal here
  };

  const renderView = () => {
    // If viewing hub detail, show that instead
    if (viewingHubDetail) {
      return (
        <HubDetailView
          hubCode={viewingHubDetail}
          hubName={HUB_NAMES[viewingHubDetail] || viewingHubDetail}
          onBack={() => setViewingHubDetail(null)}
          onRouteClick={handleRouteClick}
        />
      );
    }

    switch (activeView) {
      // Demo Mode - VC/Board presentation
      case 'demo':
        return <DemoView />;

      // OS-style Control Room - Primary Decision Interface
      case 'controlroom':
        return <ControlRoom onHubClick={handleHubClick} />;

      // Simulate - What-if scenario analysis
      case 'simulate':
        return <SimulateView />;

      // Data - Data health and platform status
      case 'data':
        return <DataView />;

      // Legacy views for backwards compatibility
      case 'network':
        return <NetworkView onHubClick={handleHubClick} />;

      case 'tradeoffs':
        return (
          <div className="h-full overflow-auto p-6 bg-slate-100">
            <div className="flex justify-center">
              <OptimizationDemo />
            </div>
          </div>
        );

      case 'operations':
        return <OperationsView dataStatus={dataStatus} />;

      case 'analytics':
        return <AnalyticsView />;

      // Legacy views for backwards compatibility
      case 'crossdomain':
        return <CrossDomainInsights />;
      case 'intelligence':
        return (
          <div className="h-full overflow-auto p-6">
            <IntelligenceView />
          </div>
        );
      case 'booking':
        return (
          <div className="h-full overflow-auto p-6">
            <BookingCurveView />
          </div>
        );
      case 'fleet':
        return <FleetView />;
      case 'crew':
        return <CrewView />;
      case 'mro':
        return <MROView />;
      case 'scenarios':
        return (
          <div className="h-full overflow-auto p-6">
            <h2 className="text-xl font-bold text-white mb-4">Scenarios</h2>
            <p className="text-slate-400">What-if analysis</p>
          </div>
        );

      default:
        return (
          <div className="h-full overflow-auto p-6 flex items-center justify-center">
            <OptimizationDemo />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#002855] border-t-transparent mx-auto mb-4" />
          <p className="text-slate-700 font-semibold">Connecting to SkyWeave...</p>
          <p className="text-xs text-slate-500 mt-2">
            Turn your schedule into a revenue instrument
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center max-w-md bg-white p-8 rounded-lg shadow-lg">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Connection Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="text-left bg-slate-50 rounded-lg p-4 text-sm border border-slate-200">
            <p className="text-slate-700 mb-2">To start the backend server:</p>
            <code className="block text-[#002855] font-mono text-xs p-2 bg-white rounded border border-slate-200">
              cd skyweave/backend<br />
              source venv/bin/activate<br />
              uvicorn main:app --reload --port 8000
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-[#002855] text-white rounded-lg hover:bg-[#001a3d] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Global Header (120px) */}
      <GlobalHeader
        onHubClick={handleHubClick}
        selectedHub={viewingHubDetail || selectedHub}
      />

      {/* Connection status bar */}
      <ConnectionStatus />

      {/* Main content area below header */}
      <div className="flex flex-1 pt-14 overflow-hidden">
        <Sidebar dataStatus={dataStatus} />
        <main className="flex-1 overflow-auto bg-slate-100">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
