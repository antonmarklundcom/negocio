import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getListingBySlug, getListings } from '@/lib/listings-repo';
import { dbConfigured } from '@/lib/db/client';
import { listApprovedReviews } from '@/lib/db/reviews';
import { isPremium } from '@/lib/listing';
import { computeOpenState } from '@/lib/hours';
import { formatPhone } from '@/lib/format';
import { FREE_PHONE_TAPTOCALL, REVIEWS_ENABLED, SITE_URL, listingPath } from '@/lib/config';
import { mediaUrl } from '@/lib/media/url';
import { Breadcrumb, type Crumb } from '@/components/Breadcrumb';
import { Gallery } from '@/components/detail/Gallery';
import { HoursTable } from '@/components/detail/HoursTable';
import { CategoryBlock } from '@/components/CategoryBlock';
import { LocationMapLazy } from '@/components/LocationMapLazy';
import { PhotoFallback } from '@/components/PhotoFallback';
import { VerifiedPill, OpenNowPill, ClosedPill } from '@/components/Pills';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { ListingMessageForm } from '@/components/ListingMessageForm';
import { StickyWhatsAppBar } from '@/components/detail/StickyWhatsAppBar';
import { LockedRow, LockedGallery, LockedCategory, UpgradeCta } from '@/components/detail/Locked';
import { Reviews } from '@/components/detail/Reviews';
import { ShareButton } from '@/components/detail/ShareButton';
import { Phone, Clock } from '@/components/icons';
import { JsonLd, listingJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import type { Review } from '@/lib/types';

/**
 * ISR (ROADMAP W1-3). This page used to be fully dynamic: every visit to every
 * listing was a MySQL round-trip (listing + hours + gallery) against a pool
 * capped at 8 connections, while the home page and the sitemap were already
 * ISR'd. It reads no `searchParams`, so nothing forced it to be.
 *
 * An hour is the staleness ceiling, not the mechanism: every admin write path
 * calls `revalidatePath('/lugar/[slug]', 'page')`, so a staff edit is visible
 * on the next request.
 */
export const revalidate = 3600;

/**
 * Prerender the listings that exist at build time; anything created later is
 * rendered on demand and then cached (`dynamicParams` defaults to true).
 *
 * Deliberately defensive: a build machine that cannot reach MySQL must fall
 * back to rendering everything on demand, not fail the deploy. The public
 * pages already degrade this way — the provider itself throws rather than
 * serving stale seed data, and that error belongs at request time.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const { items } = await getListings({ pageSize: 500, page: 1 });
    return items.map((l) => ({ slug: l.slug }));
  } catch (err) {
    console.error('[lugar] generateStaticParams could not read listings; rendering on demand:', err);
    return [];
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const l = await getListingBySlug(params.slug);
  if (!l) return { title: 'Negocio no encontrado' };
  const where = l.zona ? `${l.zona}, ${l.ciudadLabel}` : l.ciudadLabel;
  return {
    title: `${l.name} — ${l.categoriaLabel} en ${where}`,
    description: l.description?.slice(0, 160) ?? `${l.name}, ${l.categoriaLabel} en ${where}.`,
    alternates: { canonical: `${SITE_URL}${listingPath(l.slug)}` },
    openGraph: {
      title: l.name,
      description: l.description?.slice(0, 160),
      images: l.coverImage
        ? [/^https?:\/\//.test(mediaUrl(l.coverImage)) ? mediaUrl(l.coverImage) : `${SITE_URL}${mediaUrl(l.coverImage)}`]
        : undefined,
    },
  };
}

export default async function ListingPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const listing = await getListingBySlug(params.slug);
  if (!listing) notFound();

  const premium = isPremium(listing);
  const open = computeOpenState(listing.hours);
  const crumbs: Crumb[] = [
    { label: 'Inicio', href: '/' },
    { label: listing.categoriaLabel, href: `/${listing.categoria}` },
    { label: listing.name },
  ];

  // First-party reviews (ROADMAP Phase D item 5). Both conditions are real:
  // the flag is the honesty gate the whole reviews UI has always been behind,
  // and with no database there is nowhere for a submission to land — the seed
  // dataset has no reviews at all. `reviewsOn` is passed down rather than
  // re-read, so the section and the form can never disagree.
  const reviewsOn = REVIEWS_ENABLED && dbConfigured();
  const reviews = reviewsOn ? await listApprovedReviews(listing.id) : [];

  return (
    <div className="bg-cream">
      <JsonLd data={listingJsonLd(listing)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />

      {premium ? (
        <PremiumDetail listing={listing} open={open} crumbs={crumbs} reviews={reviewsOn ? reviews : null} />
      ) : (
        <FreeDetail listing={listing} open={open} crumbs={crumbs} reviews={reviewsOn ? reviews : null} />
      )}
    </div>
  );
}

type DetailProps = {
  listing: Awaited<ReturnType<typeof getListingBySlug>> & object;
  open: ReturnType<typeof computeOpenState>;
  crumbs: Crumb[];
  /** Approved reviews, or `null` when the reviews feature is off (§6.6 honesty gate). */
  reviews: Review[] | null;
};

function OpenState({ open }: { open: ReturnType<typeof computeOpenState> }) {
  if ('unknown' in open) return null;
  if (open.open) return <OpenNowPill closesAt={open.closesAt} />;
  return <ClosedPill opensAt={open.opensAt} dayLabel={open.opensDayLabel} />;
}

function Rating({ rating, reviewsCount }: { rating?: number; reviewsCount?: number }) {
  if (!REVIEWS_ENABLED || !rating) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span className="tracking-wide text-terragold">★★★★★</span> {rating.toFixed(1)}
      {reviewsCount ? <span className="font-medium text-ink3">· {reviewsCount} reseñas</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------- PREMIUM ----
function PremiumDetail({ listing: l, open, crumbs, reviews }: DetailProps) {
  const gallery = l.coverImage ? [l.coverImage, ...(l.gallery ?? [])] : l.gallery ?? [];
  const dedup = [...new Set(gallery)].map(mediaUrl);

  return (
    <>
      {dedup.length > 0 && <Gallery images={dedup} name={l.name} />}

      <div className="mx-auto max-w-content px-4 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb items={crumbs} />
          <ShareButton name={l.name} />
        </div>

        <div className="mt-4 grid gap-7 md:grid-cols-[1fr_360px]">
          {/* Left column */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {l.verified && <VerifiedPill />}
              <span className="text-[13px] font-semibold text-ink2">
                {l.categoriaLabel}
                {l.subtitle ? ` · ${l.subtitle}` : ''}
              </span>
            </div>
            <h1 className="font-serif text-[31px] font-semibold leading-[1.02] md:text-[42px]">{l.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Rating rating={l.rating} reviewsCount={l.reviewsCount} />
              <OpenState open={open} />
            </div>

            {l.description && (
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink2">{l.description}</p>
            )}

            {/* Mobile contact card (desktop uses the sticky rail) */}
            <div className="mt-5 md:hidden">
              <ContactCard listing={l} />
            </div>

            <div className="mt-7 space-y-7">
              <CategoryBlock listing={l} />

              {l.hours && l.hours.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-serif text-[21px] font-semibold">
                    <Clock size={18} className="text-ink2" />
                    Horarios
                  </h2>
                  <HoursTable hours={l.hours} />
                </section>
              )}

              {l.lat != null && l.lng != null && (
                <section>
                  <h2 className="mb-3 font-serif text-[21px] font-semibold">Ubicación</h2>
                  <div className="overflow-hidden rounded-card border border-line">
                    <LocationMapLazy lat={l.lat} lng={l.lng} name={l.name} />
                    <div className="flex items-center justify-between gap-3 bg-paper px-4 py-3">
                      <div className="text-[13px] leading-snug text-ink2">{l.address ?? l.ciudadLabel}</div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-[10px] border-[1.5px] border-blue px-3.5 py-2 text-[12px] font-bold text-blue"
                      >
                        Cómo llegar
                      </a>
                    </div>
                  </div>
                </section>
              )}

              {reviews && <Reviews listingId={l.id} reviews={reviews} />}
            </div>
          </div>

          {/* Desktop sticky contact rail */}
          <aside className="hidden md:block">
            <div className="sticky top-24">
              <ContactCard listing={l} open={open} desktop />
            </div>
          </aside>
        </div>
      </div>

      {l.whatsapp && (
        <StickyWhatsAppBar
          whatsapp={l.whatsapp}
          phone={l.phone}
          listingId={l.id}
          slug={l.slug}
          name={l.name}
        />
      )}
    </>
  );
}

function ContactCard({
  listing: l,
  open,
  desktop = false,
}: {
  listing: DetailProps['listing'];
  open?: ReturnType<typeof computeOpenState>;
  desktop?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5 shadow-card">
      {desktop && open && (
        <div className="mb-4">
          <OpenState open={open} />
        </div>
      )}
      {l.whatsapp && (
        <WhatsAppButton
          whatsapp={l.whatsapp}
          listingId={l.id}
          slug={l.slug}
          name={l.name}
          className="mb-2.5 w-full"
        />
      )}
      {l.phone && (
        <a
          href={`tel:${l.phone.replace(/\s/g, '')}`}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-blue py-3 text-[15px] font-bold text-blue"
        >
          <Phone size={17} />
          Llamar · {formatPhone(l.phone)}
        </a>
      )}
      <ListingMessageForm listingId={l.id} slug={l.slug} variant={desktop ? 'textarea' : 'inline'} />

      {desktop && (l.yearsActive || l.avgResponseMins) && (
        <div className="mt-4 flex gap-6 border-t border-line2 pt-4">
          {l.yearsActive && (
            <div className="text-[12px] text-ink3">
              <div className="text-sm font-bold text-ink">{l.yearsActive} años</div>
              en negocio
            </div>
          )}
          {l.avgResponseMins && (
            <div className="text-[12px] text-ink3">
              <div className="text-sm font-bold text-ink">~{l.avgResponseMins} min</div>
              respuesta
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- FREE ----
function FreeDetail({ listing: l, crumbs, reviews }: DetailProps) {
  return (
    <>
      {/* Warm fallback header, no cover */}
      <div className="bg-[linear-gradient(160deg,#F4E3D6,#EAD3BE)]">
        <div className="mx-auto max-w-content px-4 py-8 md:px-8 md:py-10">
          <div className="flex items-center gap-4 md:gap-6">
            <PhotoFallback
              initial={l.logoInitial}
              categoria={l.categoria}
              className="h-20 w-20 shrink-0 rounded-[18px] bg-paper shadow-card md:h-[104px] md:w-[104px]"
              initialSize="text-4xl md:text-5xl"
              iconSize={18}
            />
            <div>
              <div className="mb-1 text-[13px] font-semibold text-ink2">
                {l.categoriaLabel}
                {l.subtitle ? ` · ${l.subtitle}` : ''}
              </div>
              <h1 className="font-serif text-[25px] font-semibold leading-tight md:text-[38px]">{l.name}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-content px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb items={crumbs} />
          <ShareButton name={l.name} />
        </div>

        <div className="mt-4 grid gap-7 md:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {l.description && <p className="text-[15px] leading-relaxed text-ink2">{l.description}</p>}

            <LockedGallery />
            <LockedCategory />

            {l.hours && l.hours.length > 0 && (
              <section>
                <h2 className="mb-2 font-serif text-[17px] font-semibold">Horarios</h2>
                <HoursTable hours={l.hours} />
              </section>
            )}

            {reviews && <Reviews listingId={l.id} reviews={reviews} />}

            <UpgradeCta />
          </div>

          {/* Right: quiet phone + locked WhatsApp */}
          <aside className="space-y-3">
            <div className="rounded-card border border-line bg-paper p-5">
              <div className="mb-3.5 text-[13px] font-bold">Contacto</div>
              {l.phone && (
                <div className="mb-2.5 flex items-center gap-3 rounded-xl border border-line bg-cream px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-paper text-ink2">
                    <Phone size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-ink3">Teléfono</div>
                    {FREE_PHONE_TAPTOCALL ? (
                      <a href={`tel:${l.phone.replace(/\s/g, '')}`} className="text-[15px] font-bold text-ink">
                        {formatPhone(l.phone)}
                      </a>
                    ) : (
                      <div className="text-[15px] font-bold text-ink">{formatPhone(l.phone)}</div>
                    )}
                  </div>
                </div>
              )}
              <LockedRow title="WhatsApp" sub="Solo perfiles Premium" />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
