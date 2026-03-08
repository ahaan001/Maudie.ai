import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { projectRequirements } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    try { await requireProjectSession(id); } catch (res) { return res as Response; }

    const pid = id as `${string}-${string}-${string}-${string}-${string}`;

    const rows = await db
      .select({
        status: projectRequirements.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(projectRequirements)
      .where(eq(projectRequirements.projectId, pid))
      .groupBy(projectRequirements.status);

    let approvedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;

    for (const row of rows) {
      if (row.status === 'approved') approvedCount = row.count;
      else if (row.status === 'in_progress') inProgressCount = row.count;
      else notStartedCount = row.count;
    }

    const totalRequired = approvedCount + inProgressCount + notStartedCount;
    const score = totalRequired > 0 ? Math.round((approvedCount / totalRequired) * 100) : 0;

    return NextResponse.json({ score, approvedCount, inProgressCount, notStartedCount, totalRequired });
  } catch (err) {
    console.error('[GET /api/projects/[id]/compliance-score]', err);
    return NextResponse.json({ error: 'Failed to fetch compliance score' }, { status: 500 });
  }
}
