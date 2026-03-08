import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { hashFile } from '@/lib/utils/hash';
import { enqueueJob, QUEUES } from '@/lib/queue/boss';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB ?? '50') * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const docs = await db.select().from(documents)
    .where(eq(documents.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
    .orderBy(desc(documents.createdAt));
  return NextResponse.json({ documents: docs });
}

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
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sourceType = (formData.get('sourceType') as string) ?? 'user_upload';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large' }, { status: 413 });

    const mimeType = file.type || 'text/plain';
    if (!MIME_TYPES[mimeType] && !mimeType.startsWith('text/')) {
      return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashFile(buffer);

    // Save file to disk
    const projectDir = join(UPLOAD_DIR, id);
    await mkdir(projectDir, { recursive: true });
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = join(projectDir, fileName);
    await writeFile(filePath, buffer);

    // Create document record
    const [doc] = await db.insert(documents).values({
      projectId: id as `${string}-${string}-${string}-${string}-${string}`,
      name: file.name,
      sourceType,
      filePath,
      fileHash,
      mimeType,
      fileSize: file.size,
      ingestionStatus: 'pending',
    }).returning();

    // Enqueue ingestion job
    const jobId = await enqueueJob(QUEUES.INGEST_DOCUMENT, { documentId: doc.id });
    console.log(`[upload] Enqueued ingestion job ${jobId} for document ${doc.id}`);

    return NextResponse.json({ document: doc, jobId }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/projects/:id/documents]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
