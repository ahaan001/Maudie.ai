import { NextRequest, NextResponse } from 'next/server';
import { processApproval } from '@/lib/agents/hitl';
import { db } from '@/lib/db/client';
import { reviewTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireSession, hasRole } from '@/lib/auth/permissions';

const RejectSchema = z.object({
  reason: z.string().min(1),
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
    const parsed = RejectSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const [task] = await db.select().from(reviewTasks)
      .where(eq(reviewTasks.id, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const result = await processApproval({
      reviewTaskId: id,
      approvedBy: session.user.userId,
      action: 'rejected',
      originalContent: '',
      comments: parsed.data.reason,
    });

    return NextResponse.json({ rejection: result });
  } catch (err) {
    console.error('[PUT /api/review/tasks/:id/reject]', err);
    return NextResponse.json({ error: 'Rejection failed' }, { status: 500 });
  }
}
