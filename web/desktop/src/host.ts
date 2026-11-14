import { publicHttps } from '@weavtune/shared/addons';
import {
  BRIDGE_PROTOCOL,
  errorResponse,
  okResponse,
  type BridgeRequest,
  type BridgeResponse,
  type Capability,
  type BridgeEvent,
  type BridgeMethod,
  type HttpRequest,
  type HttpResponse,
  type SpotifyAuthState,
  type YtAuthState,
  type YtFetchParams,
} from '@weavtune/shared/bridge';

/**
 * The bridge the web player already speaks to its browser extension, answered by the app itself
 * (web/extension/entrypoints/background.ts). The signed-in services are the extension's own code
 * (ytAuth.ts, ytFetch.ts, spotify.ts) running against the app's cookie jar; they come in through
 * [HostOptions.yt] and [HostOptions.spotify]. Discord needs the desktop's local chat client and
 * isn't offered: `ping` leaves it out, and the player shows it as unavailable.
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

export const CAPABILITIES: Capability[] = ['yt', 'yt.auth', 'yt.stats', 'addon', 'lyrics', 'spotify'];

const ADDON_MAX_BYTES = 2 * 1024 * 1024;

export type Fetch = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array; signal?: AbortSignal }) => Promise<Response>;

/** YouTube Music's session, as web/extension/lib/ytAuth.ts and ytFetch.ts keep it. */
export interface YtService {
  fetch(request: YtFetchParams): Promise<HttpResponse>;
  authState(refresh: boolean): Promise<YtAuthState>;
  selectChannel(channelId: string): Promise<YtAuthState>;
  setConnected(connected: boolean): Promise<YtAuthState>;
  /** Pulls the session from an installed browser instead of opening a sign-in window. */
  importFromBrowser(): Promise<YtAuthState>;
}

/** Spotify's session, as web/extension/lib/spotify.ts keeps it. */
export interface SpotifyService {
  authState(refresh: boolean): Promise<SpotifyAuthState>;
  setConnected(connected: boolean): Promise<SpotifyAuthState>;
  importFromBrowser(): Promise<SpotifyAuthState>;
  playlists(offset: number): Promise<unknown>;
  tracks(playlistId: string, offset: number): Promise<unknown>;
  playlistInfo(playlistId: string): Promise<unknown>;
  searchTracks(query: string): Promise<unknown>;
  canvas(trackId: string): Promise<string | null>;
}

export interface HostOptions {
  version: string;
  fetch: Fetch;
  /** Hosts the user has allowed for add-ons, kept between runs. */
  grants: { has(origin: string): boolean; add(origin: string): void };
  yt: YtService;
  spotify: SpotifyService;
  /** Opens the app's own sign-in window. */
  signIn(service: 'youtube' | 'spotify'): void;
  /** Tells the open player about a change it didn't ask for. */
  broadcast(event: BridgeEvent): void;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

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
          return okResponse<'yt.fetch'>(request.id, await options.yt.fetch((request as BridgeRequest<'yt.fetch'>).params));
        case 'yt.authState':
          return okResponse<'yt.authState'>(request.id, await options.yt.authState((request as BridgeRequest<'yt.authState'>).params.refresh === true));
        case 'yt.selectChannel': {
          const state = await options.yt.selectChannel((request as BridgeRequest<'yt.selectChannel'>).params.channelId);
          options.broadcast({ event: 'yt.authState', data: state });
          return okResponse<'yt.selectChannel'>(request.id, state);
        }
        case 'yt.setConnected': {
          const state = await options.yt.setConnected((request as BridgeRequest<'yt.setConnected'>).params.connected === true);
          options.broadcast({ event: 'yt.authState', data: state });
          return okResponse<'yt.setConnected'>(request.id, state);
        }
        case 'yt.signIn':
          options.signIn('youtube');
          return okResponse<'yt.signIn'>(request.id, {});
        case 'yt.importFromBrowser':
          return okResponse<'yt.importFromBrowser'>(request.id, await options.yt.importFromBrowser());
        case 'spotify.authState':
          return okResponse<'spotify.authState'>(request.id, await options.spotify.authState((request as BridgeRequest<'spotify.authState'>).params.refresh === true));
        case 'spotify.setConnected': {
          const state = await options.spotify.setConnected((request as BridgeRequest<'spotify.setConnected'>).params.connected === true);
          options.broadcast({ event: 'spotify.authState', data: state });
          return okResponse<'spotify.setConnected'>(request.id, state);
        }
        case 'spotify.signIn':
          options.signIn('spotify');
          return okResponse<'spotify.signIn'>(request.id, {});
        case 'spotify.importFromBrowser':
          return okResponse<'spotify.importFromBrowser'>(request.id, await options.spotify.importFromBrowser());
        case 'spotify.playlists':
          return okResponse<'spotify.playlists'>(request.id, (await options.spotify.playlists((request as BridgeRequest<'spotify.playlists'>).params.offset ?? 0)) as never);
        case 'spotify.tracks': {
          const { playlistId, offset } = (request as BridgeRequest<'spotify.tracks'>).params;
          return okResponse<'spotify.tracks'>(request.id, (await options.spotify.tracks(playlistId, offset ?? 0)) as never);
        }
        case 'spotify.playlist':
          return okResponse<'spotify.playlist'>(request.id, (await options.spotify.playlistInfo((request as BridgeRequest<'spotify.playlist'>).params.playlistId)) as never);
        case 'spotify.searchTracks':
          return okResponse<'spotify.searchTracks'>(request.id, (await options.spotify.searchTracks((request as BridgeRequest<'spotify.searchTracks'>).params.query)) as never);
        case 'spotify.canvas':
          return okResponse<'spotify.canvas'>(request.id, { url: await options.spotify.canvas((request as BridgeRequest<'spotify.canvas'>).params.trackId) });
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
      const known = (error as { code?: string }).code;
      const code = known === 'forbidden' || known === 'unauthenticated' || known === 'permission' ? known : error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError') ? 'network' : 'internal';
      return errorResponse(request.id, code, error instanceof Error ? error.message : String(error));
    }
  };
}
