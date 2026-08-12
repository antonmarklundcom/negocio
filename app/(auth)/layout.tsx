import type { Metadata } from 'next';
import Link from 'next/link';

/** A session is per-request; nothing under here may be statically rendered. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Deliberately bare: no site header, no bottom nav, no promo banner. A sign-in
 * page is not a place to keep selling.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12">
      <Link href="/" className="font-serif text-[24px] font-semibold">
        negocio<span className="text-terra">.com.py</span>
      </Link>
      <div className="mt-8 w-full max-w-sm rounded-card border border-line bg-white p-6">{children}</div>
    </div>
  );
}
