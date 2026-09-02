'use client';

import { waLink } from '@/lib/format';
import { trackLead } from '@/lib/lead-client';
import { useTranslations } from 'next-intl';
import { WhatsApp } from './icons';

/** Full-width WhatsApp action (premium contact card / sticky bar). */
export function WhatsAppButton({
  whatsapp,
  listingId,
  slug,
  name,
  label,
  className = '',
}: {
  whatsapp: string;
  listingId: string;
  slug: string;
  name: string;
  label?: string;
  className?: string;
}) {
  const t = useTranslations('detail');
  return (
    <a
      href={waLink(whatsapp, t('whatsappMessage', { name }))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLead({ source: 'listing_whatsapp', listingId, slug })}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-wa px-4 py-3.5 text-[15px] font-bold text-white shadow-wa transition-colors hover:bg-wab ${className}`}
    >
      <WhatsApp size={19} />
      {label ?? 'WhatsApp'}
    </a>
  );
}
