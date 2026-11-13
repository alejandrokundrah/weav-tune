import { ChevronRight, LogIn } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { LogoMark } from '@/components/icons/LogoMark';
import { Artwork } from '@/components/music/Artwork';
import { formatDuration, hrefFor } from '@/components/music/links';
import { playList } from '@/components/music/play';
import type { MusicItem, Track } from '@/data/music/types';
import type { QueueSource } from '@/playback/queue/timeline';
import { useYtAuth } from '@/extension/useYtAuth';
import { usePlayer } from '@/state/player';

/** The listener, as the account the extension reports; a guest with a way in otherwise. */
export function ProfileCard() {
  const status = useYtAuth();
  const active = status.state === 'ready' && status.auth.connected ? status.auth.active : null;
  return (
    <div className="wh-profile wh-card">
      {active?.avatarUrl ? (
        <img className="wh-avatar" src={active.avatarUrl} alt="" width={44} height={44} referrerPolicy="no-referrer" />
      ) : (
        <span className="wh-avatar wh-avatar-mark" aria-hidden="true">
          {active ? active.name.slice(0, 1).toUpperCase() : <LogoMark size={22} />}
        </span>
      )}
      <div className="wh-profile-text">
        <strong>{active?.name ?? 'Guest listener'}</strong>
        <span>{active ? 'YouTube Music' : 'Not signed in'}</span>
      </div>
      {!active && (
        <PrefetchLink className="wh-icon-btn" to="/settings" aria-label="Sign in" title="Sign in">
          <LogIn size={18} strokeWidth={2.2} />
        </PrefetchLink>
      )}
    </div>
  );
}

/**
 * Artists the featured one's listeners also play, one large captioned card at a time on
 * a scroll-snapped track; the dots follow the scroll and jump to a card.
 */
export function FansAlsoLike({ artists }: { artists: MusicItem[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);
  const shown = artists.slice(0, 8);
  const follow = useCallback(() => {
    const el = track.current;
    if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }, []);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Fans Also Like">
      <header className="wh-heading wh-heading-small">
        <h2>Fans Also Like</h2>
      </header>
      <ul ref={track} className="wh-fans" onScroll={follow}>
        {shown.map((artist) => (
          <li key={artist.id}>
            <PrefetchLink className="wh-fan" to={hrefFor(artist) ?? '#'}>
              <Artwork src={artist.thumbnail} displayWidth={304} radius="24px" />
              <span className="wh-fan-caption">
                <strong>{artist.title}</strong>
                <span>Artist</span>
              </span>
            </PrefetchLink>
          </li>
        ))}
      </ul>
      {shown.length > 1 && (
        <div className="wh-dots" role="group" aria-label="Choose artist">
          {shown.map((artist, i) => (
            <button
              key={artist.id}
              aria-label={artist.title}
              aria-current={i === page}
              onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** The latest songs the listener played (or the feed's quick picks), each one starting the list from there. */
export function RecentPlayed({ title, tracks, source, to }: { title: string; tracks: Track[]; source: QueueSource; to: string | null }) {
  const playingId = usePlayer((s) => s.nowPlaying?.videoId ?? null);
  if (tracks.length === 0) return null;
  return (
    <section aria-label={title} className="wh-recent">
      <header className="wh-heading wh-heading-small">
        <h2>{title}</h2>
        {to && (
          <PrefetchLink className="wh-see-all" to={to}>
            See All
            <ChevronRight size={15} strokeWidth={2.6} />
          </PrefetchLink>
        )}
      </header>
      <ul className="wh-recent-list">
        {tracks.map((track, i) => (
          <li key={`${track.videoId}-${i}`}>
            <button className="wh-recent-row" data-current={track.videoId === playingId || undefined} onClick={() => playList(tracks, i, { source })}>
              <Artwork src={track.thumbnail} displayWidth={44} radius="9px" />
              <span className="wh-recent-text">
                <strong>{track.title}</strong>
                <span>{track.artists.map((a) => a.name).join(', ') || track.album?.name || ''}</span>
              </span>
              {track.durationSec != null && <span className="wh-recent-time">{formatDuration(track.durationSec)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
