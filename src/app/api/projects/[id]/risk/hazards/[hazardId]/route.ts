import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { hazards, riskControls } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

function computeAcceptability(s: number, p: number): string {
  const rpr = s * p;
  if (rpr <= 4) return 'acceptable';
  if (rpr <= 9) return 'alarp';
  return 'unacceptable';
}

const UpdateHazardSchema = z.object({
  description: z.string().min(1).optional(),
  harm: z.string().optional(),
  hazardousSituation: z.string().optional(),
  hazardCategory: z.string().optional(),
  initialSeverity: z.number().int().min(1).max(5).optional(),
  initialProbability: z.number().int().min(1).max(5).optional(),
  mitigationMeasures: z.array(z.string()).optional(),
  residualSeverity: z.number().int().min(1).max(5).optional(),
  residualProbability: z.number().int().min(1).max(5).optional(),
  acceptability: z.enum(['acceptable', 'alarp', 'unacceptable']).optional(),
  riskStatus: z.enum(['open', 'mitigated', 'accepted', 'transferred']).optional(),
});

export async function PATCH(
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
    const parsed = UpdateHazardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const updates: Record<string, unknown> = { ...parsed.data };

    // Auto-recompute acceptability if severity/probability changed but acceptability not provided
    if (!parsed.data.acceptability && (parsed.data.initialSeverity || parsed.data.initialProbability)) {
      // Fetch current values to fill missing
      const hid = hazardId as `${string}-${string}-${string}-${string}-${string}`;
      const [current] = await db.select({ initialSeverity: hazards.initialSeverity, initialProbability: hazards.initialProbability })
        .from(hazards).where(eq(hazards.id, hid)).limit(1);
      const s = parsed.data.initialSeverity ?? current?.initialSeverity;
      const p = parsed.data.initialProbability ?? current?.initialProbability;
      if (s && p) {
        updates.acceptability = computeAcceptability(s, p);
      }
    }

    const hid = hazardId as `${string}-${string}-${string}-${string}-${string}`;
    const pid = id as `${string}-${string}-${string}-${string}-${string}`;
    const [updated] = await db.update(hazards)
      .set(updates as Parameters<typeof db.update>[0] extends unknown ? never : never)
      .where(and(eq(hazards.id, hid), eq(hazards.projectId, pid)))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Hazard not found' }, { status: 404 });
    return NextResponse.json({ hazard: updated });
  } catch (err) {
    console.error('[PATCH /api/projects/:id/risk/hazards/:hazardId]', err);
    return NextResponse.json({ error: 'Failed to update hazard' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; hazardId: string }> }
) {
  const { id, hazardId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'engineer')) {
    return NextResponse.json({ error: 'Forbidden: engineer role or higher required' }, { status: 403 });
  }

  try {
    const hid = hazardId as `${string}-${string}-${string}-${string}-${string}`;
    const pid = id as `${string}-${string}-${string}-${string}-${string}`;

    // Delete controls first (FK-safe)
    await db.delete(riskControls).where(eq(riskControls.hazardId, hid));
    await db.delete(hazards).where(and(eq(hazards.id, hid), eq(hazards.projectId, pid)));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/projects/:id/risk/hazards/:hazardId]', err);
    return NextResponse.json({ error: 'Failed to delete hazard' }, { status: 500 });
  }
}
