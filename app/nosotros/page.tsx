import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nosotros',
  description: 'negocio.com.py es el directorio de negocios de Paraguay: rápido, cálido y confiable.',
};

export default function NosotrosPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-8 md:py-16">
      <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[42px]">
        El directorio de negocios de Paraguay
      </h1>
      <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-ink2">
        <p>
          negocio.com.py nació para conectar a las personas con los negocios locales de su barrio y su ciudad.
          Creemos que encontrar un buen restaurante, un taller de confianza o un profesional cerca tuyo debería
          ser simple, rápido y gratis.
        </p>
        <p>
          Reunimos negocios de todo el país —de Asunción a Encarnación, de Ciudad del Este a Luque— en un solo
          lugar, con la información que realmente importa: cómo contactarlos, dónde están y a qué hora abren.
        </p>
        <p>
          Para los negocios, somos una forma honesta de ganar visibilidad y recibir clientes. Sin promesas
          infladas ni reseñas falsas: mostramos lo que es real.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/buscar" className="rounded-card bg-blue px-5 py-3 text-sm font-bold text-white hover:bg-blued">
          Explorar negocios
        </Link>
        <Link
          href="/sumar-negocio"
          className="rounded-card border-[1.5px] border-blue px-5 py-3 text-sm font-bold text-blue"
        >
          Sumá tu negocio
        </Link>
      </div>
    </div>
  );
}
