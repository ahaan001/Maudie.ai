import { pool } from '../db/client';
import { embed } from '../ollama/client';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  projectId: string;
  content: string;
  tokenCount: number;
  similarityScore: number;
  metadata: Record<string, unknown>;
  documentName?: string;
  sourceType?: string;
}

export interface RetrievalOptions {
  query: string;
  projectId: string;
  topK?: number;
  minSimilarity?: number;
  sourceTypeFilter?: string[];
  maxTokensTotal?: number;
}

export interface ContextPackage {
  chunks: RetrievedChunk[];
  totalTokens: number;
  queryUsed: string;
  retrievedAt: string;
}

export async function retrieve(options: RetrievalOptions): Promise<RetrievedChunk[]> {
  const {
    query,
    projectId,
    topK = 15,
    minSimilarity = 0.72,
    maxTokensTotal,
  } = options;

  const queryEmbedding = await embed(query);
  const queryVector = `[${queryEmbedding.join(',')}]`;

  // Over-fetch (topK * 3) because per-document deduplication below can
  // eliminate entries — we still want topK results after dedup.
  const params: unknown[] = [projectId, queryVector, minSimilarity, topK * 3];

  let sourceFilter = '';
  if (options.sourceTypeFilter && options.sourceTypeFilter.length > 0) {
    params.push(options.sourceTypeFilter);
    sourceFilter = `AND d.source_type = ANY($${params.length}::text[])`;
  }

  const queryText = `
    SELECT
      c.id,
      c.document_id,
      c.project_id,
      c.content,
      c.token_count,
      c.metadata,
      d.name AS document_name,
      d.source_type,
      1 - (c.embedding <=> $2::vector) AS similarity_score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.project_id = $1
      AND c.superseded = false
      AND c.embedding IS NOT NULL
      AND d.superseded = false
      AND d.ingestion_status = 'completed'
      AND 1 - (c.embedding <=> $2::vector) >= $3
      ${sourceFilter}
    ORDER BY similarity_score DESC
    LIMIT $4
  `;

  const client = await pool.connect();
  let rows: Record<string, unknown>[] = [];
  try {
    const result = await client.query(queryText, params);
    rows = result.rows;
  } finally {
    client.release();
  }

  let results: RetrievedChunk[] = rows.map(r => ({
    id: r.id as string,
    documentId: r.document_id as string,
    projectId: r.project_id as string,
    content: r.content as string,
    tokenCount: r.token_count as number,
    similarityScore: r.similarity_score as number,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    documentName: r.document_name as string | undefined,
    sourceType: r.source_type as string | undefined,
  }));

  // Deduplicate: max 3 chunks per document
  const docChunkCount: Record<string, number> = {};
  results = results.filter(chunk => {
    const count = docChunkCount[chunk.documentId] ?? 0;
    if (count >= 3) return false;
    docChunkCount[chunk.documentId] = count + 1;
    return true;
  }).slice(0, topK);

  // Apply token budget
  if (maxTokensTotal) {
    let totalTokens = 0;
    results = results.filter(chunk => {
      if (totalTokens + chunk.tokenCount <= maxTokensTotal) {
        totalTokens += chunk.tokenCount;
        return true;
      }
      return false;
    });
  }

  return results;
}

export function buildContextPackage(chunks: RetrievedChunk[], query: string): ContextPackage {
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  return {
    chunks,
    totalTokens,
    queryUsed: query,
    retrievedAt: new Date().toISOString(),
  };
}

export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map(c => `[CHUNK:${c.id}] (source: ${c.documentName ?? 'unknown'}, score: ${c.similarityScore.toFixed(3)})\n${c.content}`)
    .join('\n\n---\n\n');
}
