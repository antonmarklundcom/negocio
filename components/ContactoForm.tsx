'use client';

import { useState } from 'react';
import { submitLead } from '@/lib/lead-client';

const field = 'w-full rounded-[10px] border border-line bg-cream px-3.5 py-3 text-[15px] text-ink outline-none focus:border-blue';

/** General contact form → {source:'contacto'} (§6.7). */
export function ContactoForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus('sending');
    const ok = await submitLead({
      source: 'contacto',
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      message: String(fd.get('message') ?? ''),
    });
    setStatus(ok ? 'sent' : 'error');
    if (ok) e.currentTarget.reset();
  }

  if (status === 'sent') {
    return (
      <div className="rounded-card border border-line bg-wabg p-6 text-center">
        <p className="font-serif text-xl font-semibold text-wa">¡Mensaje enviado!</p>
        <p className="mt-2 text-sm text-ink2">Te respondemos a la brevedad.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="name" required placeholder="Tu nombre" className={field} />
      <input name="email" type="email" required placeholder="Tu email" className={field} />
      <textarea name="message" required placeholder="¿En qué te ayudamos?" rows={5} className={`${field} resize-none`} />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-card bg-blue py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-blued disabled:opacity-60"
      >
        {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
      </button>
      {status === 'error' && (
        <p className="text-center text-sm text-terra">No se pudo enviar. Probá de nuevo.</p>
      )}
    </form>
  );
}
