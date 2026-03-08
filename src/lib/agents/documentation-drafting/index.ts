import { generate, generateStream } from '../../ollama/client';
import { runRetrievalEvidenceAgent } from '../retrieval-evidence';
import { db } from '../../db/client';
import { generatedDrafts, draftSections, citations, agentRuns } from '../../db/schema';
import { hashContent } from '../../utils/hash';
import { logAudit } from '../../audit/logger';
import { DRAFTING_SYSTEM_PROMPT, buildDraftingPrompt } from './prompts';
import { MANDATORY_REVIEW_SECTIONS, type SectionType, type DeviceMetadata } from '../types';
import { eq, sql } from 'drizzle-orm';

const TOKEN_BUDGET = {
  outputMax: 2000,
} as const;

export interface DraftJobInput {
  projectId: string;
  sectionType: SectionType;
  deviceMetadata: DeviceMetadata;
  regulatoryProfile: string;
  triggeredBy: string;
  // Optional streaming callbacks — only used when calling from the SSE route (not pg-boss workers)
  onToken?: (token: string) => void;
  onStage?: (stage: string, message: string) => void;
  abortSignal?: AbortSignal;
}

export interface DraftResult {
  draftId: string;
  sectionId: string;
  confidenceScore: number;
  citationCount: number;
  requiresReview: boolean;
}

export async function runDocumentationDraftingAgent(input: DraftJobInput): Promise<DraftResult> {
  const runStart = Date.now();

  const [run] = await db.insert(agentRuns).values({
    projectId: input.projectId,
    agentName: 'DocumentationDraftingAgent',
    jobType: 'draft_section',
    status: 'running',
    input: input as unknown as Record<string, unknown>,
    modelUsed: process.env.OLLAMA_MODEL ?? 'mistral:7b-instruct',
  }).returning({ id: agentRuns.id });

  try {
    // Step 1: Retrieve relevant context
    input.onStage?.('retrieval', 'Retrieving evidence from knowledge base...');
    const query = `${input.sectionType.replace(/_/g, ' ')} ${input.deviceMetadata.name} ${input.deviceMetadata.intendedUse ?? ''}`;

    const { contextText, chunks } = await runRetrievalEvidenceAgent({
      query,
      projectId: input.projectId,
      topK: 15,
      minSimilarity: 0.70,
      maxTokens: 4000,
    });

    // Step 2: Build prompt and generate
    const prompt = buildDraftingPrompt({
      sectionType: input.sectionType,
      deviceMetadata: input.deviceMetadata,
      context: contextText || 'No relevant documents found in knowledge base. Note all claims as [UNSUPPORTED].',
      regulatoryProfile: input.regulatoryProfile,
    });

    const generateOptions = {
      system: DRAFTING_SYSTEM_PROMPT,
      prompt,
      format: 'json' as const,
      temperature: 0.15,
      num_predict: TOKEN_BUDGET.outputMax,
    };

    let llmResult;
    if (input.onToken) {
      input.onStage?.('generation', 'Generating draft content...');
      llmResult = await generateStream(generateOptions, input.onToken, input.abortSignal);
    } else {
      llmResult = await generate(generateOptions);
    }
    const { response, inputTokens, outputTokens, durationMs } = llmResult;

    // Step 3: Parse response
    let parsed: {
      content: string;
      confidence_score: number;
      citations: string[];
      unsupported_claims?: string[];
      section_summary?: string;
    };

    try {
      // Clean response in case Ollama wraps in code blocks
      const cleaned = response.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: treat raw response as content, low confidence
      parsed = {
        content: response,
        confidence_score: 0.4,
        citations: [],
        unsupported_claims: ['JSON parse failed — content unverified'],
      };
    }

    const content = parsed.content ?? response;
    const contentHash = hashContent(content);
    const confidenceScore = Math.min(1, Math.max(0, parsed.confidence_score ?? 0.5));

    // Step 4: Save draft and citations
    input.onStage?.('writing', 'Saving draft to database...');
    // Create draft record
    const [draft] = await db.insert(generatedDrafts).values({
      projectId: input.projectId,
      sectionType: input.sectionType,
      title: input.sectionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      status: 'draft',
      agentRunId: run.id,
      createdBy: input.triggeredBy as `${string}-${string}-${string}-${string}-${string}` | undefined,
    }).returning({ id: generatedDrafts.id });

    const [section] = await db.insert(draftSections).values({
      draftId: draft.id,
      sectionType: input.sectionType,
      content,
      contentHash,
      confidenceScore,
      aiGenerated: true,
    }).returning({ id: draftSections.id });

    // Step 5: Store citations (chunks that were actually cited in the content)
    const citedChunkIds = new Set(parsed.citations ?? []);
    let citationCount = 0;

    for (const chunk of chunks) {
      const isCited = citedChunkIds.has(chunk.id) || content.includes(chunk.id);
      if (isCited) {
        await db.insert(citations).values({
          draftId: draft.id,
          sectionId: section.id,
          chunkId: chunk.id as `${string}-${string}-${string}-${string}-${string}`,
          documentId: chunk.documentId as `${string}-${string}-${string}-${string}-${string}`,
          similarityScore: chunk.similarityScore,
          textExcerpt: chunk.content.slice(0, 200),
        });
        citationCount++;
      }
    }

    // Step 6: Update agent run
    await db.update(agentRuns).set({
      status: 'completed',
      output: { draftId: draft.id, sectionId: section.id, confidenceScore, citationCount } as Record<string, unknown>,
      inputTokens,
      outputTokens,
      durationMs,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, run.id));

    // Step 7: Audit
    await logAudit({
      projectId: input.projectId,
      entityType: 'draft_section',
      entityId: section.id,
      action: 'ai_generated',
      actorType: 'agent',
      actorId: 'DocumentationDraftingAgent',
      contentHash,
      metadata: { agentRunId: run.id, sectionType: input.sectionType, inputTokens, outputTokens, confidenceScore },
    });

    const requiresReview = MANDATORY_REVIEW_SECTIONS.includes(input.sectionType) ||
      confidenceScore < 0.6 ||
      citationCount < 2;

    return { draftId: draft.id, sectionId: section.id, confidenceScore, citationCount, requiresReview };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await db.update(agentRuns).set({
      status: 'failed',
      error: errMsg,
      durationMs: Date.now() - runStart,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, run.id));
    throw error;
  }
}
