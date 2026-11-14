import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import type { CookieSource } from './locate';
import { withCopiedDatabase } from './sqliteCopy';

/**
 * Decrypts a Chromium cookie's `encrypted_value` (the plain `value` column is empty once a
 * cookie's been through this). The same "Safe Storage" scheme every Chromium browser uses:
 * - Linux/macOS: AES-128-CBC, a fixed IV of 16 spaces, keyed from a password kept in the OS
 *   keyring (or the documented "peanuts" fallback when there's no keyring to ask).
 * - Windows: AES-256-GCM, keyed from `Local State`'s `os_crypt.encrypted_key`, itself unwrapped
 *   with DPAPI (so only this Windows account can read it, with no password prompt).
 * A cookie Chrome has (since v127 on Windows) re-wrapped with its "app-bound" protection can't be
 * read without going through Chrome's own elevation service; that case surfaces as "no value".
 */

const browserKeyringName = (label: string): string => (label.startsWith('Brave') ? 'Brave' : label.startsWith('Chromium') ? 'Chromium' : label.startsWith('Edge') ? 'Microsoft Edge' : 'Chrome');

function linuxPassword(label: string): string {
  const service = `${browserKeyringName(label)} Safe Storage`;
  try {
    return execFileSync('secret-tool', ['lookup', 'application', browserKeyringName(label).toLowerCase().replace(' ', '-'), 'xdg:schema', 'chrome_libsecret_os_crypt_password_v2'], { encoding: 'utf8', timeout: 5000 }).trim() || 'peanuts';
  } catch {
    try {
      return execFileSync('secret-tool', ['lookup', 'application', service], { encoding: 'utf8', timeout: 5000 }).trim() || 'peanuts';
    } catch {
      // No keyring daemon (common outside a desktop session): Chrome's own documented fallback.
      return 'peanuts';
    }
  }
}

function macPassword(label: string): string {
  const service = `${browserKeyringName(label)} Safe Storage`;
  return execFileSync('security', ['find-generic-password', '-w', '-s', service, '-a', browserKeyringName(label)], { encoding: 'utf8', timeout: 10_000 }).trim();
}

function posixKey(label: string): Buffer {
  const password = platform() === 'darwin' ? macPassword(label) : linuxPassword(label);
  return pbkdf2Sync(password, 'saltysalt', 1, 16, 'sha1');
}

function decryptPosix(encrypted: Buffer, key: Buffer): string | null {
  if (encrypted.length < 3) return null;
  const prefix = encrypted.subarray(0, 3).toString('latin1');
  if (prefix !== 'v10' && prefix !== 'v11') return null;
  try {
    const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
    decipher.setAutoPadding(true);
    const out = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()]);
    return out.toString('utf8');
  } catch {
    return null;
  }
}

/** Unwraps `Local State`'s AES key with DPAPI, through a short, non-interactive PowerShell call. */
function dpapiUnprotect(base64: string): Buffer {
  const script = `
$bytes = [Convert]::FromBase64String('${base64}')
$plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([Convert]::ToBase64String($plain))
`;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 10_000 });
  return Buffer.from(out.trim(), 'base64');
}

function windowsKey(root: string): Buffer {
  const localState = JSON.parse(readFileSync(join(root, 'Local State'), 'utf8')) as { os_crypt?: { encrypted_key?: string } };
  const wrapped = localState.os_crypt?.encrypted_key;
  if (!wrapped) throw new Error("Local State has no encryption key");
  const bytes = Buffer.from(wrapped, 'base64');
  const dpapiBlob = bytes.subarray(5); // drops the leading "DPAPI" tag
  return dpapiUnprotect(dpapiBlob.toString('base64'));
}

function decryptWindows(encrypted: Buffer, key: Buffer): string | null {
  if (encrypted.length < 3) return null;
  const prefix = encrypted.subarray(0, 3).toString('latin1');
  if (prefix !== 'v10' && prefix !== 'v11') return null; // v20 (app-bound) isn't something this can unwrap
  try {
    const nonce = encrypted.subarray(3, 15);
    const tag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(15, encrypted.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

let keyCache = new Map<string, Buffer>();

function keyFor(source: CookieSource): Buffer {
  const cacheKey = platform() === 'win32' ? (source.root ?? '') : browserKeyringName(source.label);
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;
  const key = platform() === 'win32' ? windowsKey(source.root ?? '') : posixKey(source.label);
  keyCache.set(cacheKey, key);
  return key;
}

/** Clears the cached decryption key; a fresh attempt will ask the OS again. */
export function resetChromiumKeyCache(): void {
  keyCache = new Map();
}

export function readChromiumCookies(source: CookieSource, host: string, names: string[]): Map<string, string> {
  const found = new Map<string, string>();
  const rows = withCopiedDatabase(source.dbPath, (db) =>
    db
      .prepare(`SELECT name, value, encrypted_value FROM cookies WHERE host_key LIKE ? AND name IN (${names.map(() => '?').join(',')})`)
      .all(`%${host}`, ...names) as { name: string; value: string; encrypted_value: Uint8Array }[],
  );
  if (!rows.length) return found;
  let key: Buffer | null = null;
  for (const row of rows) {
    if (row.value) {
      found.set(row.name, row.value);
      continue;
    }
    const blob = Buffer.from(row.encrypted_value ?? new Uint8Array());
    if (!blob.length) continue;
    key ??= keyFor(source);
    const decrypted = platform() === 'win32' ? decryptWindows(blob, key) : decryptPosix(blob, key);
    if (decrypted) found.set(row.name, decrypted);
  }
  return found;
}
