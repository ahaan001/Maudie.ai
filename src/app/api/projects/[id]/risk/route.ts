import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { hazards, riskControls } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

function computeAcceptability(s: number, p: number): string {
  const rpr = s * p;
  if (rpr <= 4) return 'acceptable';
  if (rpr <= 9) return 'alarp';
  return 'unacceptable';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  try {
    const pid = id as `${string}-${string}-${string}-${string}-${string}`;
    const allHazards = await db.select().from(hazards)
      .where(eq(hazards.projectId, pid))
      .orderBy(desc(hazards.createdAt));

    const allControls = await db.select().from(riskControls)
      .where(eq(riskControls.projectId, pid));

    // Group controls by hazardId
    const controlsByHazard = new Map<string, typeof allControls>();
    for (const control of allControls) {
      const list = controlsByHazard.get(control.hazardId) ?? [];
      list.push(control);
      controlsByHazard.set(control.hazardId, list);
    }

    const hazardsWithControls = allHazards.map((h, idx) => {
      const iS = h.initialSeverity ?? 0;
      const iP = h.initialProbability ?? 0;
      const rS = h.residualSeverity ?? 0;
      const rP = h.residualProbability ?? 0;
      return {
        ...h,
        number: idx + 1,
        initialRpr: iS && iP ? iS * iP : null,
        residualRpr: rS && rP ? rS * rP : null,
        controls: controlsByHazard.get(h.id) ?? [],
      };
    });

    const summary = {
      total: hazardsWithControls.length,
      open: hazardsWithControls.filter(h => h.riskStatus === 'open').length,
      mitigated: hazardsWithControls.filter(h => h.riskStatus === 'mitigated').length,
      accepted: hazardsWithControls.filter(h => h.riskStatus === 'accepted').length,
      transferred: hazardsWithControls.filter(h => h.riskStatus === 'transferred').length,
      unacceptable: hazardsWithControls.filter(h => h.acceptability === 'unacceptable').length,
      highestUnmitigatedRpr: hazardsWithControls
        .filter(h => h.riskStatus === 'open' && h.initialRpr !== null)
        .reduce((max, h) => Math.max(max, h.initialRpr ?? 0), 0),
    };

    return NextResponse.json({ hazards: hazardsWithControls, summary });
  } catch (err) {
    console.error('[GET /api/projects/:id/risk]', err);
    return NextResponse.json({ error: 'Failed to fetch risk data' }, { status: 500 });
  }
}
