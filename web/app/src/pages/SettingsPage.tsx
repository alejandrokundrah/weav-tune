import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useSearchParams } from 'react-router';
import { PrefetchLink } from '@/components/PrefetchLink';
import { LogoMark } from '@/components/icons/LogoMark';
import { useExtension } from '@/extension/useExtension';
import { useYtAuth } from '@/extension/useYtAuth';
import { AppearancePane } from './settings/AppearancePane';
import { AboutPane, AccountsPane, AudioPane, LyricsPane, PlaybackPane, TogetherPane, youtubeText } from './settings/panes';
import { searchSettings } from './settings/search';
import { SECTIONS, sectionById, type SectionId, type SectionMeta } from './settings/sections';
import { useSectionStatus } from './settings/status';
import { settingsUi } from './settingsStyles';
import { isDesktop } from '@/lib/desktop';

const LyricsSettings = lazy(() => import('@/shell/LyricsSettings').then((m) => ({ default: m.LyricsSettings })));

/** Below this width the list and the open category take turns; at or above it they sit side by side. */
const WIDE = 820;

function useWide(ref: RefObject<HTMLElement | null>, min: number): boolean {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWide(el.clientWidth >= min);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, min]);
  return wide;
}

/** The extension's state at the top of the list: what works now, and the one thing to do next. */
function ExtensionStrip() {
  const extension = useExtension();
  const yt = useYtAuth();
  const present = extension.state === 'present';
  return (
    <section className="ot-set-hero" aria-label="Weav-Tune Extension">
      <LogoMark size={22} className="ot-set-mark" />
      <div className="ot-set-hero-text">
        <p className="type-title-3-emphasized">{present ? 'Extension connected' : 'Extension not installed'}</p>
        <p className="type-callout text-secondary">
          {present ? `Version ${extension.extension.info.version}. YouTube Music: ${youtubeText(yt)}` : 'Needed for YouTube Music, Spotify and Discord.'}
        </p>
      </div>
      <PrefetchLink to="/extension" className={present ? 'ot-set-hero-button ot-quiet' : 'ot-set-hero-button'}>
        {present ? 'Manage' : 'Get it'}
      </PrefetchLink>
    </section>
  );
}

function Pane({ id, onOpenLyrics }: { id: SectionId; onOpenLyrics: () => void }) {
  switch (id) {
    case 'audio': return <AudioPane />;
    case 'playback': return <PlaybackPane />;
    case 'lyrics': return <LyricsPane onOpenSources={onOpenLyrics} />;
    case 'appearance': return <AppearancePane />;
    case 'accounts': return <AccountsPane />;
    case 'together': return <TogetherPane />;
    case 'about': return <AboutPane />;
  }
}

/** Finds the row a search result named, scrolls it into view and lights it for a moment. */
function flashRow(root: HTMLElement | null, title: string) {
  const row = Array.from(root?.querySelectorAll<HTMLElement>('.ot-set-pane section > *') ?? []).find((el) => el.textContent?.trim().startsWith(title));
  if (!row) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'false';
  row.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  row.setAttribute('data-flash', '');
  window.setTimeout(() => row.removeAttribute('data-flash'), 1800);
}

function Tile({ section, small }: { section: SectionMeta; small?: boolean }) {
  const Icon = section.icon;
  return (
    <span className={small ? 'ot-set-tile ot-set-tile-sm' : 'ot-set-tile'} style={{ background: section.color }} aria-hidden="true">
      <Icon size={small ? 14 : 16} strokeWidth={2.2} />
    </span>
  );
}

/**
 * Settings, as a list and the category it opens. Side by side where there's
 * room; on a phone the list is a screen of its own and a category slides in
 * after it. The sub-pages (Audio sources, Discord, Listen Together) keep
 * their own routes.
 */
export default function SettingsPage() {
  const root = useRef<HTMLDivElement>(null);
  const wide = useWide(root, WIDE);
  const [params, setParams] = useSearchParams();
  const selected = sectionById(params.get('s'));
  const open = selected ?? (wide ? SECTIONS[0]! : null);
  const focusTitle = params.get('f');
  const status = useSectionStatus();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchSettings(query), [query]);
  const [lyrics, setLyrics] = useState(false);

  const go = useCallback(
    (id: SectionId, focus?: string) => {
      const next = new URLSearchParams({ s: id });
      if (focus) next.set('f', focus);
      // Side by side, picking a category is a change of view, not a step to go back from.
      setParams(next, { replace: wide });
      document.getElementById('scrollable-page')?.scrollTo({ top: 0 });
    },
    [setParams, wide],
  );

  // A search result opens its category, then the row it named.
  useEffect(() => {
    if (!focusTitle || !open) return;
    const timer = window.setTimeout(() => {
      flashRow(root.current, focusTitle);
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.delete('f');
          return next;
        },
        { replace: true },
      );
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusTitle, open?.id, setParams]);

  const move = (e: KeyboardEvent<HTMLElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-cat]'));
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
    e.preventDefault();
    items[to]?.focus();
  };

  const searching = query.trim().length > 0;

  return (
    <div ref={root} className="ot-settings" data-view={selected ? 'detail' : 'list'}>
      <div className="ot-set-frame">
        <div className="ot-set-head">
          {selected && (
            <PrefetchLink to="/settings" className="ot-set-back">
              <ChevronLeft size={20} strokeWidth={2.25} />
              Settings
            </PrefetchLink>
          )}
          <h1 className="ot-set-pagetitle type-header-emphasized text-balance">Settings</h1>
        </div>

        <div className="ot-set-layout">
          <div className="ot-set-listcol">
            <div className="ot-set-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder="Search settings"
                aria-label="Search settings"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={14} strokeWidth={2.4} />
                </button>
              )}
            </div>

            {searching ? (
              <section className={`${settingsUi.group} ot-set-results`} aria-label="Search results" aria-live="polite">
                {results.length ? (
                  results.map((entry) => {
                    const section = sectionById(entry.section)!;
                    return (
                      <button
                        key={`${entry.section}:${entry.title}`}
                        className="ot-set-cat"
                        onClick={() => {
                          setQuery('');
                          go(entry.section, entry.title);
                        }}
                      >
                        <Tile section={section} small />
                        <span className="ot-set-cat-text">
                          <span className="ot-set-cat-name">{entry.title}</span>
                          <span className="ot-set-cat-status">{entry.detail}</span>
                        </span>
                        <span className="ot-set-where">{section.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="ot-set-empty">No settings match “{query.trim()}”. Try a shorter word, like “lyrics” or “glass”.</p>
                )}
              </section>
            ) : (
              <>
                {!isDesktop() && <ExtensionStrip />}
                <nav className={`${settingsUi.group} ot-set-cats`} aria-label="Settings categories" onKeyDown={move}>
                  {SECTIONS.map((section) => {
                    const s = status[section.id];
                    return (
                      <button key={section.id} data-cat className="ot-set-cat" aria-current={open?.id === section.id ? 'page' : undefined} onClick={() => go(section.id)}>
                        <Tile section={section} />
                        <span className="ot-set-cat-text">
                          <span className="ot-set-cat-name">{section.name}</span>
                          <span className="ot-set-cat-status">{s.text}</span>
                        </span>
                        {s.tone && <i className="ot-set-dot" data-tone={s.tone} aria-hidden="true" />}
                        <ChevronRight size={16} className="ot-set-chev" aria-hidden="true" />
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </div>

          <div className="ot-set-detail">
            {open && (
              <div className="ot-set-pane" key={open.id}>
                <header className="ot-set-pane-head">
                  <Tile section={open} />
                  <div>
                    <h2 className="type-title-1-emphasized">{open.name}</h2>
                    <p className="type-body-tall text-secondary">{open.blurb}</p>
                  </div>
                </header>
                <Pane id={open.id} onOpenLyrics={() => setLyrics(true)} />
              </div>
            )}
          </div>
        </div>
      </div>
      {lyrics && (
        <Suspense fallback={null}>
          <LyricsSettings onClose={() => setLyrics(false)} />
        </Suspense>
      )}
    </div>
  );
}
