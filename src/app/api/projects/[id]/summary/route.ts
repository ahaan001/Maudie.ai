import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import {
  projects,
  devices,
  documents,
  failureClusters,
  generatedDrafts,
  reviewTasks,
  agentRuns,
} from '@/lib/db/schema';
import { eq, desc, count, and, inArray } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    try { await requireProjectSession(id); } catch (res) { return res as Response; }

    const pid = id as `${string}-${string}-${string}-${string}-${string}`;

    const [
      projectResult,
      deviceResult,
      docCountResult,
      clusterCountResult,
      draftsResult,
      pendingReviewResult,
      lastIntelligenceRunResult,
    ] = await Promise.all([
      db.select().from(projects).where(eq(projects.id, pid)).limit(1),
      db.select().from(devices).where(eq(devices.projectId, pid)).limit(1),
      db.select({ count: count() }).from(documents).where(eq(documents.projectId, pid)),
      db.select({ count: count() }).from(failureClusters).where(eq(failureClusters.projectId, pid)),
      db.select({
        id: generatedDrafts.id,
        sectionType: generatedDrafts.sectionType,
        status: generatedDrafts.status,
        createdAt: generatedDrafts.createdAt,
      }).from(generatedDrafts)
        .where(eq(generatedDrafts.projectId, pid))
        .orderBy(desc(generatedDrafts.createdAt)),
      db.select({ count: count() }).from(reviewTasks)
        .where(and(
          eq(reviewTasks.projectId, pid),
          inArray(reviewTasks.status, ['pending', 'assigned', 'in_review'])
        )),
      db.select({
        id: agentRuns.id,
        status: agentRuns.status,
        createdAt: agentRuns.createdAt,
        completedAt: agentRuns.completedAt,
      }).from(agentRuns)
        .where(and(eq(agentRuns.projectId, pid), eq(agentRuns.jobType, 'ANALYZE_MAUDE')))
        .orderBy(desc(agentRuns.createdAt))
        .limit(1),
    ]);

    const project = projectResult[0];
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      project,
      device: deviceResult[0] ?? null,
      documentCount: docCountResult[0]?.count ?? 0,
      clusterCount: clusterCountResult[0]?.count ?? 0,
      drafts: draftsResult,
      pendingReviewCount: pendingReviewResult[0]?.count ?? 0,
      lastIntelligenceRun: lastIntelligenceRunResult[0] ?? null,
    });
  } catch (err) {
    console.error('[GET /api/projects/:id/summary]', err);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
