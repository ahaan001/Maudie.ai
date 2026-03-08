/**
 * In-memory store for generated export files.
 * Each token is single-use and expires after 10 minutes.
 */

interface TempEntry {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
}

const store = new Map<string, TempEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function purgeExpired() {
  const now = Date.now();
  for (const [token, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(token);
  }
}

export function storeTempFile(buffer: Buffer, filename: string): string {
  purgeExpired();
  const token = crypto.randomUUID();
  store.set(token, { buffer, filename, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function getTempFile(token: string): { buffer: Buffer; filename: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(token);
    return null;
  }
  store.delete(token); // single-use
  return { buffer: entry.buffer, filename: entry.filename };
}
