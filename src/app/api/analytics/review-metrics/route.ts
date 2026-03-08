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
    const dateFilter = days ? `AND rt.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'` : '';

    const client = await pool.connect();
    try {
      // Avg time from creation to completion (ms)
      const timeRes = await client.query<{ avg_ms: string | null }>(
        `SELECT
           AVG(EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) * 1000) AS avg_ms
         FROM review_tasks rt
         JOIN projects p ON rt.project_id = p.id AND p.org_id = $1
         WHERE rt.completed_at IS NOT NULL ${dateFilter}`,
        [orgId]
      );
      const avgTimeToApprovalMs = timeRes.rows[0]?.avg_ms != null
        ? Math.round(parseFloat(timeRes.rows[0].avg_ms))
        : null;

      // Action breakdown from approvals
      const actionsRes = await client.query<{ action: string; count: string }>(
        `SELECT a.action, COUNT(*) AS count
         FROM approvals a
         JOIN review_tasks rt ON rt.id = a.review_task_id
         JOIN projects p ON rt.project_id = p.id AND p.org_id = $1
         WHERE 1=1 ${dateFilter.replace('rt.created_at', 'a.created_at')}
         GROUP BY a.action`,
        [orgId]
      );

      const actionCounts: Record<string, number> = {};
      let totalActions = 0;
      for (const row of actionsRes.rows) {
        actionCounts[row.action] = parseInt(row.count, 10);
        totalActions += parseInt(row.count, 10);
      }

      const approvalRate =
        totalActions > 0
          ? Math.round(
              (((actionCounts['approved'] ?? 0) + (actionCounts['auto_approved'] ?? 0)) / totalActions) * 1000
            ) / 10
          : 0;
      const escalationRate =
        totalActions > 0
          ? Math.round(((actionCounts['escalated'] ?? 0) / totalActions) * 1000) / 10
          : 0;
      const autoApprovalRate =
        totalActions > 0
          ? Math.round(((actionCounts['auto_approved'] ?? 0) / totalActions) * 1000) / 10
          : 0;

      // Reviews by risk level
      const riskRes = await client.query<{ risk_level: string; count: string }>(
        `SELECT rt.risk_level, COUNT(*) AS count
         FROM review_tasks rt
         JOIN projects p ON rt.project_id = p.id AND p.org_id = $1
         WHERE 1=1 ${dateFilter}
         GROUP BY rt.risk_level`,
        [orgId]
      );

      const reviewsByRiskLevel: Record<string, number> = { low: 0, medium: 0, high: 0 };
      for (const row of riskRes.rows) {
        if (row.risk_level) reviewsByRiskLevel[row.risk_level] = parseInt(row.count, 10);
      }

      // Funnel data: auto_approved, human_reviewed (non-auto), approved, rejected
      const humanReviewed =
        (actionCounts['approved'] ?? 0) + (actionCounts['rejected'] ?? 0) + (actionCounts['escalated'] ?? 0);

      return NextResponse.json({
        avg_time_to_approval_ms: avgTimeToApprovalMs,
        approval_rate: approvalRate,
        escalation_rate: escalationRate,
        auto_approval_rate: autoApprovalRate,
        reviews_by_risk_level: reviewsByRiskLevel,
        funnel: [
          { name: 'Total Reviews', value: totalActions },
          { name: 'Auto-approved', value: actionCounts['auto_approved'] ?? 0 },
          { name: 'Human Reviewed', value: humanReviewed },
          { name: 'Approved', value: actionCounts['approved'] ?? 0 },
          { name: 'Rejected', value: actionCounts['rejected'] ?? 0 },
        ],
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[GET /api/analytics/review-metrics]', err);
    return NextResponse.json({ error: 'Failed to fetch review metrics' }, { status: 500 });
  }
}
