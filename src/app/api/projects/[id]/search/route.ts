import { NextRequest, NextResponse } from 'next/server';
import { retrieve } from '@/lib/rag/retriever';
import { z } from 'zod';
import { requireProjectSession } from '@/lib/auth/permissions';

const SearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().min(1).max(30).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.72),
  sourceTypeFilter: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  try {
    const body = await req.json();
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const chunks = await retrieve({
      query: parsed.data.query,
      projectId: id,
      topK: parsed.data.topK,
      minSimilarity: parsed.data.minSimilarity,
      sourceTypeFilter: parsed.data.sourceTypeFilter,
    });

    return NextResponse.json({ chunks, count: chunks.length });
  } catch (err) {
    console.error('[POST /api/projects/:id/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
