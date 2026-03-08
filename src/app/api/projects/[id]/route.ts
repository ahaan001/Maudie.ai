import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { projects, devices, documents, agentRuns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    try { await requireProjectSession(id); } catch (res) { return res as Response; }

    const [project] = await db.select().from(projects).where(eq(projects.id, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [device] = await db.select().from(devices).where(eq(devices.projectId, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);
    const docList = await db.select().from(documents).where(eq(documents.projectId, id as `${string}-${string}-${string}-${string}-${string}`));
    const recentRuns = await db.select().from(agentRuns)
      .where(eq(agentRuns.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
      .orderBy(desc(agentRuns.createdAt))
      .limit(5);

    return NextResponse.json({ project, device, documents: docList, recentAgentRuns: recentRuns });
  } catch (err) {
    console.error('[GET /api/projects/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}
