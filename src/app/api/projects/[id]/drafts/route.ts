import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { generatedDrafts, draftSections, citations, reviewTasks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const drafts = await db.select().from(generatedDrafts)
    .where(eq(generatedDrafts.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
    .orderBy(desc(generatedDrafts.createdAt));

  // Attach section count and review task status for each draft
  const enriched = await Promise.all(drafts.map(async (draft) => {
    const sections = await db.select({ id: draftSections.id })
      .from(draftSections).where(eq(draftSections.draftId, draft.id));

    const tasks = await db.select({ id: reviewTasks.id, status: reviewTasks.status, riskLevel: reviewTasks.riskLevel })
      .from(reviewTasks).where(eq(reviewTasks.draftId, draft.id));

    return { ...draft, sectionCount: sections.length, reviewTask: tasks[0] ?? null };
  }));

  return NextResponse.json({ drafts: enriched });
}
