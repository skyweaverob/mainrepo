'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { NetworkView } from '@/components/NetworkView';
import { FleetView } from '@/components/FleetView';
import { CrewView } from '@/components/CrewView';
import { MROView } from '@/components/MROView';
import { ScenarioView } from '@/components/ScenarioView';
import IntelligenceView from '@/components/IntelligenceView';
import BookingCurveView from '@/components/BookingCurveView';
import { useAppStore } from '@/lib/store';
import * as api from '@/lib/api';

export default function Home() {
  const { activeView, dataStatus, setDataStatus } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const status = await api.getStatus();
        setDataStatus(status);
      } catch (err) {
        setError('Failed to connect to backend. Make sure the API server is running.');
        console.error('Failed to fetch status:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, [setDataStatus]);

  const renderView = () => {
    switch (activeView) {
      case 'network':
        return <NetworkView />;
      case 'intelligence':
        return (
          <div className="h-full overflow-auto p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Network Intelligence</h2>
            <IntelligenceView />
          </div>
        );
      case 'booking':
        return (
          <div className="h-full overflow-auto p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Booking Curve Analysis</h2>
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
        return <ScenarioView />;
      default:
        return <NetworkView />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-400">Connecting to SkyWeave...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a]">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Connection Error</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <div className="text-left bg-slate-800 rounded-lg p-4 text-sm">
            <p className="text-slate-300 mb-2">To start the backend server:</p>
            <code className="block text-blue-400 font-mono text-xs p-2 bg-slate-900 rounded">
              cd skyweave/backend<br />
              source venv/bin/activate<br />
              uvicorn main:app --reload --port 8000
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <Sidebar dataStatus={dataStatus} />
      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>
    </div>
  );
}
