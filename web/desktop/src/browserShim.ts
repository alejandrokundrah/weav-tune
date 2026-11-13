import { net, session } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SessionRules, type SessionRule } from './sessionRules';

/**
 * Answers the WebExtension calls the extension's session code makes, so that code runs here
 * unchanged: `storage.local` is a file, `cookies` is the app's cookie jar, and
 * `declarativeNetRequest` session rules are applied by main.ts to the app's own requests. The
 * app's `fetch` is Chromium's network stack, which is what carries the jar's cookies and the rules.
 */
export const sessionRules = new SessionRules();

export interface CookieChange {
  cookie: { name: string; value: string; domain: string };
  removed: boolean;
}

const cookieListeners = new Set<(change: CookieChange) => void>();
export const onCookieChanged = (listener: (change: CookieChange) => void): void => void cookieListeners.add(listener);

export function installBrowserShim(storageFile: string): void {
  let stored: Record<string, unknown> = {};
  try {
    stored = JSON.parse(readFileSync(storageFile, 'utf8')) as Record<string, unknown>;
  } catch {
    // First run, or a file that can't be read: start empty.
  }
  const save = () => {
    try {
      mkdirSync(dirname(storageFile), { recursive: true });
      writeFileSync(storageFile, JSON.stringify(stored));
    } catch {
      // A preference that can't be saved is not worth a crash.
    }
  };

  const jar = session.defaultSession.cookies;
  jar.on('changed', (_event, cookie, _cause, removed) => {
    for (const listener of cookieListeners) listener({ cookie: { name: cookie.name, value: cookie.value, domain: cookie.domain ?? '' }, removed });
  });

  Object.assign(globalThis, {
    browser: {
      storage: {
        local: {
          get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
          set: async (items: Record<string, unknown>) => {
            Object.assign(stored, items);
            save();
          },
        },
      },
      cookies: {
        get: async ({ url, name }: { url: string; name: string }) => {
          const [cookie] = await jar.get({ url, name });
          return cookie ? { name: cookie.name, value: cookie.value, domain: cookie.domain ?? '' } : null;
        },
      },
      declarativeNetRequest: {
        updateSessionRules: async (options: { removeRuleIds?: number[]; addRules?: SessionRule[] }) => sessionRules.update(options),
        updateDynamicRules: async () => undefined,
      },
    },
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      net.fetch(input instanceof Request ? input.url : String(input), { ...init, bypassCustomProtocolHandlers: true } as RequestInit),
  });
}
