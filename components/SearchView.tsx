'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Listing } from '@/lib/types';
import { ListingCard } from './ListingCard';

// MapLibre is heavy; only load it when the visitor switches to the map view.
const ResultsMap = dynamic(() => import('./ResultsMap').then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-card bg-cream2 md:h-[600px]" />,
});

/**
 * Client wrapper that owns the list/map toggle and pin↔card highlight (§6.2).
 * The listing data is fetched on the server and passed in, so the initial list
 * is fully SSR'd and indexable; only the toggle and map are interactive.
 */
export function SearchView({ listings }: { listings: Listing[] }) {
  const [view, setView] = useState<'lista' | 'mapa'>('lista');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasGeo = listings.some((l) => l.lat != null && l.lng != null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-[10px] border border-line bg-paper p-[3px]">
          {(['lista', 'mapa'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-[7px] px-4 py-1.5 text-[13px] font-bold capitalize transition-colors ${
                view === v ? 'bg-ink text-white' : 'text-ink2'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'mapa' && hasGeo ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="order-2 lg:order-1">
            <ResultsMap listings={listings} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="order-1 flex flex-col gap-3 lg:order-2 lg:max-h-[600px] lg:overflow-y-auto">
            {listings.map((l) => (
              <div
                key={l.id}
                onMouseEnter={() => setSelectedId(l.id)}
                className={`rounded-card transition-shadow ${
                  selectedId === l.id ? 'ring-2 ring-terra' : ''
                }`}
              >
                <ListingCard listing={l} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
