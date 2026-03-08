import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/permissions';

export async function GET(req: NextRequest) {
  try {
    let session;
    try {
      session = await requireSession();
    } catch (res) {
      return res as Response;
    }

    const orgId = session.user.orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization associated with your account' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const days = searchParams.get('days');
    // Default: last 12 weeks. If days param given, use it but still bucket by week.
    const interval = days ? `${parseInt(days, 10)} days` : '12 weeks';

    const client = await pool.connect();
    try {
      const res = await client.query<{ week: Date; count: string }>(
        `SELECT
           DATE_TRUNC('week', p.created_at) AS week,
           COUNT(*) AS count
         FROM projects p
         WHERE p.org_id = $1
           AND p.created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY 1
         ORDER BY 1`,
        [orgId]
      );

      const timeline = res.rows.map(r => ({
        week: r.week.toISOString().slice(0, 10),
        count: parseInt(r.count, 10),
      }));

      return NextResponse.json({ timeline });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[GET /api/analytics/projects-timeline]', err);
    return NextResponse.json({ error: 'Failed to fetch projects timeline' }, { status: 500 });
  }
}
