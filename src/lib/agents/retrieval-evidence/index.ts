import { retrieve, buildContextPackage, formatContextForPrompt, type RetrievedChunk, type ContextPackage } from '../../rag/retriever';
import { summarize } from '../../ollama/client';
import { countTokens } from '../../utils/token-counter';

const MAX_CONTEXT_TOKENS = 4000;

export interface RetrievalJob {
  query: string;
  projectId: string;
  topK?: number;
  minSimilarity?: number;
  sourceTypeFilter?: string[];
  maxTokens?: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  contextText: string;
  contextPackage: ContextPackage;
  wasCompressed: boolean;
}

export async function runRetrievalEvidenceAgent(job: RetrievalJob): Promise<RetrievalResult> {
  const maxTokens = job.maxTokens ?? MAX_CONTEXT_TOKENS;

  const chunks = await retrieve({
    query: job.query,
    projectId: job.projectId,
    topK: job.topK ?? 15,
    minSimilarity: job.minSimilarity ?? 0.72,
    sourceTypeFilter: job.sourceTypeFilter,
  });

  const contextPackage = buildContextPackage(chunks, job.query);
  let contextText = formatContextForPrompt(chunks);
  let wasCompressed = false;

  if (countTokens(contextText) > maxTokens) {
    contextText = await summarize(contextText, maxTokens);
    wasCompressed = true;
  }

  return { chunks, contextText, contextPackage, wasCompressed };
}
