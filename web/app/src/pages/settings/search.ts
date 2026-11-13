import { SECTIONS, type SectionId } from './sections';

export interface SettingEntry {
  section: SectionId;
  /** The row's own name: the page scrolls to the row that starts with it. */
  title: string;
  detail?: string;
  /** Other words people might look for. */
  words?: string;
}

/** Every setting, for the search box. Keep in step with the panes. */
export const ENTRIES: SettingEntry[] = [
  { section: 'audio', title: 'Audio sources', detail: 'Lossless FLAC from add-ons and 320 kbps from JioSaavn, in the order you choose.', words: 'addons add-ons jiosaavn lossless flac quality youtube music fallback' },

  { section: 'playback', title: 'AutoPlay', detail: 'When the queue ends, keep playing similar music.', words: 'radio queue similar endless' },
  { section: 'playback', title: 'Crossfade', detail: 'Blend the end of one song into the next.', words: 'fade transition seconds gapless' },

  { section: 'lyrics', title: 'Lyric sources', detail: 'Order, sources, syllable timing.', words: 'karaoke synced word timing providers' },
  { section: 'lyrics', title: 'Access to lyric sites', detail: 'KuGou, Musixmatch, Genius and others answer only the extension.', words: 'permission allow kugou musixmatch genius' },

  { section: 'appearance', title: 'Theme', detail: 'System, light or dark.', words: 'dark light mode night' },
  { section: 'appearance', title: 'Pure black', detail: 'True black surfaces in dark mode.', words: 'amoled oled' },
  { section: 'appearance', title: 'Liquid Glass', detail: 'The player and floating buttons bend what’s behind them, like a lens.', words: 'blur lens frosted transparency' },
  { section: 'appearance', title: 'Replica Liquid Glass shell', detail: 'Glass for the sidebar, panels and page chrome.', words: 'blur sidebar frosted transparency' },
  { section: 'appearance', title: 'Colors from artwork', detail: 'Let the playing song color Weav-Tune.', words: 'dynamic album art colour' },
  { section: 'appearance', title: 'Accent color', detail: 'Pick the color used for buttons and highlights.', words: 'colour swatch highlight' },
  { section: 'appearance', title: 'Background', detail: 'Mesh, gradient or echo glow behind the Now Playing screen.', words: 'now playing mesh gradient echo glow' },
  { section: 'appearance', title: 'Player style', detail: 'How the full-screen player looks.', words: 'classic vinyl cassette halo polaroid minimal lyrics-first' },
  { section: 'appearance', title: 'Animations', detail: 'Moving artwork, the player’s waves and page motion.', words: 'motion reduce reduced' },

  { section: 'accounts', title: 'YouTube Music', detail: 'Signed-in state comes from your browser.', words: 'google sign in account' },
  { section: 'accounts', title: 'Spotify', detail: 'Sign in to use Spotify playlists.', words: 'connect disconnect canvas account' },
  { section: 'accounts', title: 'Discord', detail: 'Show what you’re playing on your profile.', words: 'presence rich status' },
  { section: 'accounts', title: 'Weav-Tune Extension', detail: 'Needed for YouTube Music, Spotify and Discord.', words: 'browser install chrome firefox' },
  { section: 'accounts', title: 'Share listening activity to YouTube', detail: 'Songs you play here go to your YouTube Music history.', words: 'history recommendations scrobble' },
  { section: 'accounts', title: 'Spotify Canvas', detail: 'Spotify’s looping clip behind the lyrics.', words: 'video loop' },
  { section: 'accounts', title: 'Access to Apple Music', detail: 'Animated covers and artist art from Apple Music’s public pages.', words: 'permission allow' },
  { section: 'accounts', title: 'Artist Art', detail: 'Artist pages take Apple Music’s photo, logo and colour.', words: 'apple music photo' },
  { section: 'accounts', title: 'Animated Artwork', detail: 'Apple Music’s moving covers in the full-screen player and on album pages.', words: 'apple music video motion' },

  { section: 'together', title: 'Rooms', detail: 'Listen together with the web player and the Android app.', words: 'room host join invite friends' },

  { section: 'about', title: 'Weav-Tune for Android', detail: 'Download the Android app.', words: 'apk phone' },
  { section: 'about', title: 'Weav-Tune on TV', detail: 'Open the TV version.', words: 'television' },
  { section: 'about', title: 'Build an add-on', detail: 'Make your own audio source.', words: 'developer addon plugin' },
  { section: 'about', title: 'Source code', detail: 'Weav-Tune is open source on GitHub.', words: 'github repository' },
  { section: 'about', title: 'Community', detail: 'Report bugs and share add-ons on Discord.', words: 'support help feedback' },
];

const sectionName = (id: SectionId) => SECTIONS.find((s) => s.id === id)?.name ?? '';

/** Every word typed has to appear somewhere in an entry; names that start with the query come first. */
export function searchSettings(query: string): SettingEntry[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: [number, SettingEntry][] = [];
  for (const entry of ENTRIES) {
    const title = entry.title.toLowerCase();
    const haystack = `${title} ${entry.detail ?? ''} ${entry.words ?? ''} ${sectionName(entry.section)}`.toLowerCase();
    if (!tokens.every((t) => haystack.includes(t))) continue;
    scored.push([tokens.every((t) => title.startsWith(t) || title.includes(` ${t}`)) ? 0 : tokens.every((t) => title.includes(t)) ? 1 : 2, entry]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, entry]) => entry);
}
