/** Origins allowed to message the extension directly (externally_connectable).
 *
 *  PRODUCTION_ORIGIN is the canonical GitHub Pages player; it is matched with a
 *  path prefix (/Opentune/player/*). Any extra origins (e.g. a Vercel
 *  deployment) come from WEAVTUNE_SITE_ORIGINS (comma-separated) and are
 *  matched on the whole origin. localhost is added for non-store builds.
 */
export const PRODUCTION_ORIGIN = 'https://justshivv.github.io';
const EXTRA_ORIGINS = (process.env.WEAVTUNE_SITE_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
export const SITE_ORIGINS = [
  PRODUCTION_ORIGIN,
  ...EXTRA_ORIGINS,
  ...(process.env.WEAVTUNE_STORE_BUILD === '1' ? [] : ['http://localhost:5173']),
];
export function matchPatternsFor(origins: string[]): string[] {
  return origins.map((o) => (o === PRODUCTION_ORIGIN ? `${o}/Opentune/player/*` : `${new URL(o).protocol}//${new URL(o).hostname}/*`));
}
