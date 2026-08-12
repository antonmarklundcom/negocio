import type { Metadata } from 'next';
import { ContactoForm } from '@/components/ContactoForm';
import { WhatsApp } from '@/components/icons';
import { PLATFORM_WHATSAPP } from '@/lib/config';
import { waLink } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Escribinos. Estamos para ayudarte con tu negocio en negocio.com.py.',
};

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 md:px-8 md:py-14">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h1 className="font-serif text-[32px] font-semibold leading-tight md:text-[40px]">Hablemos</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink2">
            ¿Tenés una consulta, sugerencia o querés trabajar con nosotros? Escribinos y te respondemos a la
            brevedad.
          </p>
          <a
            href={waLink(PLATFORM_WHATSAPP, 'Hola, tengo una consulta sobre negocio.com.py')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-card bg-wab px-5 py-3 text-[15px] font-bold text-[#053d22] shadow-wa"
          >
            <WhatsApp size={19} />
            Escribinos por WhatsApp
          </a>
        </div>

        <div className="rounded-card border border-line bg-paper p-6 shadow-card md:p-7">
          <h2 className="mb-5 font-serif text-[22px] font-semibold">Enviá tu mensaje</h2>
          <ContactoForm />
        </div>
      </div>
    </div>
  );
}
