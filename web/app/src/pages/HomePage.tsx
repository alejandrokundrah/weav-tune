import { useQuery } from '@tanstack/react-query';
import { useRemoteConfig } from '@/config/remote';
import { syncPublished } from '@/addons/client';
import { RefreshCw, Settings, Sparkles, ListMusic } from 'lucide-react';
import { useNavigate } from 'react-router';
import { PrefetchLink } from '@/components/PrefetchLink';
import { queryClient } from '@/lib/queryClient';
import { homeSections } from './homeSections';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { browseHref } from '@/components/music/links';
import { playList, toTrack } from '@/components/music/play';
import { SearchField } from '@/components/music/SearchField';
import { Shelves } from '@/components/music/ShelfView';
import { LoadError, LoadMoreError, NeedsExtension } from '@/components/music/States';
import { artistQuery, useHome, useLibrary, useYouTubeReady } from '@/data/music/queries';
import type { Track } from '@/data/music/types';
import { FansAlsoLike, ProfileCard, RecentPlayed } from './home/HomeAside';
import { HomeHero } from './home/HomeHero';
import { feedArtists, pickFeaturedArtist, pickReleases, pickSimilarArtists } from './home/featured';
import { PopularReleases } from './home/PopularReleases';
import { PopularSongs } from './home/PopularSongs';
import { HomeSkeleton } from '@/skeletons/PageSkeletons';
import { ShelfSkeleton } from '@/skeletons/ShelfSkeleton';

const RECENT_TITLE = 'Recently Played';
const RECENT_LIMIT = 20;
const RECENT_SOURCE = { title: RECENT_TITLE, type: 'home' as const };

/**
 * The account's listening history, newest first, one row per song
 * (YtMusicRepository.recentlyPlayed): the first 20, signed in only. The same
 * query as Library's Recently Played, so either page warms the other.
 */
function useRecentlyPlayed(): Track[] {
  const history = useLibrary('recent');
  const first = history.data?.pages[0]?.data.tracks ?? [];
  const seen = new Set<string>();
  return first.filter((t) => !seen.has(t.videoId) && seen.add(t.videoId)).slice(0, RECENT_LIMIT);
}

/** The artist behind the hero, once the featured one is known. Waits for the extension like every query. */
function useFeaturedArtistPage(id: string | null) {
  const { ready } = useYouTubeReady();
  return useQuery({ ...artistQuery(id ?? ''), enabled: ready && !!id });
}

/**
 * The home screen, in Liquid Glass: a search bar, the featured artist's card with their releases
 * and top songs, and a rail with the listener, similar artists and what they played last. The
 * feed's own shelves follow underneath, as before.
 */
export default function HomePage() {
  const runtime = useRemoteConfig(s => s.config.data);
  const { missing } = useYouTubeReady();
  const home = useHome();
  const recent = useRecentlyPlayed();
  const sentinel = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Loads the next shelves before the bottom comes into view; after a failed
  // page it waits for Try Again rather than retrying on every scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !home.hasNextPage || home.isFetchNextPageError) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !home.isFetchingNextPage) void home.fetchNextPage();
      },
      { root: document.getElementById('scrollable-page'), rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [home.hasNextPage, home.isFetchingNextPage, home.isFetchNextPageError, home.fetchNextPage, runtime.sections]);

  // YouTube's feed can carry its own, older Recently Played; the history wins, as on the phone.
  const shelves = useMemo(
    () =>
      (home.data?.pages ?? [])
        .flatMap((page) => page.data)
        .filter((shelf) => !(recent.length > 0 && shelf.title.trim().toLowerCase() === RECENT_TITLE.toLowerCase())),
    [home.data, recent.length],
  );
  const featured = useMemo(() => pickFeaturedArtist(recent, shelves), [recent, shelves]);
  const artist = useFeaturedArtistPage(featured?.id ?? null);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const topbar = (
    <div className="wh-topbar">
      <SearchField initial="" onSearch={(q) => navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')} />
      <button className="ot-circle-button" aria-label="Refresh recommendations" disabled={home.isFetching || missing} onClick={() => {
        void syncPublished(true);
        void queryClient.resetQueries({ queryKey: ['music', 'home'] });
        void queryClient.invalidateQueries({ queryKey: ['music', 'library'] });
      }}><RefreshCw size={20} className={home.isFetching ? 'animate-spin' : ''} /></button>
      <PrefetchLink className="ot-circle-button" to="/settings" aria-label="Settings"><Settings size={20} /></PrefetchLink>
    </div>
  );
  const banners = runtime.banners.filter(b => b.enabled && b.platforms.includes('web')).map(b => (
    <section className="ot-banner" key={b.id} aria-label={b.title}><h2>{b.title}</h2><p>{b.body}</p><div><a href={b.url} target="_blank" rel="noreferrer">{b.action} ↗</a></div></section>
  ));
  const top = <div className="wh-home" style={{ paddingBottom: 0 }}><div className="wh-main">{topbar}</div></div>;
  if (missing) {
    return (
      <>
        {top}{banners}
        <NeedsExtension />
      </>
    );
  }
  // Only a failed first page replaces the feed; a later one is shown under it.
  if (home.isError && !home.data) {
    return (
      <>
        {top}{banners}
        <LoadError error={home.error} onRetry={() => void home.refetch()} />
      </>
    );
  }
  if (!home.data) return <>{top}{banners}<HomeSkeleton heading={false} /></>;

  const arranged = homeSections(shelves);
  const data = artist.data;
  const topSongs = data?.topSongs.slice(0, 8) ?? [];
  const topSource = { title: `${data?.name ?? ''}: Top Songs`, type: 'artist' as const, id: data?.id ?? '' };
  const releases = data ? pickReleases(data.shelves) : [];
  const similar = data ? pickSimilarArtists(data.shelves, data.id) : [];
  const fans = similar.length > 0 ? similar : feedArtists(shelves, featured?.id ?? null);
  const quick: Track[] = (arranged.quick?.items ?? []).filter((i) => i.kind === 'song' || i.kind === 'video').slice(0, 12).map((i) => toTrack(i));
  const railTracks = recent.length > 0 ? recent : quick;

  return (
    <>
      {banners.length > 0 && <div className="wh-home" style={{ paddingBottom: 0 }}><div className="wh-main">{banners}</div></div>}
      <div className="wh-home">
        <div className="wh-main">
          {topbar}
          {data ? (
            <HomeHero
              eyebrow="Featured Artist"
              title={data.name}
              detail={data.audience}
              image={data.heroImage}
              href={`/artist/${encodeURIComponent(data.id)}`}
              onPlay={data.topSongs.length > 0 ? () => playList(data.topSongs, 0, { source: topSource }) : null}
            />
          ) : (
            <HomeHero
              eyebrow={greeting}
              title={featured ? (featured.name || "What's playing?") : "What's playing?"}
              detail={null}
              image={null}
              href={null}
              onPlay={null}
              loading={!!featured && !artist.isError}
            />
          )}
          {data && <PopularReleases items={releases} seeAll={`/artist/${encodeURIComponent(data.id)}`} />}
          {data && <PopularSongs tracks={topSongs} source={topSource} seeAll={data.topSongsSeeAll ? browseHref(data.topSongsSeeAll) : null} />}
        </div>
        <aside className="wh-aside" aria-label="For you">
          <ProfileCard />
          <FansAlsoLike artists={fans} />
          <RecentPlayed
            title={recent.length > 0 ? 'Recently Played' : 'Quick Picks'}
            tracks={railTracks}
            source={recent.length > 0 ? RECENT_SOURCE : { title: 'Quick picks', type: 'home' }}
            to={recent.length > 0 ? '/library/recent' : null}
          />
        </aside>
      </div>
      <div className="wh-more">
        {runtime.sections.filter(s => s.enabled).map(section => {
          const title = (fallback: string) => section.title || fallback;
          switch (section.id) {
            // Quick picks live in the rail now.
            case 'quick-picks': return null;
            case 'mixes': return <div className="ot-home-links" key={section.id}><PrefetchLink to="/library/made-for-you"><Sparkles size={18} />{title('Made for you')}</PrefetchLink><PrefetchLink to="/library/playlists"><ListMusic size={18} />Your playlists</PrefetchLink></div>;
            case 'featured-playlists': return runtime.playlists.length > 0 && <Shelves key={section.id} shelves={[{
              title: title('From the community'), strapline: null, layout: 'square', seeAll: null,
              items: runtime.playlists.map(p => ({ kind: 'playlist', id: p.browseId, title: p.title, subtitle: 'Weav-Tune picks', artists: [], album: null, thumbnail: p.artwork || null, wide: false, durationSec: null, explicit: false })),
            }]} />;
            case 'recommendations': return <Fragment key={section.id}>{section.title && <h2 className="mx-5 type-title-2-emphasized">{section.title}</h2>}<Shelves shelves={arranged.shelves} /></Fragment>;
            // These shelves are native-only until their web counterparts are implemented.
            case 'speed-dial': case 'spotify-mixes': return null;
          }
        })}
      </div>
      {runtime.sections.some(s => s.id === 'recommendations' && s.enabled) && <div ref={sentinel} />}
      {home.isFetchingNextPage && <ShelfSkeleton kind="square" />}
      {home.isFetchNextPageError && <LoadMoreError onRetry={() => void home.fetchNextPage()} />}
    </>
  );
}
