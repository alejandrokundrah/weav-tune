import { BadgeCheck, ChevronRight, Headphones, Sparkles } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { PlayIcon } from '@/components/icons/Transport';
import { sizedArtwork } from '@/lib/artwork';

interface HomeHeroProps {
  /** "Featured Artist", or the greeting when there is no artist yet. */
  eyebrow: string;
  title: string;
  /** "206M monthly audience". */
  detail: string | null;
  image: string | null;
  /** Where the artist's page is; null when the hero is only a greeting. */
  href: string | null;
  onPlay: (() => void) | null;
  /** Still fetching the artist: the card holds its shape. */
  loading?: boolean;
}

/**
 * The home screen's featured card: a pane of Liquid Glass over the artist's photograph, which
 * melts into the glass from the right. The photograph is also blurred behind the whole card, so
 * the glass takes its colours from the artist.
 */
export function HomeHero({ eyebrow, title, detail, image, href, onPlay, loading }: HomeHeroProps) {
  const photo = image ? sizedArtwork(image, 900, 16 / 9) : null;
  return (
    <section className="wh-hero wh-glass" aria-label={eyebrow} data-loading={loading || undefined}>
      {photo && <img className="wh-hero-wash" src={photo} alt="" aria-hidden="true" referrerPolicy="no-referrer" decoding="async" />}
      {photo && <img className="wh-hero-photo" src={photo} alt="" referrerPolicy="no-referrer" decoding="async" fetchPriority="high" />}
      <div className="wh-hero-copy">
        <p className="wh-eyebrow">
          {href ? <BadgeCheck size={17} strokeWidth={2.2} aria-hidden="true" /> : <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />}
          {eyebrow}
        </p>
        <h1 className="wh-hero-title">{title}</h1>
        {detail && (
          <p className="wh-hero-detail">
            <Headphones size={17} strokeWidth={2.2} aria-hidden="true" />
            {detail}
          </p>
        )}
        <div className="wh-hero-actions">
          {onPlay && (
            <button className="wh-pill wh-pill-key" onClick={onPlay}>
              <PlayIcon size={18} />
              Play
            </button>
          )}
          {href && (
            <PrefetchLink className="wh-pill wh-pill-glass" to={href}>
              View Artist
              <ChevronRight size={16} strokeWidth={2.6} />
            </PrefetchLink>
          )}
        </div>
      </div>
    </section>
  );
}
