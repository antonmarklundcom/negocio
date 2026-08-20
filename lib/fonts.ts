import { Newsreader, Hanken_Grotesk } from 'next/font/google';

/**
 * The two web fonts, in one module.
 *
 * They live here rather than inside a layout because there are now **two** root
 * layouts (ROADMAP W3-3): the public site under `[locale]` and the staff panel
 * outside it. `next/font` deduplicates by call site, so declaring them once and
 * importing twice is what keeps a single copy of each font in the build.
 */
export const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
});

/** The class pair every `<html>` needs for the CSS variables to resolve. */
export const FONT_VARIABLES = `${newsreader.variable} ${hanken.variable}`;
