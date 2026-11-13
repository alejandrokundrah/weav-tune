import type { MusicItem, Shelf, Track } from '@/data/music/types';

/** The artist the home hero stands behind: who the listener has played most, else the feed's first artist. */
export interface FeaturedArtist {
  id: string;
  name: string;
}

/**
 * Most-played artist in the listening history (ties go to the more recent), falling back to
 * the first artist YouTube's own feed offers. Null when there is neither.
 */
export function pickFeaturedArtist(recent: Track[], shelves: Shelf[]): FeaturedArtist | null {
  const counts = new Map<string, { artist: FeaturedArtist; count: number }>();
  for (const track of recent) {
    const first = track.artists.find((a) => a.id);
    if (!first?.id) continue;
    const seen = counts.get(first.id);
    if (seen) seen.count += 1;
    else counts.set(first.id, { artist: { id: first.id, name: first.name }, count: 1 });
  }
  let best: { artist: FeaturedArtist; count: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  if (best) return best.artist;

  for (const shelf of shelves) {
    const artist = shelf.items.find((item) => item.kind === 'artist');
    if (artist) return { id: artist.id, name: artist.title };
  }
  return null;
}

const ALBUMS = /albums?/i;
const RELEASES = /singles?|releases?|discograph/i;
const SIMILAR = /fans|similar|also like|might also/i;

/** The artist's own albums, for "Popular Releases": the first shelf of albums, else of singles. */
export function pickReleases(shelves: Shelf[]): MusicItem[] {
  const hasAlbums = (s: Shelf) => s.items.some((i) => i.kind === 'album');
  const named = shelves.find((s) => ALBUMS.test(s.title) && hasAlbums(s)) ?? shelves.find((s) => RELEASES.test(s.title) && hasAlbums(s));
  const any = named ?? shelves.find((s) => s.items.length > 0 && s.items.every((i) => i.kind === 'album'));
  return (any?.items ?? []).filter((i) => i.kind === 'album');
}

/** Other artists listeners of this one also play, for "Fans Also Like". */
export function pickSimilarArtists(shelves: Shelf[], excludeId: string | null): MusicItem[] {
  const shelf = shelves.find((s) => SIMILAR.test(s.title) && s.items.some((i) => i.kind === 'artist'));
  return (shelf?.items ?? []).filter((i) => i.kind === 'artist' && i.id !== excludeId && i.thumbnail);
}

/** Artists anywhere in the home feed, for the carousel when the featured artist has no similar-artists shelf. */
export function feedArtists(shelves: Shelf[], excludeId: string | null): MusicItem[] {
  const seen = new Set<string>();
  const out: MusicItem[] = [];
  for (const shelf of shelves) {
    for (const item of shelf.items) {
      if (item.kind !== 'artist' || item.id === excludeId || !item.thumbnail || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}
