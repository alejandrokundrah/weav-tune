import type { CookieSource } from './locate';
import { findCookieSources } from './locate';
import { readChromiumCookies } from './chromiumDecrypt';
import { readFirefoxCookies } from './firefox';

export type { CookieSource };

const YT_SIGNING = ['SAPISID', '__Secure-3PAPISID', '__Secure-1PAPISID'];
const YT_SESSION = [...YT_SIGNING, 'SID', '__Secure-1PSID', '__Secure-3PSID'];

export interface ImportedCookie {
  name: string;
  value: string;
}

export interface ImportResult {
  ok: boolean;
  /** The browser the session came from, once found. */
  browser?: string;
  cookies?: ImportedCookie[];
  /** Why nothing could be imported, for the message the player shows. */
  reason?: string;
}

function readFrom(source: CookieSource, host: string, names: string[]): Map<string, string> {
  try {
    return source.kind === 'firefox' ? readFirefoxCookies(source, host, names) : readChromiumCookies(source, host, names);
  } catch {
    // A profile that can't be read (locked, moved, a keyring that refused) just isn't a source.
    return new Map();
  }
}

/**
 * The most recently used browser profile that has a signed-in YouTube or Spotify session, with
 * the cookies that prove it. Tried newest profile first, across every browser found.
 */
export function importSessionCookies(service: 'youtube' | 'spotify'): ImportResult {
  const sources = findCookieSources();
  if (!sources.length) return { ok: false, reason: 'No browser with a cookie store was found on this computer' };

  if (service === 'spotify') {
    for (const source of sources) {
      const found = readFrom(source, 'spotify.com', ['sp_dc']);
      const value = found.get('sp_dc');
      if (value) return { ok: true, browser: source.label, cookies: [{ name: 'sp_dc', value }] };
    }
    return { ok: false, reason: `No signed-in Spotify session was found (checked ${sources.map((s) => s.label).join(', ')})` };
  }

  for (const source of sources) {
    const found = readFrom(source, 'youtube.com', YT_SESSION);
    if (YT_SIGNING.some((name) => found.has(name))) {
      return { ok: true, browser: source.label, cookies: [...found].map(([name, value]) => ({ name, value })) };
    }
  }
  return { ok: false, reason: `No signed-in YouTube session was found (checked ${sources.map((s) => s.label).join(', ')})` };
}
