import { ArrowUpRight, ListMusic, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { MdOutlineExtension } from 'react-icons/md';
import { SiSpotify, SiYoutubemusic } from 'react-icons/si';
import { PrefetchLink, PrefetchNavLink } from '@/components/PrefetchLink';
import { LogoMark } from '@/components/icons/LogoMark';
import { Wordmark } from '@/components/icons/Wordmark';
import {
  AlbumsIcon,
  AllPlaylistsIcon,
  ArtistsIcon,
  HomeIcon,
  MadeForYouIcon,
  NewIcon,
  RecentlyAddedIcon,
  SearchIcon,
  SongsIcon,
  type NavIconProps,
} from '@/components/icons/NavIcons';
import { hrefFor } from '@/components/music/links';
import { config } from '@/config';
import { LIBRARY_SECTIONS, type LibrarySection } from '@/data/music/library';
import { useLibraryPlaylists, useSignedIn } from '@/data/music/queries';
import { useSpotifyPlaylists } from '@/data/spotify/queries';
import { useExtensionUpdate } from '@/extension/useExtensionUpdate';
import { useSpotifySignedIn } from '@/extension/useSpotifyAuth';
import { useUi } from '@/state/ui';
import { AccountButton } from './AccountButton';

interface NavItem {
  to: string;
  label: string;
  Icon: (props: NavIconProps) => React.ReactNode;
}

const PRIMARY: NavItem[] = [
  { to: '/search', label: 'Search', Icon: SearchIcon },
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/new', label: 'New', Icon: NewIcon },
];

const LIBRARY_ICONS: Record<Exclude<LibrarySection, 'playlists'>, NavItem['Icon']> = {
  recent: RecentlyAddedIcon,
  artists: ArtistsIcon,
  albums: AlbumsIcon,
  songs: SongsIcon,
  'made-for-you': MadeForYouIcon,
};

const LIBRARY: NavItem[] = (Object.keys(LIBRARY_ICONS) as (keyof typeof LIBRARY_ICONS)[]).map((section) => ({
  to: `/library/${section}`,
  label: LIBRARY_SECTIONS[section].title,
  Icon: LIBRARY_ICONS[section],
}));

// A sidebar row; NavLink sets aria-current on the page's own row.
const item =
  'ot-nav-item group flex h-9 items-center gap-2 mb-0.5 p-1 rounded-nav type-body-reduced text-primary hover:bg-quinary aria-[current=page]:bg-nav-selected';
// Each row's glyph sits in a rounded tile (sidebar.css .ws-tile): grey, and the accent colour on the page you are on.
function Tile({ children }: { children: ReactNode }) {
  return <span className="ws-tile">{children}</span>;
}
const navLabel = 'ot-side-label min-w-0 truncate';
// "Library", "Playlists" (report §1: 12px/15px 600, secondary, padding 4px 8px).
const sectionHeader = 'ot-side-header mt-4 px-2 py-1 type-callout-emphasized text-secondary';
const list = 'flex flex-col';

/** The folded rail names each icon in a tooltip; the open sidebar already shows the names. */
const tip = (label: string) => (useUi.getState().sidebarCollapsed ? label : undefined);

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  useUi((s) => s.sidebarCollapsed);
  return (
    <ul className={list}>
      {items.map(({ to, label, Icon }) => (
        <li key={to}>
          <PrefetchNavLink to={to} className={item} onClick={onNavigate} title={tip(label)}>
            <Tile>
              <Icon size={18} />
            </Tile>
            <span className={navLabel}>{label}</span>
          </PrefetchNavLink>
        </li>
      ))}
    </ul>
  );
}

/** Library and Playlists (report §1), once YouTube requests are made as the user. */
function LibraryNav({ onNavigate }: { onNavigate: () => void }) {
  const playlists = useLibraryPlaylists();
  return (
    <>
      <h2 className={sectionHeader}>Library</h2>
      <NavList items={LIBRARY} onNavigate={onNavigate} />
      <h2 className={sectionHeader}>Playlists</h2>
      <ul className={list}>
        <li>
          <PrefetchNavLink to="/library/playlists" className={item} onClick={onNavigate} title={tip(LIBRARY_SECTIONS.playlists.title)}>
            <Tile>
              <AllPlaylistsIcon size={18} />
            </Tile>
            <span className={navLabel}>{LIBRARY_SECTIONS.playlists.title}</span>
          </PrefetchNavLink>
        </li>
        {playlists.data?.map((playlist) => (
          // Each playlist's glyph is the same one, so the folded rail leaves them out.
          <li key={playlist.id} className="ot-side-extra">
            <PrefetchNavLink to={hrefFor(playlist) ?? '/library/playlists'} className={item} onClick={onNavigate}>
              <Tile>
                <ListMusic size={16} strokeWidth={2} />
              </Tile>
              <span className={navLabel}>{playlist.title}</span>
            </PrefetchNavLink>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Spotify's playlists, once the extension can read them as the user (prompt §7.1). */
function SpotifyNav({ onNavigate }: { onNavigate: () => void }) {
  const playlists = useSpotifyPlaylists();
  return (
    <>
      <h2 className={sectionHeader}>Spotify</h2>
      <ul className={list}>
        <li>
          <PrefetchNavLink to="/spotify" end className={item} onClick={onNavigate} title={tip('All Spotify Playlists')}>
            {/* Spotify's own mark, so it reads apart from All Playlists above it, folded or not. */}
            <Tile>
              <SiSpotify size={16} />
            </Tile>
            <span className={navLabel}>All Spotify Playlists</span>
          </PrefetchNavLink>
        </li>
        {playlists.data?.map((playlist) => (
          <li key={playlist.id} className="ot-side-extra">
            <PrefetchNavLink to={`/spotify/playlist/${encodeURIComponent(playlist.id)}`} className={item} onClick={onNavigate}>
              <Tile>
                <ListMusic size={16} strokeWidth={2} />
              </Tile>
              <span className={navLabel}>{playlist.name}</span>
            </PrefetchNavLink>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Where the music comes from: YouTube Music plays it, Spotify brings the playlists. */
function Sources({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="ws-sources ot-side-sources" aria-label="Sources">
      <PrefetchNavLink to="/spotify" end className="ws-source" onClick={onNavigate}>
        <SiSpotify size={24} className="text-[#1ed760]" />
        <span>Spotify</span>
      </PrefetchNavLink>
      <a className="ws-source" href="https://music.youtube.com" target="_blank" rel="noreferrer">
        <SiYoutubemusic size={24} className="text-[#ff0033]" />
        <span>YouTube Music</span>
      </a>
    </div>
  );
}

/** The left sidebar (report §1). */
export function Sidebar() {
  const drawerOpen = useUi((s) => s.drawerOpen);
  const setDrawerOpen = useUi((s) => s.setDrawerOpen);
  const update = useExtensionUpdate();
  const signedIn = useSignedIn();
  const spotifySignedIn = useSpotifySignedIn();
  const folded = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const close = () => setDrawerOpen(false);
  // The page and the player pill take their left edge from --web-navigation-width (tokens.css).
  useEffect(() => {
    if (folded) document.documentElement.dataset.sidebar = 'collapsed';
    else delete document.documentElement.dataset.sidebar;
  }, [folded]);

  return (
    <>
      {/* Below 484px the sidebar is a drawer opened from the top bar's menu button. */}
      <nav
        className="ot-side absolute inset-y-0 left-0 z-(--z-web-chrome) flex w-(--web-navigation-width) flex-col glass-material max-sm:w-[min(300px,82vw)] max-sm:-translate-x-full max-sm:shadow-glass max-sm:transition-transform max-sm:duration-(--duration-panel) max-sm:ease-panel max-sm:data-[open=true]:translate-none"
        data-open={drawerOpen}
        data-folded={folded}
        aria-label="Main"
      >
        <div className="ot-side-top mt-3 flex h-22 items-center justify-between pr-3 pl-7">
          <PrefetchLink to="/home" className="ot-side-wordmark inline-flex items-center gap-4 rounded-[6px]" aria-label="Weav-Tune, Home" onClick={close}>
            {/* The mark in its own colours, then the handwritten wordmark in the label colour (white on dark). */}
            <LogoMark size={40} />
            <Wordmark height={46} className="text-primary" />
          </PrefetchLink>
          {/* Folds the sidebar to a rail of icons and back. Phones have the drawer instead. */}
          <button
            className="grid size-8 flex-none place-items-center rounded-nav text-secondary transition-colors duration-150 hover:bg-quinary hover:text-primary max-sm:hidden"
            onClick={toggleSidebar}
            aria-label={folded ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!folded}
            title={`${folded ? 'Expand' : 'Collapse'} sidebar (${navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}+\\)`}
          >
            {folded ? <PanelLeftOpen size={18} strokeWidth={1.9} /> : <PanelLeftClose size={18} strokeWidth={1.9} />}
          </button>
        </div>
        <div className="ot-side-scroll min-h-0 flex-1 overflow-y-auto pr-3 pl-5 [scrollbar-width:none]">
          <NavList items={PRIMARY} onNavigate={close} />
          {signedIn && <LibraryNav onNavigate={close} />}
          {spotifySignedIn && <SpotifyNav onNavigate={close} />}
        </div>
        <div className="ot-side-bottom flex flex-col gap-2 pt-3 pr-3 pb-5 pl-5">
          <Sources onNavigate={close} />
          <PrefetchNavLink to="/extension" className={`${item} relative`} onClick={close} title={tip('Weav-Tune Extension')}>
            {/* Chrome's own toolbar glyph for extensions (Material "extension"). */}
            <Tile>
              <MdOutlineExtension size={17} />
            </Tile>
            <span className={navLabel}>Weav-Tune Extension</span>
            {update.state === 'available' && (
              <span className="ot-side-badge ml-auto rounded-[10px] bg-key px-[7px] py-0.5 type-subhead-emphasized text-white" title={`Version ${update.latest.version} is available`}>
                Update
              </span>
            )}
          </PrefetchNavLink>
          <div className="ot-side-full flex flex-col">
            <AccountButton />
          </div>
          <div className="ot-side-compact hidden flex-col">
            <AccountButton compact />
          </div>
          <div className="ot-side-foot flex items-center justify-between">
            <a className="ot-side-android inline-flex items-center gap-1 ps-1 type-callout text-primary hover:underline" href={config.androidAppUrl} target="_blank" rel="noreferrer">
              <span>Get the Android app</span>
              <ArrowUpRight size={14} strokeWidth={2} />
            </a>
            <PrefetchNavLink to="/settings" className="grid size-7 place-items-center rounded-nav text-secondary hover:bg-quinary hover:text-primary aria-[current=page]:bg-quinary aria-[current=page]:text-primary" aria-label="Settings" title="Settings" onClick={close}>
              <Settings size={17} strokeWidth={1.9} />
            </PrefetchNavLink>
          </div>
        </div>
      </nav>
      {drawerOpen && <div className="absolute inset-0 z-[calc(var(--z-web-chrome)-1)] hidden bg-scrim max-sm:block" onClick={close} aria-hidden="true" />}
    </>
  );
}

