import { Link } from '@/lib/i18n/link';
import type { Category } from '@/lib/types';
import type { Locale } from '@/lib/i18n/routing';
import { categoryLabelPluralFor } from '@/lib/categories';

/** One rubro tile in "Buscá por categoría" (Home_A §5). */
export function CategoryTile({ category, locale }: { category: Category; locale: Locale }) {
  const label = categoryLabelPluralFor(category.slug, locale);
  return (
    <Link
      href={`/${category.slug}`}
      className="flex flex-col gap-[14px] rounded-[16px] border-[1.5px] border-line bg-paper p-[18px] text-ink no-underline hover:border-terragold hover:bg-[#FFFDF9]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-goldbg font-serif text-[20px] font-medium text-terrad">
        {label.charAt(0)}
      </span>
      <span className="text-[15px] font-semibold leading-[1.25]">{label}</span>
    </Link>
  );
}
