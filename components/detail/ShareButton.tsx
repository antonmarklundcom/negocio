'use client';

import { useState } from 'react';
import { Share } from '@/components/icons';

/**
 * Share a listing (ROADMAP W1-1). `navigator.share` on the phones that have it,
 * clipboard everywhere else — and if both are unavailable or denied the button
 * says so rather than silently doing nothing.
 *
 * The URL is built from `location.href` at click time, not passed in from the
 * server, so it carries whatever the visitor is actually looking at.
 */
export function ShareButton({ name, className = '' }: { name: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function onClick() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, url });
        setState('idle');
        return;
      } catch (err) {
        // A cancelled share sheet is not a failure — do not fall through to the
        // clipboard and tell the visitor we copied something they declined.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('failed');
      setTimeout(() => setState('idle'), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink2 transition-colors hover:border-blue hover:text-blue ${className}`}
    >
      <Share size={15} />
      {state === 'copied' ? 'Link copiado' : state === 'failed' ? 'No se pudo copiar' : 'Compartir'}
    </button>
  );
}
