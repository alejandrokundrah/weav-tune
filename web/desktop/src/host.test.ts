import { describe, expect, it } from 'vitest';
import { BRIDGE_CHANNEL, BRIDGE_PROTOCOL, type BridgeRequest } from '@weavtune/shared/bridge';
import { createHost, type Fetch } from './host';

const request = (method: string, params: unknown = {}, protocol = BRIDGE_PROTOCOL) =>
  ({ channel: BRIDGE_CHANNEL, protocol, direction: 'to-extension', id: 'r1', method, params }) as BridgeRequest;

function host(fetch: Fetch = async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })) {
  const granted = new Set<string>();
  const calls: string[] = [];
  const handle = createHost({
    version: '9.9.9',
    fetch: (url, init) => {
      calls.push(url);
      return fetch(url, init);
    },
    grants: { has: (o) => granted.has(o), add: (o) => void granted.add(o) },
  });
  return { handle, granted, calls };
}

describe('desktop bridge host', () => {
  it('reports what it can do: no signed-in services', async () => {
    const res = await host().handle(request('ping'));
    expect(res).toMatchObject({ ok: true, result: { version: '9.9.9', capabilities: ['yt', 'addon', 'lyrics'] } });
  });

  it('refuses a newer or older protocol', async () => {
    expect(await host().handle(request('ping', {}, 99))).toMatchObject({ ok: false, error: { code: 'protocol' } });
  });

  it('answers YouTube sign-in questions as signed out', async () => {
    expect(await host().handle(request('yt.authState', {}))).toMatchObject({ ok: true, result: { signedIn: false, accounts: [] } });
  });

  it('serves only BotGuard through yt.fetch, and nothing signed', async () => {
    const h = host();
    expect(await h.handle(request('yt.fetch', { url: 'https://www.youtube.com/api/jnn/v1/Create', method: 'POST', body: '[]' }))).toMatchObject({ ok: true, result: { status: 200 } });
    expect(await h.handle(request('yt.fetch', { url: 'https://example.com/' }))).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(await h.handle(request('yt.fetch', { url: 'https://www.youtube.com/youtubei/v1/browse', auth: true }))).toMatchObject({ ok: false, error: { code: 'unauthenticated' } });
    expect(h.calls).toEqual(['https://www.youtube.com/api/jnn/v1/Create']);
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
    expect(await host().handle(request('spotify.signIn'))).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(await host().handle(request('discord.connect'))).toMatchObject({ ok: false, error: { code: 'unsupported' } });
  });
});
