import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { reviewTasks, generatedDrafts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/permissions';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (res) { return res as Response; }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const status = searchParams.get('status');

  const baseQuery = db.select({
    id: reviewTasks.id,
    projectId: reviewTasks.projectId,
    draftId: reviewTasks.draftId,
    assignedTo: reviewTasks.assignedTo,
    status: reviewTasks.status,
    riskLevel: reviewTasks.riskLevel,
    flags: reviewTasks.flags,
    createdAt: reviewTasks.createdAt,
    completedAt: reviewTasks.completedAt,
    draftSectionType: generatedDrafts.sectionType,
    draftTitle: generatedDrafts.title,
  }).from(reviewTasks)
    .leftJoin(generatedDrafts, eq(reviewTasks.draftId, generatedDrafts.id))
    .orderBy(desc(reviewTasks.createdAt))
    .limit(100);

  const tasks = await baseQuery;

  const filtered = tasks.filter(t => {
    if (projectId && t.projectId !== projectId) return false;
    if (status && t.status !== status) return false;
    return true;
  });

  // Note: session is available here for future per-task org filtering
  void session;

  return NextResponse.json({ tasks: filtered });
}
