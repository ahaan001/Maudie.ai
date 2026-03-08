import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { devices, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueJob, QUEUES } from '@/lib/queue/boss';
import { z } from 'zod';
import type { SectionType } from '@/lib/agents/types';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

const RunAgentSchema = z.discriminatedUnion('agent', [
  z.object({
    agent: z.literal('documentation_drafting'),
    params: z.object({
      sectionType: z.string(),
    }),
  }),
  z.object({
    agent: z.literal('regulatory_intelligence'),
    params: z.object({
      keywords: z.array(z.string()).optional(),
    }),
  }),
]);

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
    const body = await req.json();
    const parsed = RunAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const [device] = await db.select().from(devices).where(eq(devices.projectId, id as `${string}-${string}-${string}-${string}-${string}`)).limit(1);

    let jobId: string | null = null;

    if (parsed.data.agent === 'documentation_drafting') {
      if (!device) return NextResponse.json({ error: 'No device configured for this project' }, { status: 400 });

      jobId = await enqueueJob(QUEUES.DRAFT_SECTION, {
        projectId: id,
        sectionType: parsed.data.params.sectionType as SectionType,
        deviceMetadata: {
          name: device.name,
          category: device.category,
          intendedUse: device.intendedUse ?? undefined,
          deviceClass: device.deviceClass ?? undefined,
          predicateDevice: device.predicateDevice ?? undefined,
          manufacturerName: device.manufacturerName ?? undefined,
          modelNumber: device.modelNumber ?? undefined,
        },
        regulatoryProfile: project.regulatoryProfile,
        triggeredBy: session.user.userId,
      });
    } else if (parsed.data.agent === 'regulatory_intelligence') {
      const defaultKeywords = ['exoskeleton', 'orthosis', 'prosthetic', 'wearable robot', 'assistive robot'];
      jobId = await enqueueJob(QUEUES.ANALYZE_MAUDE, {
        projectId: id,
        deviceCategory: project.deviceCategory,
        keywords: parsed.data.params.keywords ?? defaultKeywords,
      });
    }

    return NextResponse.json({ jobId, status: 'queued' });
  } catch (err) {
    console.error('[POST /api/projects/:id/agents/run]', err);
    return NextResponse.json({ error: 'Failed to run agent' }, { status: 500 });
  }
}
