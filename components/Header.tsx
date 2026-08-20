import Link from 'next/link';
import { Search } from './icons';

/** Site header: wordmark, nav, desktop search box, primary CTA (§6.8). */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="shrink-0 font-serif text-[22px] font-semibold tracking-tight md:text-[24px]">
          negocio<span className="text-terra">.com.py</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-sm font-semibold text-ink2 md:flex">
          {/* /rubros is the crawlable category hub (W1-1); this link was still
              pointing at /buscar, the same stale target the mobile tab had. */}
          <Link href="/rubros" className="transition-colors hover:text-ink">
            Categorías
          </Link>
          <Link href="/buscar" className="transition-colors hover:text-ink">
            Buscar
          </Link>
        </nav>

        <form action="/buscar" className="ml-auto hidden items-center md:flex">
          <label className="flex w-[280px] items-center gap-2 rounded-card border border-line bg-paper px-3 py-2">
            <Search size={16} className="text-ink3" />
            <input
              name="q"
              placeholder="Buscar negocios…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink3"
              aria-label="Buscar negocios"
            />
          </label>
        </form>

        <Link
          href="/sumar-negocio"
          className="ml-auto rounded-card bg-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blued md:ml-3"
        >
          Sumá tu negocio
        </Link>
      </div>
    </header>
  );
}
