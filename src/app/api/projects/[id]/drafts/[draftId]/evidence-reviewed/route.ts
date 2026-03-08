import { NextRequest, NextResponse } from 'next/server';
import { requireProjectSession } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const { id, draftId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }

  const body = await req.json().catch(() => ({}));
  const sourceCount = typeof body.sourceCount === 'number' ? body.sourceCount : 0;

  await logAudit({
    projectId: id,
    entityType: 'draft',
    entityId: draftId,
    action: 'reviewed',
    actorType: 'human',
    actorId: session.user.userId as string,
    metadata: { sourceCount, viewedAt: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}
