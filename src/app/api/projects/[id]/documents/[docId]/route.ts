import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { documents, chunks, citations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string; docId: string }> };

async function getDocumentForProject(projectId: string, docId: string) {
  const [doc] = await db.select()
    .from(documents)
    .where(and(
      eq(documents.id, docId as `${string}-${string}-${string}-${string}-${string}`),
      eq(documents.projectId, projectId as `${string}-${string}-${string}-${string}-${string}`),
    ))
    .limit(1);
  return doc ?? null;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id, docId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }

  if (!hasRole(session.user.orgRole, 'engineer')) {
    return NextResponse.json({ error: 'Forbidden: engineer role or higher required' }, { status: 403 });
  }

  try {
    const doc = await getDocumentForProject(id, docId);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Delete citations referencing chunks of this document
    await db.delete(citations).where(
      eq(citations.documentId, docId as `${string}-${string}-${string}-${string}-${string}`)
    );

    // Delete all chunks for this document
    await db.delete(chunks).where(
      eq(chunks.documentId, docId as `${string}-${string}-${string}-${string}-${string}`)
    );

    // Delete the document record
    await db.delete(documents).where(
      eq(documents.id, docId as `${string}-${string}-${string}-${string}-${string}`)
    );

    // Remove file from disk (non-fatal if missing)
    if (doc.filePath) {
      try { await unlink(doc.filePath); } catch { /* file already gone */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/projects/:id/documents/:docId]', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, docId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }

  if (!hasRole(session.user.orgRole, 'engineer')) {
    return NextResponse.json({ error: 'Forbidden: engineer role or higher required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const doc = await getDocumentForProject(id, docId);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const [updated] = await db.update(documents)
      .set({ name: parsed.data.name.trim() })
      .where(eq(documents.id, docId as `${string}-${string}-${string}-${string}-${string}`))
      .returning();

    return NextResponse.json({ document: updated });
  } catch (err) {
    console.error('[PATCH /api/projects/:id/documents/:docId]', err);
    return NextResponse.json({ error: 'Failed to rename document' }, { status: 500 });
  }
}
