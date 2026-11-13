import { ChevronRight } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { SquareLockup } from '@/components/music/Lockups';
import type { MusicItem } from '@/data/music/types';

/** The artist's albums in one scrolling row of cards (Popular Releases). */
export function PopularReleases({ items, seeAll }: { items: MusicItem[]; seeAll: string | null }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Popular Releases">
      <header className="wh-heading">
        <h2>Popular Releases</h2>
        {seeAll && (
          <PrefetchLink className="wh-see-all" to={seeAll}>
            See All
            <ChevronRight size={15} strokeWidth={2.6} />
          </PrefetchLink>
        )}
      </header>
      <ul className="wh-row">
        {items.map((item) => (
          <li key={item.id}>
            <SquareLockup item={item} width={190} />
          </li>
        ))}
      </ul>
    </section>
  );
}
