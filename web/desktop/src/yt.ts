import { authState, invalidateAccounts, isSessionCookie, selectChannel, setConnected } from '../../extension/lib/ytAuth';
import { ytFetch } from '../../extension/lib/ytFetch';
import type { YtService } from './host';

/** YouTube Music's session, which is the extension's code (ytAuth.ts, ytFetch.ts) run against the app's cookie jar. */
export const ytService: YtService = {
  fetch: ytFetch,
  authState,
  selectChannel,
  setConnected,
  // main.ts replaces this with the real cookie-import flow, which needs Electron's session.
  importFromBrowser: () => authState(true),
};

/** Whether [cookie] is a YouTube sign-in or sign-out; if so, the cached accounts are dropped. */
export function activeIdentityReset(cookie: { name: string; domain: string }): boolean {
  if (!isSessionCookie(cookie)) return false;
  invalidateAccounts();
  return true;
}
