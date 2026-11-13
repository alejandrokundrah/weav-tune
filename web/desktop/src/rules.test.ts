import { describe, expect, it } from 'vitest';
import { applyEdits, mainRequestEdits, pageRequestEdits, withCors } from './rules';

describe('page request rules', () => {
  it('dresses InnerTube calls as the matching YouTube web client', () => {
    expect(pageRequestEdits('https://music.youtube.com/youtubei/v1/browse')?.set).toMatchObject({ Origin: 'https://music.youtube.com' });
    expect(pageRequestEdits('https://www.youtube.com/youtubei/v1/player')?.set).toMatchObject({ Origin: 'https://www.youtube.com', Referer: 'https://www.youtube.com/' });
  });

  it('gives media hosts the YouTube origin, except for VISIONOS streams, which get none', () => {
    expect(pageRequestEdits('https://rr1---sn-x.googlevideo.com/videoplayback?c=WEB')?.set.Origin).toBe('https://www.youtube.com');
    expect(pageRequestEdits('https://rr1---sn-x.googlevideo.com/videoplayback?c=VISIONOS')).toEqual({ set: {}, remove: ['Origin', 'Referer'] });
  });

  it('leaves every other host and plain http alone', () => {
    expect(pageRequestEdits('https://example.com/youtubei/v1/browse')).toBeNull();
    expect(pageRequestEdits('http://www.youtube.com/youtubei/v1/browse')).toBeNull();
    expect(pageRequestEdits('https://www.youtube.com/watch?v=1')).toBeNull();
    expect(pageRequestEdits('https://evilgooglevideo.com/x')).toBeNull();
    expect(pageRequestEdits('not a url')).toBeNull();
  });

  it('does not rewrite BotGuard for the page: it allows any origin already', () => {
    expect(pageRequestEdits('https://www.youtube.com/api/jnn/v1/Create')).toBeNull();
  });
});

describe('main-process rules', () => {
  it('sends BotGuard from YouTube’s origin and nothing else', () => {
    expect(mainRequestEdits('https://www.youtube.com/api/jnn/v1/GenerateIT')?.set.Origin).toBe('https://www.youtube.com');
    expect(mainRequestEdits('https://www.youtube.com/youtubei/v1/browse')).toBeNull();
  });
});

describe('headers', () => {
  it('replaces headers whatever their case', () => {
    const out = applyEdits({ origin: 'app://weavtune', Referer: 'app://weavtune/', Accept: '*/*' }, { set: { Origin: 'https://www.youtube.com' }, remove: ['referer'] });
    expect(out).toEqual({ Accept: '*/*', Origin: 'https://www.youtube.com' });
  });

  it('replaces CORS answers with a permissive one', () => {
    const out = withCors({ 'access-control-allow-origin': ['https://x'], 'Content-Type': ['application/json'] });
    expect(out['Access-Control-Allow-Origin']).toEqual(['*']);
    expect(out['Content-Type']).toEqual(['application/json']);
    expect(Object.keys(out).filter((k) => k.toLowerCase() === 'access-control-allow-origin')).toHaveLength(1);
  });
});
