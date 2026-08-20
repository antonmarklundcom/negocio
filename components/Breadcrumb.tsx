import { Link } from '@/lib/i18n/link';

export type Crumb = { label: string; href?: string };

/** Inicio › [Categoría] › [Negocio] (§6.1). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink3">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>›</span>}
          {c.href ? (
            <Link href={c.href} className="transition-colors hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span className="text-ink2">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
