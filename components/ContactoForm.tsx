'use client';

import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { submitLead } from '@/lib/lead-client';
import { Honeypot } from './Honeypot';

const field = 'w-full rounded-[10px] border border-line bg-cream px-3.5 py-3 text-[15px] text-ink outline-none focus:border-blue';

/** General contact form → {source:'contacto'} (§6.7). */
export function ContactoForm() {
  const t = useTranslations('forms');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus('sending');
    const ok = await submitLead(
      {
        source: 'contacto',
        name: String(fd.get('name') ?? ''),
        email: String(fd.get('email') ?? ''),
        message: String(fd.get('message') ?? ''),
      },
      String(fd.get('hp') ?? ''),
    );
    setStatus(ok ? 'sent' : 'error');
    if (ok) e.currentTarget.reset();
  }

  if (status === 'sent') {
    return (
      <div className="rounded-card border border-line bg-wabg p-6 text-center">
        <p className="font-serif text-xl font-semibold text-wa">{t('contactSent')}</p>
        <p className="mt-2 text-sm text-ink2">{t('contactSentHint')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Honeypot />
      <input name="name" required placeholder={t('contactName')} className={field} />
      <input name="email" type="email" required placeholder={t('contactEmail')} className={field} />
      <textarea name="message" required placeholder={t('contactMessage')} rows={5} className={`${field} resize-none`} />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-card bg-blue py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-blued disabled:opacity-60"
      >
        {status === 'sending' ? t('sending') : t('messageSubmit')}
      </button>
      {status === 'error' && (
        <p className="text-center text-sm text-terra">{t('sendFailed')}</p>
      )}
    </form>
  );
}
