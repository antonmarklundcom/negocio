import type { ReactElement, SVGProps } from 'react';

/**
 * Icon set — line icons matching the reference's stroke style (1.7–1.9 width,
 * round caps). Category icons resolve by the `icon` key in lib/categories.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 18, props: SVGProps<SVGSVGElement> = {}) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export function ChevronLeft({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
export function ChevronDown({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
export function Heart({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" />
    </svg>
  );
}
export function Share({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="M8 11l8-4.5M8 13l8 4.5" />
    </svg>
  );
}
export function Phone({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.9}>
      <path d="M5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5V20a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" />
    </svg>
  );
}
export function Send({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.9}>
      <path d="M4 12l16-7-7 16-2-7z" />
    </svg>
  );
}
export function Clock({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.7}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
export function Pin({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.7}>
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}
export function Search({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.9}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
export function Check({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={2.6}>
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}
export function Lock({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}
export function ImageIcon({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.5}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="1.6" />
      <path d="M3 17l5-4 4 3 3-2 6 5" />
    </svg>
  );
}
export function Menu({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={1.5}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
export function Home({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M4 11l8-6 8 6" />
      <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" />
    </svg>
  );
}
export function Plus({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function Grid({ size, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function WhatsApp({ size = 18, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" {...p}>
      <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.4.7 4.6 1.9 6.5L4 29l7-1.8c1.8 1 3.8 1.5 5.9 1.5 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.6c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-3.9 1 1-3.8-.2-.4c-1.1-1.7-1.6-3.6-1.6-5.5C5.6 9.4 10.3 4.9 16 4.9s10.4 4.5 10.4 10c0 5.6-4.7 9.7-10.4 9.7zm6-7.3c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.8.2-.2.3-.9 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6 0-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z" />
    </svg>
  );
}

// ---- Category icons (resolved by Category.icon) ----------------------------
function Utensils(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <path d="M5 11l1-4h12l1 4M4 11h16v7a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
      <path d="M8 11v8M16 11v8M12 11v8" />
    </svg>
  );
}
function Bag(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8a3 3 0 016 0" />
    </svg>
  );
}
function Wrench(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <path d="M14 7a4 4 0 01-5 5l-5 5 2 2 5-5a4 4 0 005-5l-2 2-2-2 2-2z" />
    </svg>
  );
}
function HeartCat(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" />
    </svg>
  );
}
function Scissors(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 8l12 8M8 16L20 8" />
    </svg>
  );
}
function Briefcase(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}
function Hammer(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <path d="M14 6l4 4-3 3-4-4z" />
      <path d="M11 9l-7 7 2 2 7-7" />
    </svg>
  );
}
function Paw(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <circle cx="7" cy="9" r="1.6" />
      <circle cx="12" cy="7" r="1.6" />
      <circle cx="17" cy="9" r="1.6" />
      <path d="M12 12c-3 0-5 2.5-5 4.5S9 19 12 19s5-.5 5-2.5S15 12 12 12z" />
    </svg>
  );
}
function Laptop(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 20h20" />
    </svg>
  );
}
function HomeCat(p: IconProps) {
  return (
    <svg {...base(p.size, p)} strokeWidth={1.6}>
      <path d="M4 11l8-6 8 6" />
      <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  utensils: Utensils,
  bag: Bag,
  wrench: Wrench,
  heart: HeartCat,
  scissors: Scissors,
  briefcase: Briefcase,
  hammer: Hammer,
  paw: Paw,
  laptop: Laptop,
  home: HomeCat,
};

/**
 * The icon keys this module actually resolves. The admin category form builds
 * its `icon` select from this list rather than offering free text — a typo
 * there would render a missing icon on a live category page.
 */
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as readonly string[];

export function CategoryIcon({ name, ...p }: IconProps & { name: string }) {
  const Cmp = CATEGORY_ICONS[name] ?? Bag;
  return <Cmp {...p} />;
}
