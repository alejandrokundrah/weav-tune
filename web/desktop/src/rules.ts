/**
 * What the browser extension's declarativeNetRequest rules do (web/extension/lib/rules.ts), as
 * plain functions the window's session applies with webRequest. The page talks to YouTube from
 * the page itself: InnerTube answers only YouTube's own origin and sends no CORS headers, so the
 * app dresses the page's requests as YouTube's web clients and lets the answers through.
 *
 * Only requests to these hosts are touched, and only what the page or the app's own main process
 * sends; nothing is ever sent to a host that isn't listed.
 */

export interface HeaderEdits {
  set: Record<string, string>;
  remove: string[];
}

const YT = 'https://www.youtube.com';
const MUSIC = 'https://music.youtube.com';

const impersonate = (origin: string): Record<string, string> => ({ Origin: origin, Referer: `${origin}/`, 'X-Origin': origin });

/** The request headers the page's request to [url] needs, or null when [url] isn't one of YouTube's. */
export function pageRequestEdits(rawUrl: string): HeaderEdits | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const { hostname, pathname } = url;
  if (hostname === 'music.youtube.com' && pathname.startsWith('/youtubei/')) return { set: impersonate(MUSIC), remove: [] };
  if (hostname === 'www.youtube.com' && pathname.startsWith('/youtubei/')) return { set: impersonate(YT), remove: [] };
  if (hostname === 'www.youtube.com' && (pathname === '/sw.js_data' || pathname === '/iframe_api' || pathname.startsWith('/s/player/'))) {
    return { set: {}, remove: [] };
  }
  if (hostname.endsWith('.googlevideo.com') || hostname === 'googlevideo.com') {
    // Direct URLs minted for VISIONOS are fetched with no Origin or Referer at all; a YouTube web
    // Origin on them is refused with 403 mid-track.
    if (url.searchParams.get('c') === 'VISIONOS') return { set: {}, remove: ['Origin', 'Referer'] };
    const { Origin, Referer } = impersonate(YT);
    return { set: { Origin: Origin!, Referer: Referer! }, remove: [] };
  }
  return null;
}

/** Whether the page's answer from [url] gets the CORS headers that let it be read. */
export const allowsPageRead = (url: string): boolean => pageRequestEdits(url) !== null;

/**
 * Requests the app's main process makes itself (the bridge host), dressed as YouTube's own.
 * BotGuard's GenerateIT has to come from YouTube's origin, which a page can't send.
 */
export function mainRequestEdits(rawUrl: string): HeaderEdits | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname === 'www.youtube.com' && url.pathname.startsWith('/api/jnn/')) {
    const { Origin, Referer } = impersonate(YT);
    return { set: { Origin: Origin!, Referer: Referer! }, remove: [] };
  }
  if (url.hostname === 'amp-api.music.apple.com') return { set: { Origin: 'https://music.apple.com', Referer: 'https://music.apple.com/' }, remove: [] };
  if (url.hostname === 'musixmatch.com' || url.hostname.endsWith('.musixmatch.com')) return { set: { Cookie: 'mxm_bab=AB' }, remove: [] };
  return null;
}

/** Applies [edits] to a header map whose names may be in any case. */
export function applyEdits(headers: Record<string, string | string[]>, edits: HeaderEdits): Record<string, string | string[]> {
  const out = { ...headers };
  const drop = (name: string) => {
    for (const key of Object.keys(out)) if (key.toLowerCase() === name.toLowerCase()) delete out[key];
  };
  for (const name of edits.remove) drop(name);
  for (const [name, value] of Object.entries(edits.set)) {
    drop(name);
    out[name] = value;
  }
  return out;
}

/** Response headers that let the page read an anonymous answer. */
export function withCors(headers: Record<string, string[]> | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (!/^access-control-(allow-origin|expose-headers)$/i.test(key)) out[key] = value;
  }
  out['Access-Control-Allow-Origin'] = ['*'];
  out['Access-Control-Expose-Headers'] = ['*'];
  return out;
}
