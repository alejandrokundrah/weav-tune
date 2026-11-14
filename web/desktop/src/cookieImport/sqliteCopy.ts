import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Opens a copy of a browser's cookie database: the browser usually has the real file locked, and
 * nothing here should ever write to a person's actual profile. The copy (and its -wal/-shm
 * sidecars, if the browser was mid-write) goes to a throwaway folder that's removed afterwards.
 */
export function withCopiedDatabase<T>(dbPath: string, run: (db: DatabaseSync) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'weavtune-cookies-'));
  const copy = join(dir, 'db.sqlite');
  try {
    copyFileSync(dbPath, copy);
    for (const ext of ['-wal', '-shm']) {
      try {
        copyFileSync(dbPath + ext, copy + ext);
      } catch {
        // No pending journal to carry over.
      }
    }
    const db = new DatabaseSync(copy, { readOnly: true });
    try {
      return run(db);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
