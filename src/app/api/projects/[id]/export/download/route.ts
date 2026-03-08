import { NextRequest, NextResponse } from 'next/server';
import { requireProjectSession } from '@/lib/auth/permissions';
import { getTempFile } from '@/lib/export/temp-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const file = getTempFile(token);
  if (!file) {
    return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
  }

  const contentType = file.filename.endsWith('.pdf') ? 'application/pdf' : 'application/zip';
  const arrayBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    },
  });
}
