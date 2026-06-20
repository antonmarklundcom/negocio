'use client';

import dynamic from 'next/dynamic';

/** Client wrapper so the detail page (a server component) can defer MapLibre. */
const LocationMap = dynamic(() => import('./LocationMap').then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="h-[180px] w-full animate-pulse bg-cream2 md:h-[220px]" />,
});

export function LocationMapLazy(props: { lat: number; lng: number; name: string }) {
  return <LocationMap {...props} />;
}
