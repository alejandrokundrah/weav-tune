import { useAddons } from '@/addons/client';
import { useDiscord } from '@/extension/useDiscord';
import { useExtension } from '@/extension/useExtension';
import { useSpotifyAuth } from '@/extension/useSpotifyAuth';
import { useYtAuth } from '@/extension/useYtAuth';
import { useRoom } from '@/together/room';
import { ACCENTS, useAppearance } from '@/state/appearance';
import { usePlayer } from '@/state/player';
import type { SectionId } from './sections';

/** ok: working. warn: needs something from you. off: not in use. */
export type Tone = 'ok' | 'warn' | 'off';
export interface SectionStatus {
  text: string;
  tone?: Tone;
}

const list = (names: string[]) => new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(names);

/** What each category's row says about its settings right now. */
export function useSectionStatus(): Record<SectionId, SectionStatus> {
  const extension = useExtension();
  const yt = useYtAuth();
  const spotify = useSpotifyAuth();
  const discord = useDiscord();
  const room = useRoom((s) => s.view);
  const autoplay = usePlayer((s) => s.autoplay);
  const crossfadeSec = usePlayer((s) => s.crossfadeSec);
  const sources = useAddons((s) => s.sources.filter((a) => a.enabled && !a.ownerOff).length);
  const jioSaavn = useAddons((s) => s.jioSaavn);
  const appearance = useAppearance();

  const present = extension.state === 'present';
  const connected = [
    yt.state !== 'checking' && yt.state !== 'unavailable' && yt.auth.browserSignedIn && yt.auth.connected ? 'YouTube Music' : null,
    spotify.state === 'ready' && spotify.auth.signedIn ? 'Spotify' : null,
    discord.state === 'ready' && discord.discord.connected ? 'Discord' : null,
  ].filter((n): n is string => n !== null);

  const audioParts = [sources ? `${sources} add-on${sources === 1 ? '' : 's'}` : null, jioSaavn ? 'JioSaavn' : null].filter((p): p is string => p !== null);
  const inRoom = room && room.phase !== 'ended' ? room : null;
  const mode = { system: 'Follows system', light: 'Light', dark: 'Dark' }[appearance.mode];
  const accent = appearance.artworkColors ? 'colors from artwork' : `${ACCENTS.find(([, color]) => color === appearance.accent)?.[0] ?? 'custom'} accent`;

  return {
    audio: audioParts.length ? { text: list(audioParts), tone: 'ok' } : { text: 'YouTube Music only', tone: 'off' },
    playback: { text: `AutoPlay ${autoplay ? 'on' : 'off'}, ${crossfadeSec ? `${crossfadeSec} s crossfade` : 'no crossfade'}` },
    lyrics: { text: 'Sources, order and timing' },
    appearance: { text: `${mode}, ${accent}` },
    accounts: !present
      ? { text: 'Needs the extension', tone: 'warn' }
      : connected.length
        ? { text: `${list(connected)} connected`, tone: 'ok' }
        : { text: 'Nothing connected yet', tone: 'off' },
    together: inRoom
      ? { text: inRoom.hosting ? 'Hosting a room' : `In ${inRoom.hostName ?? 'a'}’s room`, tone: 'ok' }
      : { text: 'No room open', tone: 'off' },
    about: { text: 'Android, TV and source code' },
  };
}
