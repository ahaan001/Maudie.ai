/**
 * Agent orchestrator — ties drafting → review → HITL routing together.
 * Called by API routes or job workers.
 */
import { runDocumentationDraftingAgent, type DraftJobInput, type DraftResult } from './documentation-drafting';
import { runReviewRedFlagAgent } from './review-redflag';
import { canAutoApprove, processApproval } from './hitl';
import { db, pool } from '../db/client';
import { draftSections, citations, projectRequirements } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logAudit } from '../audit/logger';
import type { SectionType } from './types';

export interface OrchestrateDraftResult {
  draftId: string;
  sectionId: string;
  taskId: string;
  riskLevel: string;
  requiresHumanReview: boolean;
  confidenceScore: number;
  autoApproved: boolean;
}

type PostDraftResult = Pick<OrchestrateDraftResult, 'taskId' | 'riskLevel' | 'requiresHumanReview' | 'autoApproved'> & {
  sectionContent: string;
  sectionContentHash: string | undefined;
  flagCount: number;
};

/**
 * Runs the review + auto-approval portion of the pipeline after a draft has been generated.
 * Extracted so the SSE streaming route can call drafting inline (with token callbacks)
 * and then hand off to this function for the review stage.
 */
export async function runPostDraftOrchestration(
  projectId: string,
  draftResult: DraftResult,
  sectionType: SectionType,
): Promise<PostDraftResult> {
  const { draftId, sectionId } = draftResult;

  // Fetch generated content and citations for review
  const [section] = await db.select().from(draftSections)
    .where(eq(draftSections.id, sectionId as `${string}-${string}-${string}-${string}-${string}`))
    .limit(1);

  const sectionCitations = await db.select().from(citations)
    .where(eq(citations.sectionId, sectionId as `${string}-${string}-${string}-${string}-${string}`));

  // Get all valid chunk IDs for this project (for citation verification)
  const client = await pool.connect();
  let projectChunkIds: string[] = [];
  try {
    const res = await client.query(
      `SELECT id FROM chunks WHERE project_id = $1 AND superseded = false`,
      [projectId]
    );
    projectChunkIds = res.rows.map((r: { id: string }) => r.id);
  } finally {
    client.release();
  }

  // Red-flag review
  const { taskId, flags, riskLevel, requiresHumanReview } = await runReviewRedFlagAgent({
    draftId,
    sectionId,
    projectId,
    content: section?.content ?? '',
    sectionType,
    citationIds: sectionCitations.map(c => c.chunkId),
    actualChunkIds: projectChunkIds,
  });

  // Auto-approve if safe
  let autoApproved = false;
  if (canAutoApprove(sectionType, riskLevel, flags.length)) {
    await processApproval({
      reviewTaskId: taskId,
      approvedBy: 'system',
      action: 'approved',
      originalContent: section?.content ?? '',
      comments: 'Auto-approved: low risk, no flags, well-cited',
    });
    autoApproved = true;

    // Sync requirement status → approved
    await db.update(projectRequirements)
      .set({ status: 'approved', draftId: draftId as `${string}-${string}-${string}-${string}-${string}`, updatedAt: new Date() })
      .where(and(
        eq(projectRequirements.projectId, projectId as `${string}-${string}-${string}-${string}-${string}`),
        eq(projectRequirements.sectionKey, sectionType),
      ));
  }

  return {
    taskId,
    riskLevel,
    requiresHumanReview: !autoApproved && requiresHumanReview,
    autoApproved,
    sectionContent: section?.content ?? '',
    sectionContentHash: section?.contentHash,
    flagCount: flags.length,
  };
}

export async function orchestrateDraftGeneration(input: DraftJobInput): Promise<OrchestrateDraftResult> {
  // Step 1: Generate draft
  const draftResult = await runDocumentationDraftingAgent(input);
  const { draftId, sectionId, confidenceScore } = draftResult;

  // Sync requirement status → in_progress
  await db.update(projectRequirements)
    .set({ status: 'in_progress', draftId: draftId as `${string}-${string}-${string}-${string}-${string}`, updatedAt: new Date() })
    .where(and(
      eq(projectRequirements.projectId, input.projectId as `${string}-${string}-${string}-${string}-${string}`),
      eq(projectRequirements.sectionKey, input.sectionType),
    ));

  // Steps 2–4: Review + auto-approve
  const postResult = await runPostDraftOrchestration(input.projectId, draftResult, input.sectionType);

  await logAudit({
    projectId: input.projectId,
    entityType: 'orchestration',
    entityId: draftId as `${string}-${string}-${string}-${string}-${string}`,
    action: postResult.autoApproved ? 'auto_approved' : 'routed_to_review',
    actorType: 'system',
    actorId: 'Orchestrator',
    contentHash: postResult.sectionContentHash,
    metadata: { taskId: postResult.taskId, riskLevel: postResult.riskLevel, flagCount: postResult.flagCount, confidenceScore, autoApproved: postResult.autoApproved },
  });

  return {
    draftId,
    sectionId,
    taskId: postResult.taskId,
    riskLevel: postResult.riskLevel,
    requiresHumanReview: postResult.requiresHumanReview,
    confidenceScore,
    autoApproved: postResult.autoApproved,
  };
}
