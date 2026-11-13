import { Check } from 'lucide-react';
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { liquidGlassSupported } from '@/lib/liquidGlass';
import { ACCENTS, PLAYER_STYLES, useAppearance, type Appearance } from '@/state/appearance';
import { Toggle } from '../IntegrationSettings';
import { settingsUi } from '../settingsStyles';

const label = (value: string) => value.replace(/-/g, ' ').replace(/^./, (s) => s.toUpperCase());

const dark = typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)');
const useSystemDark = () =>
  useSyncExternalStore(
    (notify) => {
      dark?.addEventListener('change', notify);
      return () => dark?.removeEventListener('change', notify);
    },
    () => dark?.matches ?? false,
    () => false,
  );

type Scheme = 'light' | 'dark';

/** The palette each scheme is drawn in. These depict the app's surfaces, so they are fixed values. */
function scene(scheme: Scheme, pureBlack: boolean) {
  return scheme === 'light'
    ? { bg: '#f5f5f7', panel: '#ffffff', ink: '#1d1d1f', soft: '#d9d9de' }
    : { bg: pureBlack ? '#000000' : '#1f1f21', panel: pureBlack ? '#121214' : '#2b2b2e', ink: '#f5f5f7', soft: '#3b3b3f' };
}

/** What artwork-driven color looks like: three unrelated hues, as different songs would give. */
const ARTWORK_HUES = ['#e8604c', '#e9b44c', '#4a9fd8'];

function covers(a: Appearance): string[] {
  return a.artworkColors ? ARTWORK_HUES : [a.accent, `color-mix(in srgb, ${a.accent} 62%, #ffffff)`, `color-mix(in srgb, ${a.accent} 70%, #000000)`];
}

/** The whole app in miniature: it redraws as the settings below change. */
function Preview({ a }: { a: Appearance }) {
  const systemDark = useSystemDark();
  const scheme: Scheme = a.mode === 'system' ? (systemDark ? 'dark' : 'light') : a.mode;
  const s = scene(scheme, a.pureBlack);
  const glass = (a.liquidGlass && liquidGlassSupported()) || a.replicaGlass;
  const [c1, c2, c3] = covers(a) as [string, string, string];
  const style = { '--s-bg': s.bg, '--s-panel': s.panel, '--s-ink': s.ink, '--s-soft': s.soft, '--s-accent': a.accent, '--c1': c1, '--c2': c2, '--c3': c3 } as CSSProperties;
  return (
    <figure className="ot-ap-preview" style={style} data-glass={glass || undefined} data-motion={a.motion || undefined} aria-label={`Preview: ${scheme} theme`}>
      <div className="ot-ap-scene" aria-hidden="true">
        <i className="ot-ap-orb ot-ap-orb-1" />
        <i className="ot-ap-orb ot-ap-orb-2" />
        <div className="ot-ap-side">
          <b />
          <b data-on />
          <b />
          <b />
        </div>
        <div className="ot-ap-main">
          <span className="ot-ap-title" />
          <div className="ot-ap-cards">
            <i style={{ background: `linear-gradient(150deg, ${c1}, ${c3})` }} />
            <i style={{ background: `linear-gradient(150deg, ${c2}, ${c1})` }} />
            <i style={{ background: `linear-gradient(150deg, ${c3}, ${c2})` }} />
            <i style={{ background: `linear-gradient(150deg, ${c1}, ${c2})` }} />
          </div>
        </div>
        <div className="ot-ap-pill">
          <i style={{ background: `linear-gradient(150deg, ${c2}, ${c1})` }} />
          <span>
            <b />
            <b />
          </span>
          <em />
        </div>
      </div>
      <figcaption className={settingsUi.rowDetail}>Preview. It changes as you change the settings below.</figcaption>
    </figure>
  );
}

/** One miniature of the app in a given scheme, for the theme tiles. */
function MiniScheme({ scheme, accent, pureBlack }: { scheme: Scheme; accent: string; pureBlack: boolean }) {
  const s = scene(scheme, pureBlack);
  return (
    <span className="ot-sw" style={{ background: s.bg, '--s-panel': s.panel, '--s-ink': s.ink, '--s-soft': s.soft, '--s-accent': accent } as CSSProperties}>
      <b />
      <i />
      <i />
      <em />
    </span>
  );
}

function Tile({ checked, name, onSelect, children }: { checked: boolean; name: string; onSelect: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="ot-tile" onClick={onSelect}>
      <span className="ot-tile-art">
        {children}
        {checked && (
          <span className="ot-tile-check">
            <Check size={12} strokeWidth={3.2} />
          </span>
        )}
      </span>
      <span className="ot-tile-name">{name}</span>
    </button>
  );
}

const BACKGROUNDS: [Appearance['playerBackground'], string][] = [
  ['mesh', 'Mesh'],
  ['gradient', 'Gradient'],
  ['echo', 'Echo glow'],
];

export function AppearancePane() {
  const a = useAppearance();
  const [c1, c2, c3] = covers(a) as [string, string, string];
  const modes: [Appearance['mode'], string][] = [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ];
  return (
    <>
      <Preview a={a} />

      <section className={`${settingsUi.group} mt-4`} aria-label="Theme">
        <div className="ot-set-block">
          <span className="ot-set-block-title">Theme</span>
          <div className="ot-tiles" role="radiogroup" aria-label="Theme">
            {modes.map(([value, name]) => (
              <Tile key={value} checked={a.mode === value} name={name} onSelect={() => a.update({ mode: value })}>
                {value === 'system' ? (
                  <span className="ot-mini-split">
                    <MiniScheme scheme="dark" accent={a.accent} pureBlack={a.pureBlack} />
                    <MiniScheme scheme="light" accent={a.accent} pureBlack={a.pureBlack} />
                  </span>
                ) : (
                  <MiniScheme scheme={value} accent={a.accent} pureBlack={a.pureBlack} />
                )}
              </Tile>
            ))}
          </div>
        </div>
        <Toggle label="Pure black" detail="True black surfaces in dark mode." checked={a.pureBlack} onChange={(pureBlack) => a.update({ pureBlack })} />
      </section>

      <section className={`${settingsUi.group} mt-3`} aria-label="Glass">
        <Toggle
          label="Liquid Glass"
          detail={liquidGlassSupported() ? 'The player and floating buttons bend what’s behind them, like a lens.' : 'Needs Chrome or Edge. This browser keeps frosted glass.'}
          checked={a.liquidGlass && liquidGlassSupported()}
          onChange={(liquidGlass) => a.update({ liquidGlass })}
        />
        <Toggle
          label="Replica Liquid Glass shell"
          detail="Applies the extracted Group 45 glass to the sidebar, panels and page chrome. The original Apple Music player pill is unchanged."
          checked={a.replicaGlass}
          onChange={(replicaGlass) => a.update({ replicaGlass })}
        />
      </section>

      <section className={`${settingsUi.group} mt-3`} aria-label="Color">
        <Toggle label="Colors from artwork" detail="Let the playing song color Weav-Tune." checked={a.artworkColors} onChange={(artworkColors) => a.update({ artworkColors })} />
        <fieldset className="ot-accent-picker hairline-[16px]">
          <legend>
            Accent color
            {a.artworkColors && <span>Picking one turns off colors from artwork.</span>}
          </legend>
          <div>
            {ACCENTS.map(([name, color]) => (
              <button key={color} aria-label={name} title={name} aria-pressed={!a.artworkColors && a.accent === color} onClick={() => a.update({ accent: color, artworkColors: false })} style={{ background: color }}>
                {!a.artworkColors && a.accent === color && <Check size={16} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <h3 className={settingsUi.sectionHeader}>Now Playing</h3>
      <section className={settingsUi.group} aria-label="Now Playing">
        <div className="ot-set-block">
          <span className="ot-set-block-title">Background</span>
          <div className="ot-tiles" role="radiogroup" aria-label="Background" style={{ '--c1': c1, '--c2': c2, '--c3': c3 } as CSSProperties}>
            {BACKGROUNDS.map(([value, name]) => (
              <Tile key={value} checked={a.playerBackground === value} name={name} onSelect={() => a.update({ playerBackground: value })}>
                <span className="ot-bg-mini" data-kind={value}>
                  <i />
                </span>
              </Tile>
            ))}
          </div>
        </div>
        <label className={settingsUi.controlRow}>
          Player style
          <select className={settingsUi.select} value={a.playerStyle} onChange={(e) => a.update({ playerStyle: e.target.value as typeof a.playerStyle })}>
            {PLAYER_STYLES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </select>
        </label>
        <Toggle label="Animations" detail="Moving artwork, the player's waves and page motion. Your system's reduced-motion setting also applies." checked={a.motion} onChange={(motion) => a.update({ motion })} />
      </section>
      <p className={settingsUi.footer}>Saved in this browser. Wallpaper colors are in the Android app.</p>
    </>
  );
}
