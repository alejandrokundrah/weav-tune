import { describe, expect, it } from 'vitest';
import { BRIDGE_CHANNEL, BRIDGE_PROTOCOL, type BridgeRequest } from '@weavtune/shared/bridge';
import { createHost, type Fetch, type SpotifyService, type YtService } from './host';

const request = (method: string, params: unknown = {}, protocol = BRIDGE_PROTOCOL) =>
  ({ channel: BRIDGE_CHANNEL, protocol, direction: 'to-extension', id: 'r1', method, params }) as BridgeRequest;

const SIGNED_OUT = { browserSignedIn: false, connected: true, signedIn: false, accounts: [], active: null, problem: null };

function host(fetch: Fetch = async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })) {
  const granted = new Set<string>();
  const calls: string[] = [];
  const signIns: string[] = [];
  const events: unknown[] = [];
  const ytCalls: string[] = [];
  const yt: YtService = {
    fetch: async (req) => {
      ytCalls.push(`${req.auth ? 'signed ' : ''}${req.url}`);
      return { status: 200, headers: {}, body: '{}', bodyEncoding: 'text', url: req.url };
    },
    authState: async () => SIGNED_OUT,
    selectChannel: async () => ({ ...SIGNED_OUT, signedIn: true }),
    setConnected: async (connected) => ({ ...SIGNED_OUT, connected }),
    importFromBrowser: async () => ({ ...SIGNED_OUT, signedIn: true }),
  };
  const spotify: SpotifyService = {
    authState: async () => ({ browserSignedIn: false, connected: true, signedIn: false, user: null, problem: null }),
    setConnected: async (connected) => ({ browserSignedIn: true, connected, signedIn: connected, user: null, problem: null }),
    playlists: async () => ({ items: [], total: 0, nextOffset: null }),
    tracks: async () => ({ items: [], total: 0, nextOffset: null }),
    playlistInfo: async () => ({}),
    searchTracks: async () => [],
    canvas: async () => 'https://canvaz.scdn.co/x.mp4',
    importFromBrowser: async () => ({ browserSignedIn: true, connected: true, signedIn: true, user: null, problem: null }),
  };
  const handle = createHost({
    yt,
    spotify,
    signIn: (service) => void signIns.push(service),
    broadcast: (event) => void events.push(event),
    version: '9.9.9',
    fetch: (url, init) => {
      calls.push(url);
      return fetch(url, init);
    },
    grants: { has: (o) => granted.has(o), add: (o) => void granted.add(o) },
  });
  return { handle, granted, calls, signIns, events, ytCalls };
}

describe('desktop bridge host', () => {
  it('reports what it can do: signed-in YouTube and Spotify, but no Discord', async () => {
    const res = await host().handle(request('ping'));
    expect(res).toMatchObject({ ok: true, result: { version: '9.9.9', capabilities: ['yt', 'yt.auth', 'yt.stats', 'addon', 'lyrics', 'spotify'] } });
  });

  it('refuses a newer or older protocol', async () => {
    expect(await host().handle(request('ping', {}, 99))).toMatchObject({ ok: false, error: { code: 'protocol' } });
  });

  it('hands YouTube requests, signed or not, to the extension’s own code', async () => {
    const h = host();
    expect(await h.handle(request('yt.fetch', { url: 'https://www.youtube.com/api/jnn/v1/Create' }))).toMatchObject({ ok: true, result: { status: 200 } });
    await h.handle(request('yt.fetch', { url: 'https://music.youtube.com/youtubei/v1/browse', auth: true }));
    expect(h.ytCalls).toEqual(['https://www.youtube.com/api/jnn/v1/Create', 'signed https://music.youtube.com/youtubei/v1/browse']);
  });

  it('tells the open player when a channel or connection changes', async () => {
    const h = host();
    expect(await h.handle(request('yt.authState', {}))).toMatchObject({ ok: true, result: { signedIn: false } });
    await h.handle(request('yt.selectChannel', { channelId: '0:own' }));
    await h.handle(request('spotify.setConnected', { connected: false }));
    expect(h.events).toMatchObject([{ event: 'yt.authState' }, { event: 'spotify.authState' }]);
  });

  it('imports a session from a browser, instead of opening a window', async () => {
    const h = host();
    expect(await h.handle(request('yt.importFromBrowser', {}))).toMatchObject({ ok: true, result: { signedIn: true } });
    expect(await h.handle(request('spotify.importFromBrowser', {}))).toMatchObject({ ok: true, result: { signedIn: true } });
  });

  it('opens the right sign-in window', async () => {
    const h = host();
    expect(await h.handle(request('yt.signIn', {}))).toMatchObject({ ok: true });
    expect(await h.handle(request('spotify.signIn', {}))).toMatchObject({ ok: true });
    expect(h.signIns).toEqual(['youtube', 'spotify']);
  });

  it('serves Spotify reads and canvases', async () => {
    const h = host();
    expect(await h.handle(request('spotify.playlists', { offset: 0 }))).toMatchObject({ ok: true, result: { total: 0 } });
    expect(await h.handle(request('spotify.canvas', { trackId: 't' }))).toMatchObject({ ok: true, result: { url: 'https://canvaz.scdn.co/x.mp4' } });
  });

  it('reports an error from a service with its code', async () => {
    const h = host();
    const failing = createHost({
      version: '1', fetch: async () => new Response(''), grants: { has: () => false, add: () => {} }, signIn: () => {}, broadcast: () => {},
      yt: { fetch: async () => { throw Object.assign(new Error('Not signed in'), { code: 'unauthenticated' }); }, authState: async () => SIGNED_OUT, selectChannel: async () => SIGNED_OUT, setConnected: async () => SIGNED_OUT, importFromBrowser: async () => SIGNED_OUT },
      spotify: undefined as never,
    });
    expect(await failing(request('yt.fetch', { url: 'https://music.youtube.com/youtubei/v1/browse', auth: true }))).toMatchObject({ ok: false, error: { code: 'unauthenticated' } });
    void h;
  });

  it('only fetches add-on hosts the user allowed, with a plain GET', async () => {
    const h = host();
    const url = 'https://addon.example.org/manifest.json';
    expect(await h.handle(request('addon.fetch', { url }))).toMatchObject({ ok: false, error: { code: 'permission' } });
    await h.handle(request('addon.requestPermission', { url }));
    expect(await h.handle(request('addon.fetch', { url }))).toMatchObject({ ok: true, result: { status: 200, body: '{"ok":true}' } });
    expect(await h.handle(request('addon.fetch', { url, method: 'POST' }))).toMatchObject({ ok: false });
    expect(await h.handle(request('addon.fetch', { url: 'http://addon.example.org/x' }))).toMatchObject({ ok: false });
    expect(await h.handle(request('addon.fetch', { url: 'https://127.0.0.1/x' }))).toMatchObject({ ok: false });
  });

  it('serves lyric providers on the list and no other host', async () => {
    const h = host();
    expect(await h.handle(request('lyrics.fetch', { url: 'https://lrclib.net/api/get?x=1' }))).toMatchObject({ ok: true });
    expect(await h.handle(request('lyrics.fetch', { url: 'https://example.com/' }))).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(await h.handle(request('lyrics.permissions', { origins: ['https://lrclib.net', 'https://example.com'] }))).toMatchObject({ ok: true, result: { granted: ['https://lrclib.net'] } });
  });

  it('says plainly what the app does not do', async () => {
    expect(await host().handle(request('discord.connect'))).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(await host().handle(request('discord.presence'))).toMatchObject({ ok: false, error: { code: 'unsupported' } });
  });
});
