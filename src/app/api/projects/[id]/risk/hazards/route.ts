import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { hazards } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

function computeAcceptability(s: number, p: number): string {
  const rpr = s * p;
  if (rpr <= 4) return 'acceptable';
  if (rpr <= 9) return 'alarp';
  return 'unacceptable';
}

const CreateHazardSchema = z.object({
  description: z.string().min(1),
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'engineer')) {
    return NextResponse.json({ error: 'Forbidden: engineer role or higher required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateHazardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { description, harm, hazardousSituation, hazardCategory, initialSeverity, initialProbability,
      mitigationMeasures, residualSeverity, residualProbability, riskStatus } = parsed.data;

    // Auto-compute acceptability from initial RPR if not provided
    let acceptability = parsed.data.acceptability;
    if (!acceptability && initialSeverity && initialProbability) {
      acceptability = computeAcceptability(initialSeverity, initialProbability) as 'acceptable' | 'alarp' | 'unacceptable';
    }

    const pid = id as `${string}-${string}-${string}-${string}-${string}`;
    const [hazard] = await db.insert(hazards).values({
      projectId: pid,
      description,
      harm,
      hazardousSituation,
      hazardCategory,
      initialSeverity,
      initialProbability,
      mitigationMeasures: mitigationMeasures ?? [],
      residualSeverity,
      residualProbability,
      acceptability,
      riskStatus: riskStatus ?? 'open',
      source: 'human',
      aiGenerated: false,
    }).returning();

    return NextResponse.json({ hazard });
  } catch (err) {
    console.error('[POST /api/projects/:id/risk/hazards]', err);
    return NextResponse.json({ error: 'Failed to create hazard' }, { status: 500 });
  }
}
