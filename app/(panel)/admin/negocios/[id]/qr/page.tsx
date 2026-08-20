import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { getListingForEdit } from '@/lib/db/listings-admin';
import { listingQrSvg } from '@/lib/media/qr';
import { SITE_URL, listingPath } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Código QR' };

/**
 * A printable sticker (ROADMAP Phase D item 4): QR code → the listing's
 * public profile. Server-rendered inline SVG, no client component and no
 * external QR service — `qrcode` runs entirely on the server.
 *
 * Available for any listing (not gated on Premium): a business considering
 * Premium can be shown the sticker as part of the sales pitch before buying.
 */
export default async function ListingQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentUser();

  let listing;
  try {
    listing = await getListingForEdit(actor, id);
  } catch {
    notFound();
  }
  if (!listing) notFound();

  const url = `${SITE_URL}${listingPath(listing.slug)}`;
  const svg = await listingQrSvg(url);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="print:hidden">
        <Link href={`/admin/negocios/${id}`} className="text-[14px] font-bold text-blue hover:underline">
          ← {listing.name}
        </Link>
        <h1 className="mt-2 font-serif text-[24px] font-semibold">Código QR</h1>
        <p className="mt-1 text-[15px] text-ink2">
          Imprimí esta página (Ctrl/Cmd+P) para el sticker. Apunta a la ficha pública del negocio.
        </p>
      </div>

      <div className="rounded-card border border-line bg-white p-8 text-center print:border-none print:p-0 print:shadow-none">
        <div
          className="mx-auto w-full max-w-[280px] [&>svg]:h-auto [&>svg]:w-full"
          // The library's own output — a plain <svg> with no scripts, safe to inline.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-4 font-serif text-[18px] font-semibold">{listing.name}</p>
        <p className="mt-1 break-all font-mono text-[12px] text-ink2">{url}</p>
      </div>
    </div>
  );
}
