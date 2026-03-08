import { NextRequest } from 'next/server';
import { requireProjectSession } from '@/lib/auth/permissions';
import { subscribeJobComplete } from '@/lib/cache';

const encoder = new TextEncoder();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const stream = new ReadableStream({
    start(controller) {
      const unsub = subscribeJobComplete(id, payload => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { /* client disconnected */ }
      });

      req.signal.addEventListener('abort', () => {
        unsub();
        try { controller.close(); } catch { /* already closed */ }
      });
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
