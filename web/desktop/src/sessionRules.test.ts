import { describe, expect, it } from 'vitest';
import { matchesFilter, SessionRules } from './sessionRules';

const rule = (id: number, urlFilter: string, headers: { header: string; operation: string; value?: string }[], priority = 1) => ({
  id,
  priority,
  condition: { urlFilter, tabIds: [-1] },
  action: { type: 'modifyHeaders', requestHeaders: headers },
});

describe('session rules', () => {
  it('matches a host, or a host and the start of a path', () => {
    expect(matchesFilter('||music.youtube.com/', 'https://music.youtube.com/youtubei/v1/browse')).toBe(true);
    expect(matchesFilter('||open.spotify.com/api/token', 'https://open.spotify.com/api/token?reason=init')).toBe(true);
    expect(matchesFilter('||open.spotify.com/api/token', 'https://open.spotify.com/search')).toBe(false);
    expect(matchesFilter('||music.youtube.com/', 'https://evil.example/?u=music.youtube.com/')).toBe(false);
    expect(matchesFilter('||music.youtube.com/', 'http://music.youtube.com/')).toBe(false);
  });

  it('applies matching rules in priority order, and forgets removed ones', () => {
    const rules = new SessionRules();
    rules.update({
      addRules: [
        rule(1, '||open.spotify.com/', [{ header: 'Origin', operation: 'set', value: 'https://open.spotify.com' }]),
        rule(2, '||open.spotify.com/api/token', [{ header: 'Cookie', operation: 'set', value: 'sp_dc=abc' }], 2),
      ],
    });
    expect(rules.editsFor('https://open.spotify.com/api/token?x=1')?.set).toEqual({ Origin: 'https://open.spotify.com', Cookie: 'sp_dc=abc' });
    rules.update({ removeRuleIds: [2] });
    expect(rules.editsFor('https://open.spotify.com/api/token')?.set).toEqual({ Origin: 'https://open.spotify.com' });
    expect(rules.editsFor('https://example.com/')).toBeNull();
  });
});
