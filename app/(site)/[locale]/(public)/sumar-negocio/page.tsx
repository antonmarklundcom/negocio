import type { Metadata } from 'next';
import { SumateForm } from '@/components/SumateForm';
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
    title: 'Sumá tu negocio',
    description: 'Sumá tu negocio a negocio.com.py gratis y empezá a recibir clientes en Paraguay.',
    alternates: alternatesFor('/sumar-negocio', locale),
  };
}

const BENEFITS = [
  'Te encuentran clientes que ya están buscando tu rubro',
  'Perfil listo en minutos, sin conocimientos técnicos',
  'Recibí consultas por WhatsApp y teléfono',
  'Gratis para empezar, Premium cuando quieras crecer',
];

export default async function SumarNegocioPage(props: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await props.params;
  const locale = toLocale(raw);
  // ROADMAP W3-3: opts this route back into static rendering. Reading a
  // translation without it makes the route dynamic, which would quietly undo
  // W1-3's caching — the page would still be correct, just uncached.
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-8 md:py-14">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[42px]">
            Sumá tu negocio y conseguí más clientes
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink2">
            Miles de personas buscan negocios como el tuyo en negocio.com.py. Dejanos tus datos y te ayudamos a
            crear tu perfil.
          </p>
          <ul className="mt-6 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[15px] text-ink2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bluebg text-blued">
                  <Check size={13} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-line bg-paper p-6 shadow-card md:p-7">
          <h2 className="mb-1 font-serif text-[22px] font-semibold">Empezá ahora</h2>
          <p className="mb-5 text-sm text-ink2">Completá el formulario y te contactamos.</p>
          <SumateForm />
        </div>
      </div>
    </div>
  );
}
