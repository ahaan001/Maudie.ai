import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chunks, documents } from '@/lib/db/schema';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const chunkId = req.nextUrl.searchParams.get('chunkId');
  if (!chunkId) return NextResponse.json({ error: 'chunkId required' }, { status: 400 });

  const cid = chunkId as `${string}-${string}-${string}-${string}-${string}`;
  const did = docId as `${string}-${string}-${string}-${string}-${string}`;

  const [targetChunk] = await db.select().from(chunks)
    .where(eq(chunks.id, cid)).limit(1);

  if (!targetChunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });

  const windowChunks = await db.select({
    id: chunks.id,
    chunkIndex: chunks.chunkIndex,
    content: chunks.content,
    metadata: chunks.metadata,
  }).from(chunks)
    .where(and(
      eq(chunks.documentId, did),
      gte(chunks.chunkIndex, targetChunk.chunkIndex - 1),
      lte(chunks.chunkIndex, targetChunk.chunkIndex + 1),
    ))
    .orderBy(asc(chunks.chunkIndex));

  const [doc] = await db.select({
    id: documents.id,
    name: documents.name,
    sourceType: documents.sourceType,
    mimeType: documents.mimeType,
    ingestionStatus: documents.ingestionStatus,
  }).from(documents).where(eq(documents.id, did)).limit(1);

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const result = windowChunks.map(c => ({
    ...c,
    metadata: c.metadata as { page_number?: number; section?: string; heading?: string } | null,
    isCited: c.id === chunkId,
  }));

  return NextResponse.json({ document: doc, chunks: result });
}
