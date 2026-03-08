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
    const dateFilter = days ? `AND p.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'` : '';
    const docDateFilter = days ? `AND d.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'` : '';
    const draftDateFilter = days ? `AND gd.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'` : '';
    const agentDateFilter = days ? `AND ar.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'` : '';

    const client = await pool.connect();
    try {
      // 1. Total projects
      const projectsRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM projects p WHERE p.org_id = $1 ${dateFilter}`,
        [orgId]
      );
      const totalProjects = parseInt(projectsRes.rows[0]?.count ?? '0', 10);

      // 2. Total documents
      const docsRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM documents d
         JOIN projects p ON p.id = d.project_id
         WHERE p.org_id = $1 ${docDateFilter}`,
        [orgId]
      );
      const totalDocuments = parseInt(docsRes.rows[0]?.count ?? '0', 10);

      // 3. Drafts (total + approved)
      const draftsRes = await client.query<{ total: string; approved: string }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE gd.status = 'approved') AS approved
         FROM generated_drafts gd
         JOIN projects p ON p.id = gd.project_id
         WHERE p.org_id = $1 ${draftDateFilter}`,
        [orgId]
      );
      const totalDraftsGenerated = parseInt(draftsRes.rows[0]?.total ?? '0', 10);
      const totalApprovedDrafts = parseInt(draftsRes.rows[0]?.approved ?? '0', 10);

      // 4. Pending reviews
      const pendingRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM review_tasks rt
         JOIN projects p ON p.id = rt.project_id
         WHERE p.org_id = $1 AND rt.status = 'pending'`,
        [orgId]
      );
      const totalPendingReviews = parseInt(pendingRes.rows[0]?.count ?? '0', 10);

      // 5. Agent token usage + avg generation time (draft agents only)
      const agentRes = await client.query<{ tokens: string; avg_ms: string }>(
        `SELECT
           COALESCE(SUM(ar.input_tokens + ar.output_tokens), 0) AS tokens,
           COALESCE(AVG(ar.duration_ms) FILTER (WHERE ar.agent_name ILIKE '%draft%'), 0) AS avg_ms
         FROM agent_runs ar
         JOIN projects p ON p.id = ar.project_id
         WHERE p.org_id = $1 ${agentDateFilter}`,
        [orgId]
      );
      const totalAgentTokensUsed = parseInt(agentRes.rows[0]?.tokens ?? '0', 10);
      const avgDraftGenerationTimeMs = Math.round(parseFloat(agentRes.rows[0]?.avg_ms ?? '0'));

      // 6. Avg compliance score + per-project scores
      const scoresRes = await client.query<{ project_id: string; name: string; approved: string; total: string }>(
        `SELECT
           pr.project_id,
           p.name,
           COUNT(*) FILTER (WHERE pr.status = 'approved') AS approved,
           COUNT(*) AS total
         FROM project_requirements pr
         JOIN projects p ON p.id = pr.project_id
         WHERE p.org_id = $1
         GROUP BY pr.project_id, p.name`,
        [orgId]
      );

      const projectScores = scoresRes.rows.map(r => {
        const total = parseInt(r.total, 10);
        const approved = parseInt(r.approved, 10);
        return {
          projectId: r.project_id,
          name: r.name,
          score: total > 0 ? Math.round((approved / total) * 100) : 0,
        };
      });

      const avgComplianceScore =
        projectScores.length > 0
          ? Math.round(projectScores.reduce((sum, p) => sum + p.score, 0) / projectScores.length)
          : 0;

      return NextResponse.json({
        total_projects: totalProjects,
        total_documents: totalDocuments,
        total_drafts_generated: totalDraftsGenerated,
        total_approved_drafts: totalApprovedDrafts,
        total_pending_reviews: totalPendingReviews,
        avg_compliance_score: avgComplianceScore,
        total_agent_tokens_used: totalAgentTokensUsed,
        avg_draft_generation_time_ms: avgDraftGenerationTimeMs,
        project_scores: projectScores,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[GET /api/analytics/overview]', err);
    return NextResponse.json({ error: 'Failed to fetch analytics overview' }, { status: 500 });
  }
}
