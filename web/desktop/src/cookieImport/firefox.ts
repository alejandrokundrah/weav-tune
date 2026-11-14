import type { CookieSource } from './locate';
import { withCopiedDatabase } from './sqliteCopy';

/** Firefox doesn't encrypt cookie values, so reading one is a plain query. */
export function readFirefoxCookies(source: CookieSource, host: string, names: string[]): Map<string, string> {
  const found = new Map<string, string>();
  withCopiedDatabase(source.dbPath, (db) => {
    const rows = db
      .prepare(`SELECT name, value FROM moz_cookies WHERE host LIKE ? AND name IN (${names.map(() => '?').join(',')})`)
      .all(`%${host}`, ...names) as { name: string; value: string }[];
    for (const row of rows) if (row.value) found.set(row.name, row.value);
  });
  return found;
}
