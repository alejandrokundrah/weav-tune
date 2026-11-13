import { app, BrowserWindow, ipcMain, net, protocol, screen, session, shell } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import type { BridgeRequest } from '@weavtune/shared/bridge';
import { createHost } from './host';
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

// ---- Network: what the extension's header rules did ------------------------------------------------

function installNetworkRules(): void {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*/*'] }, (details, done) => {
    const fromPage = details.webContentsId !== undefined && details.webContentsId !== 0;
    const edits = fromPage ? (details.resourceType === 'xhr' || details.resourceType === 'media' ? pageRequestEdits(details.url) : null) : mainRequestEdits(details.url);
    done({ requestHeaders: edits ? (applyEdits(details.requestHeaders, edits) as Record<string, string>) : details.requestHeaders });
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

  const grants = new Set<string>(readJson<string[]>('addon-hosts.json', []));
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

