import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let home: string;

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => home, platform: () => 'linux' as const };
});

const { findCookieSources } = await import('./locate');

describe('finding browser profiles', () => {
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'home-'));
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('finds a Chrome profile’s Cookies file and a Firefox profile’s cookies.sqlite', () => {
    const chromeDefault = join(home, '.config', 'google-chrome', 'Default');
    mkdirSync(chromeDefault, { recursive: true });
    writeFileSync(join(chromeDefault, 'Cookies'), '');
    const ffProfile = join(home, '.mozilla', 'firefox', 'abc123.default-release');
    mkdirSync(ffProfile, { recursive: true });
    writeFileSync(join(ffProfile, 'cookies.sqlite'), '');

    const sources = findCookieSources();
    expect(sources.map((s) => s.kind).sort()).toEqual(['chromium', 'firefox']);
    expect(sources.find((s) => s.kind === 'chromium')?.label).toBe('Chrome');
    expect(sources.find((s) => s.kind === 'firefox')?.label).toBe('Firefox');
  });

  it('finds nothing on a computer with no browser profile', () => {
    expect(findCookieSources()).toEqual([]);
  });
});
