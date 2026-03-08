import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { auditLog } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '100');
  const format = searchParams.get('format');
  const actionFilter = searchParams.get('action');

  const pid = id as `${string}-${string}-${string}-${string}-${string}`;
  const whereClause = actionFilter
    ? and(eq(auditLog.projectId, pid), eq(auditLog.action, actionFilter))
    : eq(auditLog.projectId, pid);

  const entries = await db.select().from(auditLog)
    .where(whereClause)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);

  if (format === 'csv') {
    const csv = [
      'id,entity_type,entity_id,action,actor_type,actor_id,timestamp',
      ...entries.map(e => `${e.id},${e.entityType},${e.entityId},${e.action},${e.actorType},${e.actorId},${e.timestamp}`),
    ].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit_${id}.csv"`,
      },
    });
  }

  return NextResponse.json({ entries, count: entries.length });
}
