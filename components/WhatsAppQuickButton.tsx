'use client';

import { waLink } from '@/lib/format';
import { trackLead } from '@/lib/lead-client';
import { WhatsApp } from './icons';

/** Small green WhatsApp quick-action used on premium result cards (§6.2). */
export function WhatsAppQuickButton({
  whatsapp,
  listingId,
  slug,
  name,
}: {
  whatsapp: string;
  listingId: string;
  slug: string;
  name: string;
}) {
  return (
    <a
      href={waLink(whatsapp, `Hola ${name}, los encontré en negocio.com.py`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir a ${name} por WhatsApp`}
      onClick={(e) => {
        e.stopPropagation();
        trackLead({ source: 'listing_whatsapp', listingId, slug });
      }}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wabg text-wa transition-colors hover:bg-wab hover:text-white"
    >
      <WhatsApp size={19} />
    </a>
  );
}
