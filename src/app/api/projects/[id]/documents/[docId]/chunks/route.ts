import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chunks } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const did = docId as `${string}-${string}-${string}-${string}-${string}`;

    const rows = await db
      .select({
        id: chunks.id,
        chunkIndex: chunks.chunkIndex,
        content: chunks.content,
        tokenCount: chunks.tokenCount,
      })
      .from(chunks)
      .where(eq(chunks.documentId, did))
      .orderBy(asc(chunks.chunkIndex))
      .limit(10);

    const preview = rows.map((c) => ({
      ...c,
      content: c.content.slice(0, 300),
    }));

    return NextResponse.json({ chunks: preview });
  } catch (err) {
    console.error('[GET /api/projects/:id/documents/:docId/chunks]', err);
    return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 });
  }
}
