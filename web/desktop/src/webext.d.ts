/**
 * The part of the WebExtension API the extension's session code (web/extension/lib/ytAuth.ts,
 * ytFetch.ts, spotify.ts, rules.ts) uses, which the app answers itself (browserShim.ts). The
 * extension's own build has the full types; this keeps only what the shared files touch.
 */
declare namespace Browser {
  namespace cookies {
    interface Cookie {
      name: string;
      value: string;
      domain: string;
    }
  }
  namespace declarativeNetRequest {
    type ResourceType = string;
    interface ModifyHeaderInfo {
      header: string;
      operation: 'set' | 'remove' | 'append';
      value?: string;
    }
    interface Rule {
      id: number;
      priority?: number;
      condition: Record<string, unknown>;
      action: Record<string, unknown>;
    }
  }
}

declare const browser: {
  storage: { local: { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> } };
  cookies: { get(details: { url: string; name: string }): Promise<Browser.cookies.Cookie | null> };
  declarativeNetRequest: {
    updateSessionRules(options: { removeRuleIds?: number[]; addRules?: Browser.declarativeNetRequest.Rule[] }): Promise<void>;
    updateDynamicRules(options: { removeRuleIds?: number[]; addRules?: Browser.declarativeNetRequest.Rule[] }): Promise<void>;
  };
};
