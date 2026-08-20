import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Per-request i18n config. `requestLocale` comes from the `[locale]` segment;
 * anything unrecognised falls back to the default rather than throwing, because
 * the segment is a URL anyone can type.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // The app computes time itself and formats ₲ its own way (lib/format.ts);
    // these only cover next-intl's own date/number helpers.
    timeZone: 'America/Asuncion',
  };
});
