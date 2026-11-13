import { describe, expect, it } from 'vitest';
import type { MusicItem, Shelf, Track } from '@/data/music/types';
import { feedArtists, pickFeaturedArtist, pickReleases, pickSimilarArtists } from './featured';

const track = (artistId: string | null, name = 'A'): Track => ({
  videoId: `${name}-${artistId}-${Math.random()}`,
  title: 't',
  artists: [{ name, id: artistId }],
  album: null,
  durationSec: 100,
  explicit: false,
  thumbnail: null,
  index: null,
  plays: null,
});

const item = (kind: MusicItem['kind'], id: string, thumbnail: string | null = 'x'): MusicItem => ({
  kind, id, title: id, subtitle: '', artists: [], album: null, thumbnail, wide: false, durationSec: null, explicit: false,
});

const shelf = (title: string, items: MusicItem[]): Shelf => ({ title, strapline: null, layout: 'square', items, seeAll: null });

describe('pickFeaturedArtist', () => {
  it('takes the most played artist in the history', () => {
    const recent = [track('UC1', 'One'), track('UC2', 'Two'), track('UC2', 'Two')];
    expect(pickFeaturedArtist(recent, [])).toEqual({ id: 'UC2', name: 'Two' });
  });

  it('skips artists YouTube does not link', () => {
    expect(pickFeaturedArtist([track(null)], [])).toBeNull();
  });

  it('falls back to the first artist in the feed', () => {
    const feed = [shelf('Mixes', [item('playlist', 'VL1')]), shelf('Artists', [item('artist', 'UC9')])];
    expect(pickFeaturedArtist([], feed)).toEqual({ id: 'UC9', name: 'UC9' });
  });
});

describe('pickReleases', () => {
  it('prefers the albums shelf and keeps only albums', () => {
    const shelves = [shelf('Singles', [item('album', 'S1')]), shelf('Albums', [item('album', 'A1'), item('playlist', 'P1')])];
    expect(pickReleases(shelves).map((i) => i.id)).toEqual(['A1']);
  });

  it('is empty when the artist has no albums', () => {
    expect(pickReleases([shelf('Videos', [item('video', 'V1')])])).toEqual([]);
  });
});

describe('pickSimilarArtists', () => {
  it('reads the fans-also-like shelf without the artist themself or faceless entries', () => {
    const shelves = [shelf('Fans might also like', [item('artist', 'UC1'), item('artist', 'UC2'), item('artist', 'UC3', null)])];
    expect(pickSimilarArtists(shelves, 'UC1').map((i) => i.id)).toEqual(['UC2']);
  });
});

describe('feedArtists', () => {
  it('collects distinct artists across shelves', () => {
    const shelves = [shelf('A', [item('artist', 'UC1'), item('artist', 'UC2')]), shelf('B', [item('artist', 'UC2'), item('artist', 'UC3')])];
    expect(feedArtists(shelves, 'UC1').map((i) => i.id)).toEqual(['UC2', 'UC3']);
  });
});
