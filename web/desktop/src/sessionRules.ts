import type { HeaderEdits } from './rules';

/**
 * The extension's declarativeNetRequest session rules (web/extension/lib/rules.ts), kept in memory
 * and applied by the app's own webRequest handler to the requests the app itself makes. Only the
 * rule shapes those files use are understood: a `||host/path` URL filter, `modifyHeaders` with
 * request headers set or removed, and requests that aren't a tab's (`tabIds: [-1]`).
 */
export interface SessionRule {
  id: number;
  priority?: number;
  condition: { urlFilter?: string; tabIds?: number[] };
  action: { type: string; requestHeaders?: { header: string; operation: string; value?: string }[] };
}

export function matchesFilter(filter: string, rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (!filter.startsWith('||')) return false;
  const rest = filter.slice(2);
  const slash = rest.indexOf('/');
  const host = slash < 0 ? rest : rest.slice(0, slash);
  const prefix = slash < 0 ? '/' : rest.slice(slash);
  return url.protocol === 'https:' && url.hostname === host && `${url.pathname}${url.search}`.startsWith(prefix);
}

export class SessionRules {
  private rules = new Map<number, SessionRule>();

  update({ removeRuleIds = [], addRules = [] }: { removeRuleIds?: number[]; addRules?: SessionRule[] }): void {
    for (const id of removeRuleIds) this.rules.delete(id);
    for (const rule of addRules) this.rules.set(rule.id, rule);
  }

  /** What to do to a request the app itself is sending to [url]; later (higher priority) rules win. */
  editsFor(url: string): HeaderEdits | null {
    const matching = [...this.rules.values()]
      .filter((r) => r.action.type === 'modifyHeaders' && r.condition.urlFilter && matchesFilter(r.condition.urlFilter, url))
      .sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
    if (!matching.length) return null;
    const edits: HeaderEdits = { set: {}, remove: [] };
    for (const rule of matching) {
      for (const { header, operation, value } of rule.action.requestHeaders ?? []) {
        if (operation === 'set' && value !== undefined) edits.set[header] = value;
        else if (operation === 'remove') edits.remove.push(header);
      }
    }
    return edits;
  }
}
