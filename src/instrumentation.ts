/**
 * Next.js instrumentation — runs once on server startup.
 * Starts pg-boss workers automatically when the app boots.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorkers } = await import('./lib/queue/worker');
    try {
      await startWorkers();
      console.log('[instrumentation] Workers started');
    } catch (err) {
      console.error('[instrumentation] Failed to start workers:', err);
    }
  }
}
