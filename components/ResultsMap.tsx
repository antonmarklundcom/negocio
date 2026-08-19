'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Listing } from '@/lib/types';
import { MAP_TILES } from '@/lib/config';

/** Multi-pin results map (§6.2). Clicking a pin notifies the parent to highlight
 *  the matching card. */
export function ResultsMap({
  listings,
  selectedId,
  onSelect,
}: {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (!ref.current) return;
    const pts = listings.filter((l) => l.lat != null && l.lng != null);
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_TILES,
      center: pts[0] ? [pts[0].lng!, pts[0].lat!] : [-57.5759, -25.3],
      zoom: 11,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const bounds = new maplibregl.LngLatBounds();
    for (const l of pts) {
      const el = makePin();
      el.addEventListener('click', () => onSelect(l.id));
      const marker = new maplibregl.Marker({ element: el }).setLngLat([l.lng!, l.lat!]).addTo(map);
      markers.current.set(l.id, marker);
      bounds.extend([l.lng!, l.lat!]);
    }
    if (pts.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 14 });

    // Copy the ref into the effect's own scope: by the time cleanup runs,
    // `markers.current` may already point at the next render's Map.
    const created = markers.current;
    return () => {
      created.clear();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings]);

  // Reflect selection by scaling the active pin.
  useEffect(() => {
    markers.current.forEach((m, id) => {
      m.getElement().style.transform =
        (id === selectedId ? 'scale(1.3) ' : '') + 'translateY(-6px)';
      m.getElement().style.zIndex = id === selectedId ? '2' : '1';
    });
    const sel = selectedId ? listings.find((l) => l.id === selectedId) : null;
    if (sel?.lat != null && sel?.lng != null && mapRef.current) {
      mapRef.current.easeTo({ center: [sel.lng, sel.lat], duration: 400 });
    }
  }, [selectedId, listings]);

  return <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-card border border-line md:h-[600px]" />;
}

function makePin(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.style.transform = 'translateY(-6px)';
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="#C2643E" stroke="#fff" stroke-width="1.5"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.2" fill="#fff"/></svg>';
  return el;
}
