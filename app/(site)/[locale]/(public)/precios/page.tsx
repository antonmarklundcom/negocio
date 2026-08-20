import type { Metadata } from 'next';
import { Link } from '@/lib/i18n/link';
import { Check } from '@/components/icons';
import { toLocale } from '@/lib/i18n/routing';
import { alternatesFor } from '@/lib/i18n/alternates';
import { setRequestLocale } from 'next-intl/server';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  return {
    title: 'Precios — Gratis vs Premium',
    description: 'Sumá tu negocio gratis o pasá a Premium para fotos, WhatsApp y más visibilidad en las búsquedas.',
    alternates: alternatesFor('/precios', locale),
  };
}

const GRATIS = [
  'Perfil con nombre, rubro y ciudad',
  'Teléfono y dirección',
  'Horarios de atención',
  'Aparecés en las búsquedas',
];

const PREMIUM = [
  'Todo lo del plan Gratis',
  'Botón de WhatsApp directo',
  'Galería de fotos y portada',
  'Menú, productos o servicios destacados',
  'Chip “Verificado” y “Destacado”',
  'Posición prioritaria en tu rubro',
];

export default async function PreciosPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-8 md:py-14">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[40px]">
          Un plan para cada negocio
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink2">
          Empezá gratis y pasá a Premium cuando quieras más clientes. Sin contratos largos.
        </p>
      </header>

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
        {/* Gratis */}
        <div className="flex flex-col rounded-card border border-line bg-paper p-7 shadow-card">
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink3">Gratis</div>
          <div className="mt-2 font-serif text-[34px] font-semibold">₲ 0</div>
          <p className="mt-1 text-sm text-ink2">Para siempre</p>
          <ul className="mt-5 flex-1 space-y-3">
            {GRATIS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-ink2">
                <Check size={16} className="mt-0.5 shrink-0 text-blue" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sumar-negocio"
            className="mt-6 rounded-card border-[1.5px] border-blue py-3 text-center text-sm font-bold text-blue"
          >
            Sumar gratis
          </Link>
        </div>

        {/* Premium */}
        <div className="flex flex-col rounded-card border border-terra2 border-t-[2.5px] border-t-terra bg-paper p-7 shadow-premium">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-terra">Premium</span>
            <span className="rounded-full bg-terra2 px-2.5 py-0.5 text-[11px] font-bold text-terra">★ Recomendado</span>
          </div>
          <div className="mt-2 font-serif text-[34px] font-semibold">
            ₲ 65.000<span className="text-[16px] font-medium text-ink3"> /mes</span>
          </div>
          <p className="mt-1 text-sm text-ink2">Cancelás cuando quieras</p>
          <ul className="mt-5 flex-1 space-y-3">
            {PREMIUM.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-ink2">
                <Check size={16} className="mt-0.5 shrink-0 text-terra" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sumar-negocio"
            className="mt-6 rounded-card bg-blue py-3 text-center text-sm font-bold text-white transition-colors hover:bg-blued"
          >
            Quiero Premium
          </Link>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-ink3">
        Los precios son referenciales y pueden ajustarse. Consultanos por planes anuales.
      </p>
    </div>
  );
}
