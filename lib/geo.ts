/**
 * Distance maths for "Cerca de mí" (ROADMAP W3-1).
 *
 * Pure on purpose, for the same reason `lib/admin/validation.ts` is: the seed
 * provider sorts in JavaScript and the MySQL provider sorts in SQL, and the two
 * must order an identical set identically or the same query returns different
 * pages depending on whether `DATABASE_URL` happens to be set. Keeping the
 * formula here — and having `lib/db/listing-query.ts` mirror *this* file rather
 * than invent its own — is what makes that testable without a database.
 */

export type Point = { lat: number; lng: number };

/** Mean Earth radius in kilometres. */
const EARTH_RADIUS_KM = 6371;

/**
 * How many decimal places a visitor's coordinates keep before they are allowed
 * into a URL.
 *
 * Three places is ~110 m at the equator and less than that this far south. That
 * is more than precise enough to rank businesses by "near me" across a city,
 * and far too coarse to say which building someone is standing in. It matters
 * because the sort is expressed in the query string: the URL is shareable,
 * lands in `document.referrer`, and would otherwise carry a house number's
 * worth of precision into the analytics of every outbound link.
 */
export const COORD_PRECISION = 3;

/** Round a coordinate to `COORD_PRECISION` places. Returns a number, not a string. */
export function roundCoord(value: number): number {
  const factor = 10 ** COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

/** Latitude/longitude are only meaningful inside their real ranges. */
export function isValidPoint(p: { lat?: number | null; lng?: number | null }): p is Point {
  return (
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/**
 * Parse the `lat`/`lng` pair out of URL params, rounded and range-checked.
 * Anything malformed returns `undefined` rather than throwing — a hand-edited
 * URL should degrade to the normal ordering, not 500.
 */
export function parsePoint(lat: string | undefined, lng: string | undefined): Point | undefined {
  if (lat == null || lng == null) return undefined;
  const parsed = { lat: Number.parseFloat(lat), lng: Number.parseFloat(lng) };
  if (!isValidPoint(parsed)) return undefined;
  return { lat: roundCoord(parsed.lat), lng: roundCoord(parsed.lng) };
}

/**
 * The longitude scale factor at a given latitude: a degree of longitude is
 * `cos(lat)` as long as a degree of latitude. Exported because the SQL ORDER BY
 * needs the identical number — it is computed here, in the app, and passed to
 * MySQL as a bound parameter, so the database never does trigonometry and the
 * two providers cannot drift.
 */
export function lngScaleAt(lat: number): number {
  return Math.cos((lat * Math.PI) / 180);
}

/**
 * Equirectangular approximation, in kilometres.
 *
 * Not haversine, deliberately. Over the tens of kilometres that "negocios cerca
 * de mí" actually spans, the two agree to well under the precision we keep, and
 * this one is a subtraction and a multiply — which is exactly what can be
 * written as a MySQL ORDER BY expression without trigonometry.
 */
export function approxDistanceKm(from: Point, to: Point): number {
  const dLat = to.lat - from.lat;
  const dLng = (to.lng - from.lng) * lngScaleAt(from.lat);
  return Math.sqrt(dLat * dLat + dLng * dLng) * ((Math.PI / 180) * EARTH_RADIUS_KM);
}

/**
 * Human distance for a card: metres under a kilometre, one decimal under ten,
 * whole kilometres above. Spanish decimal comma, because the rest of the site
 * writes `Gs. 1.450.000`.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
