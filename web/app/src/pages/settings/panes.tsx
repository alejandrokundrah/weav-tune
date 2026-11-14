import { ArrowUpRight, AudioLines, ChevronRight, Smartphone, Tv, Users, Wrench } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { MdOutlineExtension } from 'react-icons/md';
import { SiApplemusic, SiDiscord, SiGithub, SiSpotify, SiYoutubemusic } from 'react-icons/si';
import { PrefetchLink } from '@/components/PrefetchLink';
import { config } from '@/config';
import { useRemoteConfig } from '@/config/remote';
import { useAddons } from '@/addons/client';
import { useDiscord } from '@/extension/useDiscord';
import { useExtension } from '@/extension/useExtension';
import { useImportYtFromBrowser, useYtAuth } from '@/extension/useYtAuth';
import { useRoom } from '@/together/room';
import { useHistorySettings } from '@/playback/historyReporting';
import { CROSSFADE_CHOICES, usePlayer } from '@/state/player';
import { AppleMusicIntegration, AppleMusicToggles, CanvasToggle, LyricSourcesAccess, SpotifyIntegration, Toggle } from '../IntegrationSettings';
import { settingsUi } from '../settingsStyles';
import { isDesktop } from '@/lib/desktop';

/** An integration's coloured glyph, as on the Extension page. */
function Glyph({ Icon, color, ink }: { Icon: ComponentType<{ size?: number }>; color: string; ink?: string }) {
  return (
    <span className={settingsUi.integrationIcon} style={{ backgroundColor: color, ...(ink && { color: ink }) }}>
      <Icon size={15} />
    </span>
  );
}

/** A row that opens a page of its own. */
function LinkRow({ to, icon, title, value }: { to: string; icon?: ReactNode; title: string; value?: string | null }) {
  return (
    <PrefetchLink to={to} className={`${icon ? settingsUi.integration : settingsUi.integrationPlain} ${settingsUi.linkRow}`}>
      {icon}
      <span className={settingsUi.integrationName}>{title}</span>
      <span className={settingsUi.value}>
        {value && <span>{value}</span>}
        <ChevronRight size={16} className="flex-none text-tertiary" />
      </span>
    </PrefetchLink>
  );
}

/** A row that leaves for another site. */
function ExternalRow({ href, icon, title, value }: { href: string; icon: ReactNode; title: string; value?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${settingsUi.integration} ${settingsUi.linkRow}`}>
      {icon}
      <span className={settingsUi.integrationName}>{title}</span>
      <span className={settingsUi.value}>
        {value && <span>{value}</span>}
        <ArrowUpRight size={16} className="flex-none text-tertiary" />
      </span>
    </a>
  );
}

export function youtubeText(auth: ReturnType<typeof useYtAuth>): string {
  if (auth.state === 'checking') return 'Checking…';
  if (auth.state === 'unavailable') return 'Needs the extension';
  const { browserSignedIn, connected, active } = auth.auth;
  if (!browserSignedIn) return 'Not signed in';
  if (!connected) return 'Disconnected';
  return active ? active.name : 'Signed in';
}

export function AudioPane() {
  const sources = useAddons((st) => st.sources.filter((a) => a.enabled && !a.ownerOff).length);
  const jioSaavn = useAddons((st) => st.jioSaavn);
  const text = [sources ? `${sources} add-on${sources === 1 ? '' : 's'}` : 'No add-ons', jioSaavn ? 'JioSaavn' : null].filter(Boolean).join(', ');
  return (
    <>
      <section className={settingsUi.group}>
        <LinkRow to="/settings/addons" icon={<Glyph Icon={AudioLines} color="#25a0d4" />} title="Audio sources" value={text} />
      </section>
      <p className={settingsUi.footer}>Lossless FLAC from add-ons and 320 kbps from JioSaavn, in the order you choose. YouTube Music is the fallback.</p>
    </>
  );
}

export function PlaybackPane() {
  const autoplay = usePlayer((s) => s.autoplay);
  const crossfadeSec = usePlayer((s) => s.crossfadeSec);
  const { setAutoplay, setCrossfade } = usePlayer.getState();
  return (
    <section className={settingsUi.group}>
      <Toggle label="AutoPlay" detail="When the queue ends, keep playing similar music." checked={autoplay} onChange={setAutoplay} />
      <label className={settingsUi.controlRow}>
        <span className={settingsUi.rowText}>
          <span>Crossfade</span>
          <span className={settingsUi.rowDetail}>Blend the end of one song into the next.</span>
        </span>
        <select className={settingsUi.select} value={crossfadeSec} onChange={(e) => setCrossfade(Number(e.currentTarget.value))}>
          {CROSSFADE_CHOICES.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds === 0 ? 'Off' : `${seconds} seconds`}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

export function LyricsPane({ onOpenSources }: { onOpenSources: () => void }) {
  const present = useExtension().state === 'present';
  return (
    <section className={settingsUi.group}>
      <button className={`${settingsUi.integrationPlain} ${settingsUi.linkRow}`} onClick={onOpenSources}>
        <span className={settingsUi.rowText}>
          <span>Lyric sources</span>
          <span className={settingsUi.rowDetail}>Order, sources, syllable timing</span>
        </span>
        <ChevronRight size={16} className="text-tertiary" />
      </button>
      <div className={settingsUi.integrationPlain}>
        <span className={settingsUi.rowText}>
          <span>Access to lyric sites</span>
          <span className={settingsUi.rowDetail}>KuGou, Musixmatch, Genius and others answer only the extension.</span>
        </span>
        {present ? <LyricSourcesAccess /> : <span className={settingsUi.value}>Needs the extension</span>}
      </div>
    </section>
  );
}

export function AccountsPane() {
  const extension = useExtension();
  const yt = useYtAuth();
  const importYt = useImportYtFromBrowser();
  const discord = useDiscord();
  const shareHistory = useHistorySettings((s) => s.share);
  const setShareHistory = useHistorySettings((s) => s.setShare);
  const present = extension.state === 'present';
  const desktop = isDesktop();
  const discordText = !present
    ? 'Needs the extension'
    : discord.state === 'ready' && discord.discord.connected
      ? discord.discord.enabled
        ? 'On'
        : 'Off'
      : discord.state === 'ready' && discord.discord.available
        ? 'Not connected'
        : 'Update the extension';
  return (
    <>
      <section className={settingsUi.group}>
        <div className={settingsUi.integration}>
          <Glyph Icon={SiYoutubemusic} color="#ffffff" ink="#ff0033" />
          <span className={settingsUi.integrationName}>YouTube Music</span>
          <span className={settingsUi.value}>
            <span title={importYt.isError ? importYt.error.message : undefined}>{importYt.isError ? 'Couldn’t find a signed-in session' : youtubeText(yt)}</span>
            {desktop && yt.state === 'ready' && !yt.auth.browserSignedIn && (
              <button className={settingsUi.inlineButton} onClick={() => importYt.mutate()} disabled={importYt.isPending}>
                {importYt.isPending ? 'Importing…' : 'Import from browser'}
              </button>
            )}
          </span>
        </div>
        <div className={settingsUi.integration}>
          <Glyph Icon={SiSpotify} color="#1ed760" ink="#000000" />
          <span className={settingsUi.integrationName}>Spotify</span>
          {present ? <SpotifyIntegration /> : <span className={settingsUi.value}>Needs the extension</span>}
        </div>
        {!desktop && <LinkRow to="/settings/discord" icon={<Glyph Icon={SiDiscord} color="#5865f2" />} title="Discord" value={discordText} />}
        {!desktop && <LinkRow
          to="/extension"
          icon={<Glyph Icon={MdOutlineExtension} color="#636366" />}
          title="Weav-Tune Extension"
          value={present ? `v${extension.extension.info.version}` : 'Not installed'}
        />}
      </section>
      {!desktop && <section className={`${settingsUi.group} mt-3 empty:hidden`}>
        <Toggle
          label="Share listening activity to YouTube"
          detail={
            present && !extension.extension.info.capabilities.includes('yt.stats')
              ? 'Update the Weav-Tune extension to share: this version can’t send plays to YouTube.'
              : 'Songs you play here go to your YouTube Music history and shape its recommendations.'
          }
          checked={shareHistory}
          onChange={setShareHistory}
        />
        <CanvasToggle />
      </section>}
      <h3 className={settingsUi.sectionHeader}>Apple Music</h3>
      <section className={settingsUi.group}>
        <div className={settingsUi.integration}>
          <Glyph Icon={SiApplemusic} color="#fa2d48" />
          <span className={settingsUi.integrationName}>Access to Apple Music</span>
          {present ? <AppleMusicIntegration /> : <span className={settingsUi.value}>Needs the extension</span>}
        </div>
        <AppleMusicToggles />
      </section>
      <p className={settingsUi.footer}>Animated covers and artist art from Apple Music’s public pages. No Apple Music account needed.</p>
    </>
  );
}

export function TogetherPane() {
  const room = useRoom((s) => s.view);
  return (
    <section className={settingsUi.group}>
      <LinkRow
        to="/settings/listen-together"
        icon={<Glyph Icon={Users} color="#f08a24" />}
        title="Rooms"
        value={room && room.phase !== 'ended' ? (room.hosting ? 'Hosting a room' : `In ${room.hostName ?? 'a'}’s room`) : 'With the web player and the Android app'}
      />
    </section>
  );
}

export function AboutPane() {
  const links = useRemoteConfig((s) => s.config.data.links);
  return (
    <>
      <section className={settingsUi.group}>
        <ExternalRow href={config.androidAppUrl} icon={<Glyph Icon={Smartphone} color="#2fa84f" />} title="Weav-Tune for Android" value="Download" />
        <ExternalRow href={links.tv} icon={<Glyph Icon={Tv} color="#3478f6" />} title="Weav-Tune on TV" />
        <ExternalRow href="#/settings/addons" icon={<Glyph Icon={Wrench} color="#49c4e2" />} title="Build an add-on" />
        <ExternalRow href={links.github} icon={<Glyph Icon={SiGithub} color="#24292f" />} title="Source code" value="GitHub" />
        <ExternalRow href={links.discord} icon={<Glyph Icon={SiDiscord} color="#5865f2" />} title="Community" value="Discord" />
      </section>
      <p className={settingsUi.footer}>Weav-Tune is free and open source. Report bugs, suggest features and share the add-ons you build.</p>
    </>
  );
}
