import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { riskControls } from '@/lib/db/schema';
import { z } from 'zod';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

const CreateControlSchema = z.object({
  controlType: z.enum(['design', 'protective', 'information']),
  description: z.string().min(1),
  verificationMethod: z.string().optional(),
  verificationStatus: z.enum(['pending', 'verified', 'failed']).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; hazardId: string }> }
) {
  const { id, hazardId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'engineer')) {
    return NextResponse.json({ error: 'Forbidden: engineer role or higher required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateControlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const [control] = await db.insert(riskControls).values({
      hazardId: hazardId as `${string}-${string}-${string}-${string}-${string}`,
      projectId: id as `${string}-${string}-${string}-${string}-${string}`,
      controlType: parsed.data.controlType,
      description: parsed.data.description,
      verificationMethod: parsed.data.verificationMethod,
      verificationStatus: parsed.data.verificationStatus ?? 'pending',
    }).returning();

    return NextResponse.json({ control });
  } catch (err) {
    console.error('[POST /api/projects/:id/risk/hazards/:hazardId/controls]', err);
    return NextResponse.json({ error: 'Failed to add control' }, { status: 500 });
  }
}
