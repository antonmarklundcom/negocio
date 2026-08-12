import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * The global 404. It renders the consumer chrome itself rather than inheriting
 * it, because the root layout no longer carries it (see `app/layout.tsx`) — and
 * because this is also what an unauthorised visitor to `/admin` is served, which
 * must be indistinguishable from any other missing page.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-content flex-col items-center px-4 py-24 text-center md:px-8">
        <div className="font-serif text-[80px] font-semibold leading-none text-terra">404</div>
        <h1 className="mt-4 font-serif text-[26px] font-semibold">No encontramos esta página</h1>
        <p className="mt-2 max-w-md text-[15px] text-ink2">
          Puede que el negocio ya no esté disponible o que el enlace no sea correcto.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-card bg-blue px-5 py-3 text-sm font-bold text-white hover:bg-blued">
            Ir al inicio
          </Link>
          <Link href="/buscar" className="rounded-card border-[1.5px] border-blue px-5 py-3 text-sm font-bold text-blue">
            Buscar negocios
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
