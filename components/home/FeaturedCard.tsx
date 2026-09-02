'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/link';
import Image from 'next/image';
import type { Listing } from '@/lib/types';
import type { OpenState } from '@/lib/hours';
import { listingPath } from '@/lib/config';
import { mediaUrl } from '@/lib/media/url';
import { waLink } from '@/lib/format';
import { trackLead } from '@/lib/lead-client';
import { DestacadoPill } from '@/components/Pills';
import { FavoriteButton } from '@/components/FavoriteButton';
import { RatingBadge } from '@/components/RatingBadge';
import { StatusPill } from './StatusPill';

/** "Negocios destacados" card (Home_A §4) — the paid/premium home slots. */
export function FeaturedCard({ listing, open }: { listing: Listing; open: OpenState }) {
  const tDetail = useTranslations('detail');
  const tHome = useTranslations('home');
  const href = listingPath(listing.slug);
  const hasContact = !!listing.phone || !!listing.whatsapp;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border-[1.5px] border-line bg-paper transition-[transform,box-shadow] duration-150 hover:-translate-y-[2px] hover:shadow-lift">
      <Link href={href} className="block">
        <div className="relative h-[150px] w-full">
          {listing.coverImage ? (
            <Image
              src={mediaUrl(listing.coverImage)}
              alt={listing.name}
              fill
              sizes="(max-width: 640px) 100vw, 300px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center gap-[10px] bg-[image:var(--fallback)]">
              <span className="font-serif text-[52px] font-medium text-white">{listing.logoInitial}</span>
              <span className="rounded-full border border-white/50 px-[10px] py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/85">
                {listing.categoriaLabel}
              </span>
            </div>
          )}
          <span className="absolute left-3 top-3">
            <DestacadoPill />
          </span>
        </div>
      </Link>
      {/* Outside the <Link> — see ListingCard.tsx for why. */}
      <div className="absolute right-3 top-3">
        <FavoriteButton slug={listing.slug} name={listing.name} />
      </div>

      <div className="flex flex-1 flex-col gap-[10px] px-[18px] pb-[18px] pt-4">
        <div>
          <Link href={href}>
            <h3 className="mb-1 font-serif text-[21px] font-medium leading-[1.2] text-ink">{listing.name}</h3>
          </Link>
          <div className="text-[14px] text-ink2">
            {listing.categoriaLabel} · {listing.ciudadLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill open={open} />
          <RatingBadge rating={listing.rating} reviewsCount={listing.reviewsCount} />
        </div>

        <div className="mt-auto flex gap-2 pt-[6px]">
          {hasContact ? (
            <>
              {listing.phone && (
                <a
                  href={`tel:${listing.phone.replace(/\s/g, '')}`}
                  className="flex-1 rounded-[10px] border-[1.5px] border-blue py-[9px] text-center text-[14px] font-semibold text-blue transition-colors hover:bg-bluebg"
                >
                  {tDetail('call')}
                </a>
              )}
              {listing.whatsapp && (
                <a
                  href={waLink(listing.whatsapp, tDetail('whatsappMessageShort', { name: listing.name }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackLead({ source: 'listing_whatsapp', listingId: listing.id, slug: listing.slug })
                  }
                  className="flex-1 rounded-[10px] bg-wa py-[9px] text-center text-[14px] font-semibold text-white transition-colors hover:bg-wab"
                >
                  WhatsApp
                </a>
              )}
            </>
          ) : (
            <Link
              href={href}
              className="flex-1 rounded-[10px] border-[1.5px] border-blue py-[9px] text-center text-[14px] font-semibold text-blue no-underline transition-colors hover:bg-bluebg"
            >
              {tHome('viewProfile')}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
