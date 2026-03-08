import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { hazards, devices, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireProjectSession, hasRole } from '@/lib/auth/permissions';
import { generateStream } from '@/lib/ollama/client';
import { runRetrievalEvidenceAgent } from '@/lib/agents/retrieval-evidence';

const encoder = new TextEncoder();
function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; hazardId: string }> }
) {
  const { id, hazardId } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }
  if (!hasRole(session.user.orgRole, 'engineer')) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: engineer role or higher required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const pid = id as `${string}-${string}-${string}-${string}-${string}`;
  const hid = hazardId as `${string}-${string}-${string}-${string}-${string}`;

  // Fetch data before streaming
  const [hazard] = await db.select().from(hazards).where(eq(hazards.id, hid)).limit(1);
  if (!hazard) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Hazard not found' })}\n\n`,
      { status: 404, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
  const [device] = await db.select().from(devices).where(eq(devices.projectId, pid)).limit(1);

  const abortController = new AbortController();
  _req.signal.addEventListener('abort', () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      function enqueue(data: object) {
        try { controller.enqueue(sse(data)); } catch { /* client disconnected */ }
      }

      try {
        // Retrieve relevant document chunks
        const query = `risk control mitigation ${hazard.description} ${hazard.harm ?? ''} ${device?.category ?? ''}`;
        const { contextText } = await runRetrievalEvidenceAgent({
          query,
          projectId: id,
          topK: 5,
          minSimilarity: 0.65,
          maxTokens: 2000,
        });

        const systemPrompt = `You are an ISO 14971 risk management expert for medical devices. Suggest specific, actionable risk controls for the given hazard. For each control:
1. Specify the control type (design measure / protective measure / information for safety)
2. Describe the specific technical or procedural measure
3. Suggest a verification method
Format as a numbered list. Be concise and technically precise.`;

        const prompt = `Device: ${device?.name ?? project?.name ?? 'Medical device'} (Category: ${device?.category ?? project?.deviceCategory ?? 'unknown'})

Hazard: ${hazard.description}
Harm: ${hazard.harm ?? 'Not specified'}
Hazardous situation: ${hazard.hazardousSituation ?? 'Not specified'}
Initial severity: ${hazard.initialSeverity ?? 'Not assessed'}/5
Initial probability: ${hazard.initialProbability ?? 'Not assessed'}/5

${contextText ? `Relevant context from project documents:\n${contextText}\n\n` : ''}Suggest 3-5 ISO 14971 compliant risk controls to reduce this risk:`;

        await generateStream(
          { system: systemPrompt, prompt, temperature: 0.3, num_predict: 800 },
          (token) => enqueue({ type: 'chunk', content: token }),
          abortController.signal,
        );

        enqueue({ type: 'complete' });
      } catch (err) {
        if (!abortController.signal.aborted) {
          const message = err instanceof Error ? err.message : 'Suggestion failed';
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
