import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { generatedDrafts, draftSections, citations, documents, chunks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [draft] = await db.select().from(generatedDrafts)
    .where(eq(generatedDrafts.id, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);

  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  try { await requireProjectSession(draft.projectId); } catch (res) { return res as Response; }

  const sections = await db.select().from(draftSections)
    .where(eq(draftSections.draftId, id as `${string}-${string}-${string}-${string}-${string}`));

  const rawCitations = await db.select({
    id: citations.id,
    sectionId: citations.sectionId,
    chunkId: citations.chunkId,
    documentId: citations.documentId,
    pageNumber: citations.pageNumber,
    similarityScore: citations.similarityScore,
    textExcerpt: citations.textExcerpt,
    documentName: documents.name,
    sourceType: documents.sourceType,
    chunkContent: chunks.content,
    chunkIndex: chunks.chunkIndex,
    chunkMetadata: chunks.metadata,
  }).from(citations)
    .leftJoin(documents, eq(citations.documentId, documents.id))
    .leftJoin(chunks, eq(citations.chunkId, chunks.id))
    .where(eq(citations.draftId, id as `${string}-${string}-${string}-${string}-${string}`));

  const allCitations = rawCitations.map(c => ({
    ...c,
    chunkMetadata: c.chunkMetadata as { page_number?: number; section?: string; heading?: string } | null,
  }));

  return NextResponse.json({ draft, sections, citations: allCitations });
}
