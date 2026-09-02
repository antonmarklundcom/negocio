'use client';

import { waLink } from '@/lib/format';
import { trackLead } from '@/lib/lead-client';
import { useTranslations } from 'next-intl';
import { WhatsApp, Phone } from '@/components/icons';

/** Mobile-only sticky bottom WhatsApp bar for premium profiles (§6.1). */
export function StickyWhatsAppBar({
  whatsapp,
  phone,
  listingId,
  slug,
  name,
}: {
  whatsapp: string;
  phone?: string;
  listingId: string;
  slug: string;
  name: string;
}) {
  const t = useTranslations('detail');
  return (
    <div className="fixed inset-x-0 bottom-[57px] z-30 flex gap-2.5 border-t border-line bg-cream/95 px-4 py-2.5 backdrop-blur md:hidden">
      <a
        href={waLink(whatsapp, t('whatsappMessageShort', { name }))}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackLead({ source: 'listing_whatsapp', listingId, slug })}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-wa py-3 text-[15px] font-bold text-white shadow-wa"
      >
        <WhatsApp size={19} />
        {t('whatsappWrite')}
      </a>
      {phone && (
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          aria-label="Llamar"
          className="flex w-[52px] items-center justify-center rounded-xl border-[1.5px] border-blue px-4 text-blue"
        >
          <Phone size={19} />
        </a>
      )}
    </div>
  );
}
