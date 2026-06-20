import { PROMO_BANNER_ON } from '@/lib/config';

/**
 * Launch promo banner — a single env-toggled component, OFF by default (§6.8).
 * Marketing copy is intentionally generic; never hardcode specific claims.
 */
export function PromoBanner() {
  if (!PROMO_BANNER_ON) return null;
  return (
    <div className="bg-terra px-4 py-2 text-center text-sm font-semibold text-white">
      Oferta de lanzamiento — sumá tu negocio con beneficios por tiempo limitado.
    </div>
  );
}
