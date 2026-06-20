'use client';

import { useState } from 'react';
import { submitLead } from '@/lib/lead-client';
import { CATEGORIES } from '@/lib/categories';
import { CITIES } from '@/lib/cities';

const field = 'w-full rounded-[10px] border border-line bg-cream px-3.5 py-3 text-[15px] text-ink outline-none focus:border-blue';

/** Business-acquisition lead form → {source:'sumate'} (§6.7). */
export function SumateForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus('sending');
    const ok = await submitLead({
      source: 'sumate',
      businessName: String(fd.get('businessName') ?? ''),
      category: String(fd.get('category') ?? ''),
      city: String(fd.get('city') ?? ''),
      contactName: String(fd.get('contactName') ?? ''),
      phone: String(fd.get('phone') ?? ''),
    });
    setStatus(ok ? 'sent' : 'error');
    if (ok) e.currentTarget.reset();
  }

  if (status === 'sent') {
    return (
      <div className="rounded-card border border-line bg-wabg p-6 text-center">
        <p className="font-serif text-xl font-semibold text-wa">¡Gracias! Recibimos tus datos.</p>
        <p className="mt-2 text-sm text-ink2">Nuestro equipo te va a contactar para activar tu perfil.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="businessName" required placeholder="Nombre del negocio" className={field} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="category" required defaultValue="" className={field}>
          <option value="" disabled>
            Rubro
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.labelPlural}
            </option>
          ))}
        </select>
        <select name="city" required defaultValue="" className={field}>
          <option value="" disabled>
            Ciudad
          </option>
          {CITIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <input name="contactName" required placeholder="Tu nombre" className={field} />
      <input name="phone" required placeholder="Teléfono / WhatsApp" className={field} />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-card bg-blue py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-blued disabled:opacity-60"
      >
        {status === 'sending' ? 'Enviando…' : 'Sumar mi negocio'}
      </button>
      {status === 'error' && (
        <p className="text-center text-sm text-terra">No se pudo enviar. Revisá los datos e intentá de nuevo.</p>
      )}
    </form>
  );
}
