'use client';

import { useState } from 'react';
import { submitLead } from '@/lib/lead-client';
import { Honeypot } from './Honeypot';
import { Send } from './icons';

/**
 * Listing message capture → POST /api/v1/leads {source:'listing_message'} (§6.7).
 * `inline` = compact input + send icon (mobile contact card).
 * `textarea` = labelled textarea + button (desktop rail).
 */
export function ListingMessageForm({
  listingId,
  slug,
  variant = 'inline',
}: {
  listingId: string;
  slug: string;
  variant?: 'inline' | 'textarea';
}) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus('sending');
    const hp = new FormData(e.currentTarget).get('hp');
    const ok = await submitLead(
      { source: 'listing_message', listingId, slug, message: message.trim() },
      typeof hp === 'string' ? hp : '',
    );
    setStatus(ok ? 'sent' : 'error');
    if (ok) setMessage('');
  }

  if (status === 'sent') {
    return (
      <p className="rounded-xl bg-wabg px-3 py-3 text-sm font-semibold text-wa">
        ¡Listo! Tu consulta fue enviada. Te van a responder pronto.
      </p>
    );
  }

  if (variant === 'textarea') {
    return (
      <form onSubmit={onSubmit}>
        <Honeypot />
        <div className="mb-2 text-[13px] font-bold">Enviá una consulta</div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hola, quería consultar por…"
          className="mb-2.5 h-[74px] w-full resize-none rounded-xl border border-line bg-cream px-3 py-2.5 text-[13px] text-ink outline-none focus:border-blue"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full rounded-xl bg-blue py-3 text-sm font-bold text-white transition-colors hover:bg-blued disabled:opacity-60"
        >
          {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
        </button>
        {status === 'error' && <p className="mt-2 text-xs text-terra">No se pudo enviar. Probá de nuevo.</p>}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Honeypot />
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribí tu consulta…"
        className="flex-1 rounded-[10px] border border-line bg-cream px-3 py-2.5 text-[13px] text-ink outline-none focus:border-blue"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        aria-label="Enviar consulta"
        className="flex items-center rounded-[10px] bg-blue px-3.5 text-white transition-colors hover:bg-blued disabled:opacity-60"
      >
        <Send size={18} />
      </button>
    </form>
  );
}
