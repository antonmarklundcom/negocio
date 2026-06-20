'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_TILES } from '@/lib/config';

/** Single-location map for the business detail page (§6.1). Keyless tiles. */
export function LocationMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_TILES,
      center: [lng, lat],
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const el = makePin();
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);

    return () => map.remove();
  }, [lat, lng, name]);

  return <div ref={ref} className="h-[180px] w-full md:h-[220px]" aria-label={`Mapa de ${name}`} />;
}

function makePin(): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="32" height="32" fill="#C2643E" stroke="#fff" stroke-width="1.5"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.4" fill="#fff"/></svg>';
  el.style.transform = 'translateY(-6px)';
  return el;
}
