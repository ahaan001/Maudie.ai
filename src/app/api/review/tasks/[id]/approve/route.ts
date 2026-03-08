import { NextRequest, NextResponse } from 'next/server';
import { processApproval } from '@/lib/agents/hitl';
import { db } from '@/lib/db/client';
import { reviewTasks, draftSections, generatedDrafts, projectRequirements } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireSession, hasRole } from '@/lib/auth/permissions';

const ApproveSchema = z.object({
  editedContent: z.string().optional(),
  comments: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let session;
  try { session = await requireSession(); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'reviewer')) {
    return NextResponse.json({ error: 'Forbidden: reviewer role or higher required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const [task] = await db.select().from(reviewTasks)
      .where(eq(reviewTasks.id, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.status === 'approved' || task.status === 'rejected') {
      return NextResponse.json({ error: 'Task already completed' }, { status: 409 });
    }

    // Get draft content for audit diff
    const [draft] = await db.select().from(generatedDrafts)
      .where(eq(generatedDrafts.id, task.draftId)).limit(1);
    const [section] = await db.select().from(draftSections)
      .where(eq(draftSections.draftId, task.draftId)).limit(1);

    const result = await processApproval({
      reviewTaskId: id,
      approvedBy: session.user.userId,
      action: 'approved',
      editedContent: parsed.data.editedContent,
      originalContent: section?.content ?? '',
      comments: parsed.data.comments,
    });

    // Sync requirement status → approved
    if (draft?.sectionType) {
      await db.update(projectRequirements)
        .set({ status: 'approved', draftId: task.draftId, updatedAt: new Date() })
        .where(and(
          eq(projectRequirements.projectId, task.projectId),
          eq(projectRequirements.sectionKey, draft.sectionType),
        ));
    }

    return NextResponse.json({ approval: result });
  } catch (err) {
    console.error('[PUT /api/review/tasks/:id/approve]', err);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}
