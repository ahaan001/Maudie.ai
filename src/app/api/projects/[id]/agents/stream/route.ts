import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { devices, projects, projectRequirements } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { runDocumentationDraftingAgent } from '@/lib/agents/documentation-drafting';
import { runPostDraftOrchestration } from '@/lib/agents/orchestrator';
import { logAudit } from '@/lib/audit/logger';
import type { SectionType } from '@/lib/agents/types';
import type { SSEEvent } from '@/lib/agents/streaming-types';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';

const StreamSchema = z.object({
  sectionType: z.string(),
});

const encoder = new TextEncoder();

function encodeSSE(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pid = id as `${string}-${string}-${string}-${string}-${string}`;

  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'engineer')) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: engineer role or higher required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body before opening the stream
  let sectionType: SectionType;
  try {
    const body = await req.json();
    const parsed = StreamSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', message: 'Invalid request: sectionType required' })}\n\n`,
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }
    sectionType = parsed.data.sectionType as SectionType;
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Invalid JSON body' })}\n\n`,
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  // Fetch project + device before streaming (fail fast)
  const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
  if (!project) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Project not found' })}\n\n`,
      { status: 404, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const [device] = await db.select().from(devices).where(eq(devices.projectId, pid)).limit(1);
  if (!device) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'No device configured for this project' })}\n\n`,
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const abortController = new AbortController();

  // Wire client disconnect → abort Ollama call
  req.signal.addEventListener('abort', () => {
    abortController.abort();
  });

  const stream = new ReadableStream({
    async start(controller) {
      function enqueue(event: SSEEvent) {
        try {
          controller.enqueue(encodeSSE(event));
        } catch {
          // Controller already closed (client disconnected)
        }
      }

      try {
        // Emit retrieval stage before work starts so the UI shows immediate feedback
        enqueue({ type: 'stage', stage: 'retrieval', message: 'Retrieving evidence from knowledge base...' });

        const draftResult = await runDocumentationDraftingAgent({
          projectId: id,
          sectionType,
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
          onToken: (token) => {
            enqueue({ type: 'chunk', content: token });
          },
          onStage: (stage, message) => {
            enqueue({ type: 'stage', stage: stage as import('@/lib/agents/streaming-types').SSEStage, message });
          },
          abortSignal: abortController.signal,
        });

        // Sync requirement → in_progress
        await db.update(projectRequirements)
          .set({
            status: 'in_progress',
            draftId: draftResult.draftId as `${string}-${string}-${string}-${string}-${string}`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(projectRequirements.projectId, pid),
            eq(projectRequirements.sectionKey, sectionType),
          ));

        enqueue({ type: 'stage', stage: 'review', message: 'Running red-flag analysis...' });

        const postResult = await runPostDraftOrchestration(id, draftResult, sectionType);

        await logAudit({
          projectId: id,
          entityType: 'orchestration',
          entityId: draftResult.draftId as `${string}-${string}-${string}-${string}-${string}`,
          action: postResult.autoApproved ? 'auto_approved' : 'routed_to_review',
          actorType: 'system',
          actorId: 'StreamOrchestrator',
          contentHash: postResult.sectionContentHash,
          metadata: {
            taskId: postResult.taskId,
            riskLevel: postResult.riskLevel,
            flagCount: postResult.flagCount,
            confidenceScore: draftResult.confidenceScore,
            autoApproved: postResult.autoApproved,
          },
        });

        enqueue({
          type: 'complete',
          draftId: draftResult.draftId,
          riskLevel: postResult.riskLevel,
          autoApproved: postResult.autoApproved,
          confidenceScore: draftResult.confidenceScore,
          citationCount: draftResult.citationCount,
        });

      } catch (err) {
        if (!abortController.signal.aborted) {
          const message = err instanceof Error ? err.message : 'Generation failed';
          enqueue({ type: 'error', message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
