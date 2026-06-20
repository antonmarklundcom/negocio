import Link from 'next/link';
import { Lock, ImageIcon, Menu } from '@/components/icons';

/**
 * Locked premium slots for the free profile (§6.1) — dashed placeholders that
 * make the gap obvious without looking broken.
 */
export function LockedRow({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border-[1.5px] border-dashed border-line bg-white/50 px-4 py-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cream2 text-ink3">
        <Lock size={17} />
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-ink2">{title}</div>
        <div className="text-[11px] text-ink3">{sub}</div>
      </div>
    </div>
  );
}

export function LockedGallery() {
  return (
    <div className="flex h-[96px] flex-col items-center justify-center gap-1.5 rounded-card border-[1.5px] border-dashed border-line bg-white/50 text-ink3 md:h-[150px]">
      <ImageIcon size={24} />
      <div className="text-[12px] font-semibold">Galería de fotos · disponible en Premium</div>
    </div>
  );
}

export function LockedCategory() {
  return (
    <div className="flex h-16 items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line bg-white/50 text-ink3">
      <Menu size={18} />
      <div className="text-[12px] font-semibold">Menú y especialidades · bloqueado</div>
    </div>
  );
}

/** Dark upgrade CTA shown on free profiles (§6.1). */
export function UpgradeCta() {
  return (
    <div className="rounded-card bg-ink p-5 text-center md:flex md:items-center md:justify-between md:p-6 md:text-left">
      <div>
        <div className="font-serif text-[19px] font-semibold text-white md:text-[22px]">Mejorá este perfil</div>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-white/70">
          Sumá fotos, contacto por WhatsApp, menú y mejor posición en las búsquedas de tu rubro.
        </p>
      </div>
      <Link
        href="/precios"
        className="mt-3 inline-block rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink md:ml-6 md:mt-0 md:shrink-0"
      >
        Pasar a Premium
      </Link>
    </div>
  );
}
