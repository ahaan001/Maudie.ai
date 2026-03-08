import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { projectRequirements } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSectionMetadata, groupRequirementsByCategory, type RequirementWithMeta } from '@/lib/section-metadata';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    try { await requireProjectSession(id); } catch (res) { return res as Response; }

    const pid = id as `${string}-${string}-${string}-${string}-${string}`;

    const rows = await db
      .select()
      .from(projectRequirements)
      .where(eq(projectRequirements.projectId, pid));

    const enriched: RequirementWithMeta[] = rows.map(row => ({
      ...getSectionMetadata(row.sectionKey),
      status: row.status as RequirementWithMeta['status'],
      draft_id: row.draftId ?? null,
      required: true as const,
    }));

    const grouped = groupRequirementsByCategory(enriched);

    return NextResponse.json({ requirements: enriched, grouped });
  } catch (err) {
    console.error('[GET /api/projects/[id]/requirements]', err);
    return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 });
  }
}
