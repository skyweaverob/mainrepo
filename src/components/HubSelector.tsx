'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface HubSelectorProps {
  hubs: Array<{ name: string; flights: number; pax: number }>;
  selectedHub: string | null;
  onSelect: (hub: string | null) => void;
}

export function HubSelector({ hubs, selectedHub, onSelect }: HubSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedHubData = hubs.find(h => h.name === selectedHub);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
      >
        <span className="text-sm text-slate-300">
          {selectedHub ? (
            <>
              <span className="font-medium text-slate-100">{selectedHub}</span>
              <span className="text-slate-500 ml-2">
                {selectedHubData?.flights.toLocaleString()} flights
              </span>
            </>
          ) : (
            'All Hubs'
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700 transition-colors ${
              !selectedHub ? 'bg-slate-700' : ''
            }`}
          >
            <span className="text-sm text-slate-100">All Hubs</span>
            {!selectedHub && <Check className="w-4 h-4 text-blue-400" />}
          </button>

          <div className="border-t border-slate-700" />

          {hubs.map((hub) => (
            <button
              key={hub.name}
              onClick={() => {
                onSelect(hub.name);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700 transition-colors ${
                selectedHub === hub.name ? 'bg-slate-700' : ''
              }`}
            >
              <div>
                <span className="text-sm font-medium text-slate-100">{hub.name}</span>
                <span className="text-xs text-slate-500 ml-2">
                  {hub.flights.toLocaleString()} flights
                </span>
              </div>
              {selectedHub === hub.name && <Check className="w-4 h-4 text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
