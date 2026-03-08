import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { riskControls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; hazardId: string; controlId: string }> }
) {
  const { id, controlId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'engineer')) {
    return NextResponse.json({ error: 'Forbidden: engineer role or higher required' }, { status: 403 });
  }

  try {
    await db.delete(riskControls).where(
      eq(riskControls.id, controlId as `${string}-${string}-${string}-${string}-${string}`)
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/projects/:id/risk/hazards/:hazardId/controls/:controlId]', err);
    return NextResponse.json({ error: 'Failed to delete control' }, { status: 500 });
  }
}
