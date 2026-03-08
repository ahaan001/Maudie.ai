import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { draftSections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashContent } from '@/lib/utils/hash';
import { logAudit } from '@/lib/audit/logger';
import { z } from 'zod';

const UpdateSectionSchema = z.object({
  content: z.string().min(1),
  editorId: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { id: draftId, sid: sectionId } = await params;

  try {
    const body = await req.json();
    const parsed = UpdateSectionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const [existing] = await db.select().from(draftSections)
      .where(eq(draftSections.id, sectionId as `${string}-${string}-${string}-${string}-${string}`)).limit(1);

    if (!existing) return NextResponse.json({ error: 'Section not found' }, { status: 404 });

    const newHash = hashContent(parsed.data.content);

    const [updated] = await db.update(draftSections).set({
      content: parsed.data.content,
      contentHash: newHash,
      aiGenerated: false, // marked as human-edited
      version: existing.version + 1,
    }).where(eq(draftSections.id, sectionId as `${string}-${string}-${string}-${string}-${string}`))
      .returning();

    await logAudit({
      entityType: 'draft_section',
      entityId: sectionId,
      action: 'edited',
      actorType: 'human',
      actorId: parsed.data.editorId ?? 'unknown',
      contentHash: newHash,
      diff: {
        originalHash: existing.contentHash,
        newHash,
        version: updated.version,
      },
    });

    return NextResponse.json({ section: updated });
  } catch (err) {
    console.error('[PUT /api/drafts/:id/sections/:sid]', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
