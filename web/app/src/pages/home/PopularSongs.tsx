import { ChevronRight, Clock3, Headphones } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { PauseIcon, PlayIcon } from '@/components/icons/Transport';
import { Artwork } from '@/components/music/Artwork';
import { ExplicitBadge } from '@/components/music/ExplicitBadge';
import { FavoriteButton } from '@/components/music/FavoriteButton';
import { artistHref, formatDuration } from '@/components/music/links';
import { playList } from '@/components/music/play';
import { TrackMenu } from '@/components/music/TrackMenu';
import type { Track } from '@/data/music/types';
import type { QueueSource } from '@/playback/queue/timeline';
import { usePlayer } from '@/state/player';

/** "1.9M plays" reads as the number the design shows with a headphone. */
const listens = (plays: string | null) => plays?.replace(/\s*plays?$/i, '') ?? null;

/**
 * The artist's top songs as glass rows: number (or the play button on hover), artwork and title,
 * listens, length, favorite and menu. The song that is playing takes the key colour.
 */
export function PopularSongs({ tracks, source, seeAll }: { tracks: Track[]; source: QueueSource; seeAll: string | null }) {
  const playingId = usePlayer((s) => s.nowPlaying?.videoId ?? null);
  const status = usePlayer((s) => s.status);
  const toggle = usePlayer((s) => s.togglePlay);
  if (tracks.length === 0) return null;
  return (
    <section aria-label="Popular Songs">
      <header className="wh-heading">
        <h2>Popular Songs</h2>
        {seeAll && (
          <PrefetchLink className="wh-see-all" to={seeAll}>
            See All
            <ChevronRight size={15} strokeWidth={2.6} />
          </PrefetchLink>
        )}
      </header>
      <ol className="wh-songs wh-glass">
        {tracks.map((track, i) => {
          const current = track.videoId === playingId;
          const running = current && (status === 'playing' || status === 'buffering' || status === 'loading');
          const artist = track.artists[0];
          const href = artistHref(artist?.id ?? null);
          return (
            <li key={`${track.videoId}-${i}`} className="wh-song" data-current={current || undefined}>
              <button
                className="wh-song-index"
                aria-label={running ? `Pause ${track.title}` : `Play ${track.title}`}
                onClick={() => (current ? toggle() : playList(tracks, i, { source }))}
              >
                <span className="wh-song-number">{i + 1}</span>
                <span className="wh-song-glyph">{running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</span>
              </button>
              <div className="wh-song-main">
                <div className="wh-song-art">
                  <Artwork src={track.thumbnail} displayWidth={54} radius="10px" />
                </div>
                <div className="wh-song-text">
                  <span className="wh-song-title">
                    {track.title}
                    {track.explicit && <ExplicitBadge />}
                  </span>
                  <span className="wh-song-artist">
                    {href ? (
                      <PrefetchLink to={href} className="hover:underline">
                        {artist?.name}
                      </PrefetchLink>
                    ) : (
                      (artist?.name ?? '')
                    )}
                  </span>
                </div>
              </div>
              <span className="wh-song-meta wh-song-plays">
                {listens(track.plays) && (
                  <>
                    <Headphones size={16} strokeWidth={2.2} aria-hidden="true" />
                    {listens(track.plays)}
                  </>
                )}
              </span>
              <span className="wh-song-meta wh-song-time">
                {track.durationSec != null && (
                  <>
                    <Clock3 size={16} strokeWidth={2.2} aria-hidden="true" />
                    {formatDuration(track.durationSec)}
                  </>
                )}
              </span>
              <FavoriteButton videoId={track.videoId} className="wh-icon-btn" size={18} />
              <TrackMenu track={track} className="wh-icon-btn" />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
