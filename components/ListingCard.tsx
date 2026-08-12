import Link from 'next/link';
import Image from 'next/image';
import type { Listing } from '@/lib/types';
import { isPremium } from '@/lib/listing';
import { listingPath } from '@/lib/config';
import { mediaUrl } from '@/lib/media/url';
import { PhotoFallback } from './PhotoFallback';
import { VerifiedPill, CategoryChip, DestacadoPill } from './Pills';
import { Pin } from './icons';
import { WhatsAppQuickButton } from './WhatsAppQuickButton';

/**
 * Result card. Standard = white + photo-or-fallback + category chip + name +
 * zona/pin. Premium = same shape + terra top border + ★ Destacado + Verificado +
 * a green WhatsApp quick-action (§6.2). No ribbons. Cards keep equal height.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const premium = isPremium(listing);
  const href = listingPath(listing.slug);

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-card bg-paper transition-shadow ${
        premium
          ? 'border border-terra2 border-t-[2.5px] border-t-terra shadow-premium'
          : 'border border-line shadow-card hover:shadow-cardhover'
      }`}
    >
      <Link href={href} className="block">
        <div className="relative h-[130px] w-full overflow-hidden">
          {listing.coverImage ? (
            <Image
              src={mediaUrl(listing.coverImage)}
              alt={listing.name}
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              className="object-cover"
            />
          ) : (
            <PhotoFallback
              initial={listing.logoInitial}
              categoria={listing.categoria}
              className="h-full w-full"
              initialSize="text-[42px]"
              iconSize={18}
            />
          )}
          {premium && (
            <span className="absolute left-2.5 top-2.5">
              <DestacadoPill />
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          {premium ? listing.verified && <VerifiedPill /> : <CategoryChip label={listing.categoriaLabel} />}
        </div>
        <Link href={href}>
          <h3 className="mb-1.5 font-serif text-[20px] font-semibold leading-tight transition-colors group-hover:text-blued">
            {listing.name}
          </h3>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[13px] text-ink2">
            <Pin size={13} className="text-ink3" />
            {listing.zona ? `${listing.zona}` : listing.ciudadLabel}
          </span>
          {premium && listing.whatsapp && (
            <WhatsAppQuickButton
              whatsapp={listing.whatsapp}
              listingId={listing.id}
              slug={listing.slug}
              name={listing.name}
            />
          )}
        </div>
      </div>
    </article>
  );
}
