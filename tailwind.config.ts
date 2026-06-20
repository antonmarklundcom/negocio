import type { Config } from 'tailwindcss';

/**
 * Design tokens — verbatim from /design/reference.html (§3 of the build spec).
 * Colours are exposed both as Tailwind utilities (bg-cream, text-blue, …) and
 * as CSS variables (see app/globals.css :root) so inline styles and the few
 * gradient fallbacks can reference the same single source of truth.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        cream2: 'var(--cream2)',
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        blue: 'var(--blue)',
        blued: 'var(--blued)',
        bluebg: 'var(--bluebg)',
        terra: 'var(--terra)',
        terra2: 'var(--terra2)',
        terragold: 'var(--terragold)',
        wa: 'var(--wa)',
        wab: 'var(--wab)',
        wabg: 'var(--wabg)',
      },
      fontFamily: {
        // Bound to the next/font CSS variables set in app/layout.tsx.
        serif: ['var(--font-newsreader)', 'Newsreader', 'serif'],
        sans: ['var(--font-hanken)', 'Hanken Grotesk', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(40,30,10,.05)',
        cardhover: '0 8px 24px rgba(40,30,10,.10)',
        premium: '0 6px 20px rgba(194,100,62,.12)',
        wa: '0 4px 14px rgba(37,211,102,.30)',
      },
      maxWidth: {
        content: '1180px',
      },
    },
  },
  plugins: [],
};

export default config;
