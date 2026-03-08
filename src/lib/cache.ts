/**
 * Redis cache helpers with graceful degradation.
 * All calls are wrapped in try/catch — if Redis is unavailable, the app
 * falls back to uncached behavior without crashing.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const OPTS = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
} as const;

// Shared command connection (lazy singleton)
let _cmd: Redis | null = null;
function getCmd(): Redis {
  if (!_cmd) {
    _cmd = new Redis(REDIS_URL, OPTS);
    _cmd.on('error', () => { /* suppress — degradation is handled at call sites */ });
  }
  return _cmd;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await getCmd().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await getCmd().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { /* non-fatal */ }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await getCmd().del(...keys);
  } catch { /* non-fatal */ }
}

const PUB_CHANNEL = (projectId: string) => `job-complete:${projectId}`;

export async function publishJobComplete(
  projectId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await getCmd().publish(PUB_CHANNEL(projectId), JSON.stringify(payload));
  } catch { /* non-fatal */ }
}

/**
 * Subscribe to job completion events for a project.
 * Creates a dedicated connection (subscribed connections cannot issue commands).
 * Returns an unsubscribe function that should be called on client disconnect.
 */
export function subscribeJobComplete(
  projectId: string,
  onMessage: (payload: Record<string, unknown>) => void
): () => void {
  const sub = new Redis(REDIS_URL, OPTS);
  sub.on('error', () => { /* suppress */ });

  const channel = PUB_CHANNEL(projectId);
  sub.subscribe(channel).catch(() => { /* non-fatal */ });

  sub.on('message', (_chan: string, message: string) => {
    try {
      onMessage(JSON.parse(message) as Record<string, unknown>);
    } catch { /* malformed message */ }
  });

  return () => {
    sub.unsubscribe(channel).catch(() => {}).finally(() => sub.quit().catch(() => {}));
  };
}
