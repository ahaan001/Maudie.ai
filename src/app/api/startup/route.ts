/**
 * Startup endpoint — call once after boot to initialize pg-boss workers.
 * In production, call this via a startup script or Next.js instrumentation.ts
 */
import { NextResponse } from 'next/server';
import { startWorkers } from '@/lib/queue/worker';

let initialized = false;

export async function POST() {
  if (initialized) {
    return NextResponse.json({ status: 'already_running' });
  }
  try {
    await startWorkers();
    initialized = true;
    return NextResponse.json({ status: 'workers_started' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
