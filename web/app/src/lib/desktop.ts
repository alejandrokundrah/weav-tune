/**
 * The desktop app (web/desktop) is this same player in its own window; it tells the page so with
 * `window.weavtuneDesktop` (its preload script). Everywhere else this is undefined.
 */
declare global {
  interface Window {
    weavtuneDesktop?: { platform: string; version: string };
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.weavtuneDesktop;

/** The public player, where an invite link has to point: the app's own address means nothing to anyone else. */
const PUBLIC_PLAYER = 'https://alejandrokundrah.github.io/weav-tune/player/';

/** Where links to this player start, without the hash. */
export function shareBase(): string {
  if (typeof window === 'undefined') return '';
  return isDesktop() ? PUBLIC_PLAYER : `${window.location.origin}${window.location.pathname}`;
}
