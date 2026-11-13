import { publicHttps } from '@weavtune/shared/addons';
import {
  BRIDGE_PROTOCOL,
  errorResponse,
  okResponse,
  type BridgeRequest,
  type BridgeResponse,
  type Capability,
  type HttpRequest,
  type HttpResponse,
  type YtAuthState,
} from '@weavtune/shared/bridge';

/**
 * The bridge the web player already speaks to its browser extension, answered by the app itself
 * (web/extension/entrypoints/background.ts). What needs a browser's cookie jar (signed-in YouTube
 * Music, Spotify, Discord) isn't offered: `ping` leaves those capabilities out, and the player
 * shows each as unavailable.
 */

/** Lyric providers the page can't reach itself (web/extension/lib/lyricHosts.ts). */
export const LYRIC_ORIGINS = [
  'https://lrc.red',
  'https://lyrics-api.binimum.org',
  'https://lyrics-api.boidu.dev',
  'https://unison.boidu.dev',
  'https://lyrics.paxsenix.org',
  'https://api.paxsenix.org',
  'https://lyricsplus.prjktla.my.id',
  'https://lyricsplus.atomix.one',
  'https://lyricsplus.binimum.org',
  'https://lyricsplus.prjktla.workers.dev',
  'https://lyricsplus-seven.vercel.app',
  'https://lyrics-plus-backend.vercel.app',
  'https://lrclib.net',
  'https://mobileservice.kugou.com',
  'https://lyrics.kugou.com',
  'https://apic.musixmatch.com',
  'https://www.musixmatch.com',
  'https://genius.com',
  'https://music.apple.com',
  'https://amp-api.music.apple.com',
] as const;

export const CAPABILITIES: Capability[] = ['yt', 'addon', 'lyrics'];

/** Where an anonymous `yt.fetch` may go: BotGuard, which a page can't call with YouTube's Origin. */
const YT_ALLOWED = [/^https:\/\/www\.youtube\.com\/api\/jnn\//];
const ADDON_MAX_BYTES = 2 * 1024 * 1024;

export type Fetch = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array; signal?: AbortSignal }) => Promise<Response>;

export interface HostOptions {
  version: string;
  fetch: Fetch;
  /** Hosts the user has allowed for add-ons, kept between runs. */
  grants: { has(origin: string): boolean; add(origin: string): void };
}

const SIGNED_OUT: YtAuthState = { browserSignedIn: false, connected: false, signedIn: false, accounts: [], active: null, problem: null };

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function serialise(response: Response): Promise<HttpResponse> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => (headers[key] = value));
  const type = response.headers.get('content-type') ?? '';
  const textual = /json|text|javascript|xml|html/.test(type) || !type;
  return {
    status: response.status,
    headers,
    url: response.url,
    bodyEncoding: textual ? 'text' : 'base64',
    body: textual ? await response.text() : toBase64(new Uint8Array(await response.arrayBuffer())),
  };
}

class HostError extends Error {
  constructor(readonly code: 'forbidden' | 'permission' | 'unsupported' | 'unauthenticated', message: string) {
    super(message);
  }
}

export function createHost(options: HostOptions) {
  async function ytFetch(request: HttpRequest & { auth?: boolean }): Promise<HttpResponse> {
    if (request.auth) throw new HostError('unauthenticated', 'Signed-in YouTube Music is not available in the desktop app yet.');
    if (!YT_ALLOWED.some((pattern) => pattern.test(request.url))) {
      const { origin, pathname } = new URL(request.url);
      throw new HostError('forbidden', `yt.fetch doesn't serve ${origin}${pathname}`);
    }
    const body = request.body === undefined ? undefined : request.bodyEncoding === 'base64' ? fromBase64(request.body) : request.body;
    return serialise(await options.fetch(request.url, { method: request.method ?? 'GET', headers: request.headers ?? {}, body, signal: AbortSignal.timeout(30_000) }));
  }

  async function addonFetch(request: HttpRequest): Promise<HttpResponse> {
    const url = publicHttps(request.url);
    if ((request.method && request.method !== 'GET') || request.body || (request.headers && Object.keys(request.headers).length)) {
      throw new Error('Addon requests only allow GET without custom headers');
    }
    if (!options.grants.has(url.origin)) throw new HostError('permission', 'Allow this addon host from Audio add-ons first');
    const response = await options.fetch(url.href, { signal: AbortSignal.timeout(8000) });
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty addon response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > ADDON_MAX_BYTES) throw new Error('Addon response too large');
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const buffer = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, at);
      at += chunk.length;
    }
    return { status: response.status, headers: { 'retry-after': response.headers.get('retry-after') ?? '' }, body: new TextDecoder().decode(buffer), bodyEncoding: 'text', url: url.href };
  }

  async function lyricsFetch(request: HttpRequest): Promise<HttpResponse> {
    const url = new URL(request.url);
    if (!(LYRIC_ORIGINS as readonly string[]).includes(url.origin)) throw new HostError('forbidden', `lyrics.fetch doesn't serve ${url.origin}`);
    return serialise(
      await options.fetch(url.href, {
        method: request.method ?? 'GET',
        headers: request.headers ?? {},
        ...(request.body !== undefined && { body: request.body }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  return async function handle(request: BridgeRequest): Promise<BridgeResponse> {
    if (request.protocol !== BRIDGE_PROTOCOL) {
      return errorResponse(request.id, 'protocol', `The page speaks bridge protocol ${request.protocol}; the app speaks ${BRIDGE_PROTOCOL}.`);
    }
    try {
      switch (request.method) {
        case 'ping':
          return okResponse<'ping'>(request.id, { version: options.version, protocol: BRIDGE_PROTOCOL, browser: 'chromium', capabilities: CAPABILITIES });
        case 'yt.fetch':
          return okResponse<'yt.fetch'>(request.id, await ytFetch((request as BridgeRequest<'yt.fetch'>).params));
        case 'yt.authState':
        case 'yt.selectChannel':
        case 'yt.setConnected':
          return okResponse<'yt.authState'>(request.id, SIGNED_OUT);
        case 'addon.requestPermission': {
          const { url, urls = [] } = (request as BridgeRequest<'addon.requestPermission'>).params;
          // Adding the add-on in settings is the user's own choice; there's no browser prompt to answer.
          for (const origin of new Set([url, ...urls].map((u) => publicHttps(u).origin))) options.grants.add(origin);
          return okResponse<'addon.requestPermission'>(request.id, {});
        }
        case 'addon.fetch':
          return okResponse<'addon.fetch'>(request.id, await addonFetch((request as BridgeRequest<'addon.fetch'>).params));
        case 'lyrics.fetch':
          return okResponse<'lyrics.fetch'>(request.id, await lyricsFetch((request as BridgeRequest<'lyrics.fetch'>).params));
        case 'lyrics.permissions': {
          const origins = (request as BridgeRequest<'lyrics.permissions'>).params.origins ?? [];
          return okResponse<'lyrics.permissions'>(request.id, { granted: origins.filter((o) => (LYRIC_ORIGINS as readonly string[]).includes(o)) });
        }
        case 'lyrics.requestPermissions':
          return okResponse<'lyrics.requestPermissions'>(request.id, {});
        default:
          return errorResponse(request.id, 'unsupported', `${request.method} isn't available in the desktop app.`);
      }
    } catch (error) {
      if (error instanceof HostError) return errorResponse(request.id, error.code, error.message);
      return errorResponse(request.id, error instanceof Error && error.name === 'TimeoutError' ? 'network' : 'internal', error instanceof Error ? error.message : String(error));
    }
  };
}
