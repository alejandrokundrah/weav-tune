import { BrowserWindow, session, shell } from 'electron';

/**
 * Sign-in happens in a window of the app's own, into the same cookie jar the session code reads
 * (browserShim.ts). The app never sees a password: Google and Spotify show their own pages, and
 * the app only watches for the session cookie to appear.
 */
export type Service = 'youtube' | 'spotify';

const SERVICES: Record<Service, { url: string; landing: string; cookie: string; cookieUrl: string }> = {
  youtube: {
    url: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F',
    landing: 'music.youtube.com',
    cookie: 'SAPISID',
    cookieUrl: 'https://music.youtube.com/',
  },
  spotify: {
    url: 'https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F',
    landing: 'open.spotify.com',
    cookie: 'sp_dc',
    cookieUrl: 'https://open.spotify.com/',
  },
};

const open = new Map<Service, BrowserWindow>();

export function openSignIn(service: Service, parent: BrowserWindow | null): void {
  const existing = open.get(service);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const { url, landing, cookie, cookieUrl } = SERVICES[service];
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    parent: parent ?? undefined,
    modal: !!parent,
    title: service === 'youtube' ? 'Sign in to YouTube Music' : 'Sign in to Spotify',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: { session: session.defaultSession, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  open.set(service, win);
  win.on('closed', () => open.delete(service));

  // A pop-up from the sign-in page (a passkey prompt, a help link) opens in this window.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https:/.test(target)) void win.loadURL(target);
    else void shell.openExternal(target).catch(() => undefined);
    return { action: 'deny' };
  });

  // Done once the service's own page has loaded and the session cookie is in the jar.
  const check = async () => {
    if (win.isDestroyed() || new URL(win.webContents.getURL()).hostname !== landing) return;
    const found = await session.defaultSession.cookies.get({ url: cookieUrl, name: cookie }).catch(() => []);
    if (found.length && !win.isDestroyed()) win.close();
  };
  win.webContents.on('did-navigate', () => void check());
  win.webContents.on('did-finish-load', () => void check());
  void win.loadURL(url);
}
