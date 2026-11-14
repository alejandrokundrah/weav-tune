import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * Where each browser keeps its cookies, so a signed-in session can be imported instead of signing
 * in again in a window Google or Spotify may refuse (they detect an embedded browser). Chromium
 * cookies are encrypted (chromiumDecrypt.ts); Firefox's are not (firefox.ts).
 */

export interface CookieSource {
  /** Shown to the person: "Chrome", "Firefox profile 'work'", and so on. */
  label: string;
  kind: 'chromium' | 'firefox';
  /** The real `Cookies` or `cookies.sqlite` file; never written to. */
  dbPath: string;
  /** The browser's profile root (chromium only): where `Local State` lives, for Windows' DPAPI-wrapped key. */
  root?: string;
  mtimeMs: number;
}

const home = () => homedir();

function tryStat(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

/** Chrome keeps `Cookies` at the profile root on older builds, under `Network/` on newer ones. */
function chromiumCookieFile(profileDir: string): string | null {
  for (const rel of ['Network/Cookies', 'Cookies']) {
    const path = join(profileDir, rel);
    if (existsSync(path)) return path;
  }
  return null;
}

function chromiumProfiles(root: string): string[] {
  let names: string[];
  try {
    names = readdirSync(root);
  } catch {
    return [];
  }
  return names.filter((name) => name === 'Default' || /^Profile \d+$/.test(name)).map((name) => join(root, name));
}

/** Where each Chromium-family browser keeps its profiles, per OS. */
function chromiumRoots(): { label: string; root: string }[] {
  const h = home();
  if (platform() === 'win32') {
    const base = process.env.LOCALAPPDATA ?? join(h, 'AppData', 'Local');
    return [
      { label: 'Chrome', root: join(base, 'Google', 'Chrome', 'User Data') },
      { label: 'Edge', root: join(base, 'Microsoft', 'Edge', 'User Data') },
      { label: 'Brave', root: join(base, 'BraveSoftware', 'Brave-Browser', 'User Data') },
    ];
  }
  if (platform() === 'darwin') {
    const base = join(h, 'Library', 'Application Support');
    return [
      { label: 'Chrome', root: join(base, 'Google', 'Chrome') },
      { label: 'Edge', root: join(base, 'Microsoft Edge') },
      { label: 'Brave', root: join(base, 'BraveSoftware', 'Brave-Browser') },
    ];
  }
  const base = join(h, '.config');
  return [
    { label: 'Chrome', root: join(base, 'google-chrome') },
    { label: 'Chromium', root: join(base, 'chromium') },
    { label: 'Edge', root: join(base, 'microsoft-edge') },
    { label: 'Brave', root: join(base, 'BraveSoftware', 'Brave-Browser') },
  ];
}

function firefoxRoot(): string {
  const h = home();
  if (platform() === 'win32') return join(process.env.APPDATA ?? join(h, 'AppData', 'Roaming'), 'Mozilla', 'Firefox', 'Profiles');
  if (platform() === 'darwin') return join(h, 'Library', 'Application Support', 'Firefox', 'Profiles');
  return join(h, '.mozilla', 'firefox');
}

/** Every signed-in browser profile found on this computer, most recently used first. */
export function findCookieSources(): CookieSource[] {
  const sources: CookieSource[] = [];
  for (const { label, root } of chromiumRoots()) {
    for (const profileDir of chromiumProfiles(root)) {
      const dbPath = chromiumCookieFile(profileDir);
      const mtimeMs = dbPath && tryStat(dbPath);
      if (dbPath && mtimeMs) sources.push({ label: profileDir.endsWith('Default') ? label : `${label} (${profileDir.split(/[/\\]/).pop()})`, kind: 'chromium', dbPath, root, mtimeMs });
    }
  }
  try {
    for (const name of readdirSync(firefoxRoot())) {
      const dbPath = join(firefoxRoot(), name, 'cookies.sqlite');
      const mtimeMs = tryStat(dbPath);
      if (mtimeMs) sources.push({ label: /\.default/.test(name) ? 'Firefox' : `Firefox (${name.replace(/^[a-z0-9]+\./, '')})`, kind: 'firefox', dbPath, mtimeMs });
    }
  } catch {
    // No Firefox profiles folder: nothing to add.
  }
  return sources.sort((a, b) => b.mtimeMs - a.mtimeMs);
}
