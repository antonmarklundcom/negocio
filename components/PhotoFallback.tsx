import { CategoryIcon } from './icons';
import { getCategory } from '@/lib/categories';

/**
 * Warm gradient block with the business initial (Newsreader, terra) + the
 * category icon. Used everywhere a photo is missing — never an empty grey box
 * (§3). Sizing is controlled by the parent; this fills it.
 */
export function PhotoFallback({
  initial,
  categoria,
  className = '',
  initialSize = 'text-4xl',
  iconSize = 18,
}: {
  initial: string;
  categoria: string;
  className?: string;
  initialSize?: string;
  iconSize?: number;
}) {
  const icon = getCategory(categoria)?.icon ?? 'bag';
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 bg-[image:var(--fallback)] ${className}`}
    >
      <span className={`font-serif font-medium leading-none text-white ${initialSize}`}>{initial}</span>
      <CategoryIcon name={icon} size={iconSize} className="text-white" />
    </div>
  );
}
