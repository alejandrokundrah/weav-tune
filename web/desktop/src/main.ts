import { app, BrowserWindow, ipcMain, net, protocol, screen, session, shell } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import type { BridgeEvent, BridgeRequest } from '@weavtune/shared/bridge';
import * as spotify from '../../extension/lib/spotify';
import { activeIdentityReset, ytService } from './yt';
import { importSessionCookies } from './cookieImport';
import { installBrowserShim, onCookieChanged, sessionRules } from './browserShim';
import { createHost } from './host';
import { openSignIn } from './signIn';
import { allowsPageRead, applyEdits, mainRequestEdits, pageRequestEdits, withCors } from './rules';

/**
 * Weav-Tune for Windows, macOS and Linux: the web player in its own window. The player is served
 * from the app's own files under app://weavtune/, so it works the same on every system and
 * offline for everything but the music itself. Everything the browser extension does for the
 * web player is done here (rules.ts, host.ts).
 */
const SCHEME = 'app';
const HOST = 'weavtune';
const ORIGIN = `${SCHEME}://${HOST}`;

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// Media keys and the system's now-playing controls come from the page's Media Session.
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService');
app.setName('Weav-Tune');

if (!app.requestSingleInstanceLock()) app.quit();

/** The built player: next to the app in a packaged build, in web/app/dist when run from the repo. */
function appRoot(): string {
  const packaged = join(process.resourcesPath ?? '', 'player');
  return app.isPackaged ? packaged : join(__dirname, '..', '..', 'app', 'dist');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.map': 'application/json',
};

function servePlayer(request: Request): Response {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response('Not found', { status: 404 });
  const root = appRoot();
  let relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (relative === '' || relative.endsWith(sep)) relative += 'index.html';
  let file = join(root, relative);
  // Nothing outside the player's own folder is ever served.
  if (!file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
  // Routes are hash-based, but a reload of any path still lands on the player.
  if (!existsSync(file) && !extname(file)) file = join(root, 'index.html');
  if (!existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(readFileSync(file), { headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' } });
}

// ---- Persisted bits: window position and the hosts the user allowed for add-ons -------------------

const dataFile = (name: string) => join(app.getPath('userData'), name);

function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(dataFile(name), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(name: string, value: unknown): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(dataFile(name), JSON.stringify(value));
  } catch {
    // A setting that can't be saved is not worth a crash.
  }
}

interface WindowState { x?: number; y?: number; width: number; height: number; maximized?: boolean }

function restoredBounds(): WindowState {
  const saved = readJson<WindowState>('window.json', { width: 1280, height: 820 });
  if (saved.x === undefined || saved.y === undefined) return saved;
  const visible = screen.getAllDisplays().some(({ workArea: a }) => saved.x! < a.x + a.width && saved.x! + saved.width > a.x && saved.y! < a.y + a.height && saved.y! + saved.height > a.y);
  return visible ? saved : { width: saved.width, height: saved.height };
}

// ---- Cookie import: an already-signed-in browser instead of a sign-in window -----------------------

class ImportError extends Error {
  readonly code = 'unauthenticated';
}

/**
 * Pulls a session for [service] from whichever installed browser has one (cookieImport/), puts it
 * in this app's own cookie jar, and re-reads the account. [invalidate] clears whatever cache the
 * extension's own session code (ytAuth.ts / spotify.ts) keeps, the same way a cookie change would.
 */
async function importBrowserSession<T>(
  service: 'youtube' | 'spotify',
  url: string,
  domain: string,
  readAuthState: (refresh: boolean) => Promise<T>,
  invalidate: (cookie: { name: string; domain: string }) => unknown,
): Promise<T> {
  const result = importSessionCookies(service);
  if (!result.ok || !result.cookies?.length) throw new ImportError(result.reason ?? `No signed-in ${service} session was found`);
  for (const { name, value } of result.cookies) {
    await session.defaultSession.cookies.set({ url, domain, name, value, secure: true, httpOnly: true });
    invalidate({ name, domain });
  }
  return readAuthState(true);
}

// ---- Network: what the extension's header rules did ------------------------------------------------

function installNetworkRules(): void {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (details, done) => {
    const fromPage = details.webContentsId !== undefined && details.webContentsId !== 0;
    let headers = details.requestHeaders as Record<string, string | string[]>;
    if (fromPage) {
      const edits = details.resourceType === 'xhr' || details.resourceType === 'media' ? pageRequestEdits(details.url) : null;
      if (edits) headers = applyEdits(headers, edits);
    } else {
      // The app's own requests: the fixed ones, then the session rules the extension's code sets.
      for (const edits of [mainRequestEdits(details.url), sessionRules.editsFor(details.url)]) if (edits) headers = applyEdits(headers, edits);
    }
    done({ requestHeaders: headers as Record<string, string> });
  });
  ses.webRequest.onHeadersReceived({ urls: ['https://*/*'] }, (details, done) => {
    const fromPage = details.webContentsId !== undefined && details.webContentsId !== 0;
    if (!fromPage || !allowsPageRead(details.url)) return done({});
    done({ responseHeaders: withCors(details.responseHeaders as Record<string, string[]> | undefined) });
  });
}

// ---- Window ---------------------------------------------------------------------------------------

let main: BrowserWindow | null = null;

function openWindow(): void {
  const state = restoredBounds();
  main = new BrowserWindow({
    ...state,
    minWidth: 380,
    minHeight: 560,
    title: 'Weav-Tune',
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    show: false,
    icon: join(__dirname, '..', 'icons', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  if (state.maximized) main.maximize();
  main.once('ready-to-show', () => main?.show());
  main.on('close', () => {
    if (!main || main.isDestroyed()) return;
    writeJson('window.json', { ...main.getNormalBounds(), maximized: main.isMaximized() });
  });
  main.on('closed', () => (main = null));

  // The player only ever shows its own pages; links to anywhere else open in the system browser.
  main.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  main.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === ORIGIN) return;
    event.preventDefault();
    openExternally(url);
  });
  void main.loadURL(`${ORIGIN}/`);
}

function openExternally(url: string): void {
  try {
    const { protocol: scheme } = new URL(url);
    if (scheme === 'https:' || scheme === 'http:' || scheme === 'mailto:') void shell.openExternal(url);
  } catch {
    // Not a URL; nothing to open.
  }
}

app.on('second-instance', () => {
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.focus();
});

void app.whenReady().then(() => {
  protocol.handle(SCHEME, servePlayer);

  // Google and Spotify turn away windows that call themselves Electron; this is a Chromium like Chrome's.
  session.defaultSession.setUserAgent(app.userAgentFallback.replace(/\s(Electron|weav-tune|@weavtune\/desktop)\/\S+/gi, ''));
  installBrowserShim(dataFile('extension-storage.json'));

  const grants = new Set<string>(readJson<string[]>('addon-hosts.json', []));
  const broadcast = (event: BridgeEvent) => {
    for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed() && win.webContents.getURL().startsWith(ORIGIN)) win.webContents.send('weavtune:event', event);
  };
  const host = createHost({
    version: app.getVersion(),
    grants: {
      has: (origin) => grants.has(origin),
      add: (origin) => {
        grants.add(origin);
        writeJson('addon-hosts.json', [...grants]);
      },
    },
    fetch: (url, init) => net.fetch(url, { ...init, credentials: 'omit', bypassCustomProtocolHandlers: true } as RequestInit),
    yt: {
      ...ytService,
      importFromBrowser: () => importBrowserSession('youtube', 'https://music.youtube.com/', '.youtube.com', ytService.authState, activeIdentityReset),
    },
    spotify: {
      authState: async (refresh) => {
        if (refresh) spotify.invalidateSession();
        return spotify.authState();
      },
      setConnected: spotify.setConnected,
      playlists: spotify.playlists,
      tracks: spotify.tracks,
      playlistInfo: spotify.playlistInfo,
      searchTracks: spotify.searchTracks,
      canvas: spotify.canvas,
      importFromBrowser: () =>
        importBrowserSession('spotify', 'https://open.spotify.com/', '.spotify.com', spotify.authState, (cookie) => (spotify.isSessionCookie(cookie as never) ? (spotify.invalidateSession(), true) : false)),
    },
    signIn: (service) => openSignIn(service, main),
    broadcast,
  });

  // A sign-in or sign-out: re-read the accounts and tell the open player (background.ts does the same in a browser).
  let ytTimer: ReturnType<typeof setTimeout> | undefined;
  let spotifyTimer: ReturnType<typeof setTimeout> | undefined;
  onCookieChanged(({ cookie }) => {
    if (spotify.isSessionCookie(cookie as never)) {
      spotify.invalidateSession();
      clearTimeout(spotifyTimer);
      spotifyTimer = setTimeout(() => void spotify.authState().then((data) => broadcast({ event: 'spotify.authState', data })).catch(() => undefined), 1000);
      return;
    }
    if (!activeIdentityReset(cookie)) return;
    clearTimeout(ytTimer);
    // Signing in sets several cookies in a burst; answer the last one.
    ytTimer = setTimeout(() => void ytService.authState(true).then((data) => broadcast({ event: 'yt.authState', data })).catch(() => undefined), 1000);
  });

  ipcMain.handle('weavtune:bridge', (event, request: unknown) => {
    // Only the player's own page may use the bridge.
    if (event.senderFrame?.origin !== ORIGIN) throw new Error('forbidden');
    return host(request as BridgeRequest);
  });
  ipcMain.on('weavtune:version', (event) => {
    event.returnValue = app.getVersion();
  });

  installNetworkRules();
  openWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

