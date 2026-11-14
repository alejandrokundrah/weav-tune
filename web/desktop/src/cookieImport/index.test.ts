import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readChromiumCookies, resetChromiumKeyCache } from './chromiumDecrypt';
import { readFirefoxCookies } from './firefox';
import type { CookieSource } from './locate';

/** Chrome's own algorithm (chromiumDecrypt.ts decrypts the inverse of this), for a real fixture. */
function encryptLikeChrome(plaintext: string, password: string): Buffer {
  const { pbkdf2Sync, createCipheriv } = require('node:crypto') as typeof import('node:crypto');
  const key = pbkdf2Sync(password, 'saltysalt', 1, 16, 'sha1');
  const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
  return Buffer.concat([Buffer.from('v10'), cipher.update(plaintext, 'utf8'), cipher.final()]);
}

describe('reading a browser’s cookie store', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cookie-fixture-'));
    resetChromiumKeyCache();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('decrypts a Chromium cookie with the "peanuts" fallback (no keyring running)', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.spyOn({ execFileSync }, 'execFileSync'); // not stubbed: no secret-tool in CI, so the real fallback runs
    const dbPath = join(dir, 'Cookies');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)');
    db.prepare('INSERT INTO cookies VALUES (?, ?, ?, ?)').run('.youtube.com', 'SAPISID', '', encryptLikeChrome('abc123', 'peanuts'));
    db.prepare('INSERT INTO cookies VALUES (?, ?, ?, ?)').run('.youtube.com', 'SID', '', encryptLikeChrome('sidvalue', 'peanuts'));
    db.prepare('INSERT INTO cookies VALUES (?, ?, ?, ?)').run('.example.com', 'SAPISID', '', encryptLikeChrome('nope', 'peanuts'));
    db.close();
    const source: CookieSource = { label: 'Chrome', kind: 'chromium', dbPath, mtimeMs: Date.now() };
    const found = readChromiumCookies(source, 'youtube.com', ['SAPISID', 'SID', '__Secure-3PAPISID']);
    expect(Object.fromEntries(found)).toEqual({ SAPISID: 'abc123', SID: 'sidvalue' });
  });

  it('reads a cookie whose value was never encrypted', () => {
    const dbPath = join(dir, 'Cookies');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)');
    db.prepare('INSERT INTO cookies VALUES (?, ?, ?, ?)').run('.youtube.com', 'SAPISID', 'plain-value', Buffer.alloc(0));
    db.close();
    const source: CookieSource = { label: 'Chrome', kind: 'chromium', dbPath, mtimeMs: Date.now() };
    expect(Object.fromEntries(readChromiumCookies(source, 'youtube.com', ['SAPISID']))).toEqual({ SAPISID: 'plain-value' });
  });

  it('reads Firefox cookies straight, with no decryption', () => {
    const dbPath = join(dir, 'cookies.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE moz_cookies (host TEXT, name TEXT, value TEXT)');
    db.prepare('INSERT INTO moz_cookies VALUES (?, ?, ?)').run('.youtube.com', 'SAPISID', 'ff-value');
    db.prepare('INSERT INTO moz_cookies VALUES (?, ?, ?)').run('.other.com', 'SAPISID', 'ignored');
    db.close();
    const source: CookieSource = { label: 'Firefox', kind: 'firefox', dbPath, mtimeMs: Date.now() };
    expect(Object.fromEntries(readFirefoxCookies(source, 'youtube.com', ['SAPISID']))).toEqual({ SAPISID: 'ff-value' });
  });

  it('leaves the real profile file untouched (works from a copy)', () => {
    const dbPath = join(dir, 'Cookies');
    writeFileSync(dbPath, '');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)');
    db.close();
    const before = require('node:fs').statSync(dbPath).mtimeMs;
    const source: CookieSource = { label: 'Chrome', kind: 'chromium', dbPath, mtimeMs: Date.now() };
    readChromiumCookies(source, 'youtube.com', ['SAPISID']);
    expect(require('node:fs').statSync(dbPath).mtimeMs).toBe(before);
  });
});
