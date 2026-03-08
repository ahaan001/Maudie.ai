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
    const dateFilter = days ? `AND ar.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'` : '';

    const client = await pool.connect();
    try {
      const res = await client.query<{
        agent_name: string;
        total_runs: string;
        avg_duration_ms: string;
        success_rate: string;
        avg_confidence_score: string | null;
      }>(
        `SELECT
           ar.agent_name,
           COUNT(*) AS total_runs,
           COALESCE(AVG(ar.duration_ms), 0) AS avg_duration_ms,
           ROUND(
             100.0 * COUNT(*) FILTER (WHERE ar.status = 'completed') / NULLIF(COUNT(*), 0),
             1
           ) AS success_rate,
           AVG(ds.confidence_score) AS avg_confidence_score
         FROM agent_runs ar
         JOIN projects p ON ar.project_id = p.id AND p.org_id = $1
         LEFT JOIN generated_drafts gd ON gd.agent_run_id = ar.id
         LEFT JOIN draft_sections ds ON ds.draft_id = gd.id
         WHERE 1=1 ${dateFilter}
         GROUP BY ar.agent_name
         ORDER BY total_runs DESC`,
        [orgId]
      );

      const agents = res.rows.map(r => ({
        agentName: r.agent_name,
        totalRuns: parseInt(r.total_runs, 10),
        avgDurationMs: Math.round(parseFloat(r.avg_duration_ms)),
        successRate: parseFloat(r.success_rate ?? '0'),
        avgConfidenceScore:
          r.avg_confidence_score != null ? Math.round(parseFloat(r.avg_confidence_score) * 100) / 100 : null,
      }));

      return NextResponse.json({ agents });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[GET /api/analytics/agent-performance]', err);
    return NextResponse.json({ error: 'Failed to fetch agent performance' }, { status: 500 });
  }
}
