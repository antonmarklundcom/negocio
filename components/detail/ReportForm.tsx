'use client';

import { useState } from 'react';
import { submitLead } from '@/lib/lead-client';
import { Honeypot } from '@/components/Honeypot';

/**
 * "Reportar información incorrecta" (ROADMAP W1-1b).
 *
 * A directory is only worth using while its data is true, and the people who
 * notice a wrong phone number first are visitors, not staff. This is the
 * cheapest possible way for them to tell us.
 *
 * It goes through the SAME lead orchestrator as every other public write —
 * `POST /api/v1/leads` with `source: 'listing_report'`, the same honeypot, the
 * same per-IP rate limit, the same webhook fan-out, the same `leads` table and
 * the same `/admin/leads` screen. A separate reports table would have
 * duplicated all of that to gain one column.
 *
 * Collapsed behind a `<details>` on purpose: a report link is a footnote on a
 * business's page, not a call to action competing with "Llamar".
 *
 * The contact field is optional. Somebody telling us a phone number is wrong
 * is doing us a favour; demanding their email first is how the report simply
 * does not get sent.
 */
export function ReportForm({ listingId, slug }: { listingId: string; slug: string }) {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus('sending');
    const hp = new FormData(e.currentTarget).get('hp');
    const ok = await submitLead(
      {
        source: 'listing_report',
        listingId,
        slug,
        message: message.trim(),
        ...(contact.trim() ? { contact: contact.trim() } : {}),
      },
      typeof hp === 'string' ? hp : '',
    );
    setStatus(ok ? 'sent' : 'error');
    if (ok) {
      setMessage('');
      setContact('');
    }
  }

  return (
    <details className="mt-6 border-t border-line pt-4">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink3 hover:text-ink2">
        ¿Encontraste algo mal? Reportá información incorrecta
      </summary>

      {status === 'sent' ? (
        <p className="mt-3 rounded-xl bg-wabg px-3 py-3 text-sm font-semibold text-wa">
          Gracias. Vamos a revisarlo.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 space-y-2">
          <Honeypot />
          <label htmlFor="report-message" className="block text-[13px] font-semibold text-ink2">
            ¿Qué está mal?
          </label>
          <textarea
            id="report-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={2000}
            rows={3}
            placeholder="Ej. el teléfono ya no existe, cerró, la dirección cambió."
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-blue"
          />
          <label htmlFor="report-contact" className="block text-[13px] font-semibold text-ink2">
            Tu contacto <span className="font-normal text-ink3">(opcional)</span>
          </label>
          <input
            id="report-contact"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={160}
            placeholder="Correo o WhatsApp, por si necesitamos preguntarte algo"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-blue"
          />
          {status === 'error' && (
            <p role="alert" className="text-[13px] font-semibold text-terra">
              No pudimos enviarlo. Probá de nuevo en un momento.
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-xl border-[1.5px] border-blue px-4 py-2 text-[13px] font-bold text-blue disabled:opacity-60"
          >
            {status === 'sending' ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </form>
      )}
    </details>
  );
}
