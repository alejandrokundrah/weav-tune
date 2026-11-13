import { create } from 'zustand';

export const ACCENTS = [
  ['Weav Blue', '#25a0d4'], ['Cyan', '#49c4e2'], ['Sky', '#039be5'], ['Indigo', '#3949ab'],
  ['Teal', '#00897b'], ['Green', '#43a047'], ['Yellow', '#fdd835'], ['Amber', '#ff6f00'],
  ['Red', '#e53935'], ['Purple', '#8e24aa'], ['Pink', '#d81b60'], ['Brown', '#6d4c41'],
] as const;
export const PLAYER_STYLES = ['classic', 'vinyl', 'lyrics-first', 'minimal', 'cassette', 'halo', 'polaroid'] as const;
export interface Appearance {
  mode: 'system' | 'light' | 'dark';
  accent: string;
  pureBlack: boolean;
  artworkColors: boolean;
  playerBackground: 'mesh' | 'gradient' | 'echo';
  playerStyle: typeof PLAYER_STYLES[number];
  motion: boolean;
  /** The floating pills bend what's behind them (Chromium only; frosted elsewhere). */
  liquidGlass: boolean;
  /** The extracted Group 45.svg glass material on the app chrome; the Apple Music player is untouched. */
  replicaGlass: boolean;
}
export const DEFAULT_APPEARANCE: Appearance = {
  mode: 'system', accent: '#25a0d4', pureBlack: true, artworkColors: true,
  playerBackground: 'mesh', playerStyle: 'classic', motion: true, liquidGlass: true, replicaGlass: true,
};
export function appearanceOf(value: unknown): Appearance {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Appearance>;
  const rawAccent = !v.accent || v.accent === '#e53935' ? '#25a0d4' : v.accent;
  return {
    mode: ['system', 'light', 'dark'].includes(v.mode ?? '') ? v.mode! : DEFAULT_APPEARANCE.mode,
    accent: ACCENTS.some(([, color]) => color === rawAccent) ? rawAccent! : DEFAULT_APPEARANCE.accent,
    pureBlack: typeof v.pureBlack === 'boolean' ? v.pureBlack : true,
    artworkColors: typeof v.artworkColors === 'boolean' ? v.artworkColors : true,
    playerBackground: ['mesh', 'gradient', 'echo'].includes(v.playerBackground ?? '') ? v.playerBackground! : 'mesh',
    playerStyle: PLAYER_STYLES.includes(v.playerStyle!) ? v.playerStyle! : 'classic',
    motion: typeof v.motion === 'boolean' ? v.motion : true,
    liquidGlass: typeof v.liquidGlass === 'boolean' ? v.liquidGlass : true,
    replicaGlass: typeof v.replicaGlass === 'boolean' ? v.replicaGlass : true,
  };
}
const KEY = 'weav:appearance';
const LEGACY_KEY = 'opentune:appearance';
function read(): Appearance {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    return appearanceOf(JSON.parse(raw ?? '{}'));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}
export const useAppearance = create<Appearance & { update: (change: Partial<Appearance>) => void }>((set, get) => ({
  ...read(),
  update(change) {
    const next = appearanceOf({ ...get(), ...change });
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Still applies for this session. */ }
    set(next);
  },
}));
