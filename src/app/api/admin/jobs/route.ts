import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/permissions';
import { hasRole } from '@/lib/auth/permissions';
import { pool } from '@/lib/db/client';

export async function GET() {
  let session;
  try { session = await requireSession(); } catch (res) { return res as Response; }

  if (!hasRole(session.user.orgRole, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await pool.connect();
  let rows: { name: string; state: string; count: number }[] = [];
  try {
    const result = await client.query<{ name: string; state: string; count: number }>(`
      SELECT name, state, count(*)::int AS count
      FROM pgboss.job
      GROUP BY name, state
      ORDER BY name, state
    `);
    rows = result.rows;
  } finally {
    client.release();
  }

  const queues: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    queues[row.name] ??= {};
    queues[row.name][row.state] = row.count;
  }

  return NextResponse.json({ queues });
}
