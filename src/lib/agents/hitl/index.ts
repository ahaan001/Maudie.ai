import { db } from '../../db/client';
import { reviewTasks, approvals, generatedDrafts } from '../../db/schema';
import { logAudit } from '../../audit/logger';
import { hashContent } from '../../utils/hash';
import { eq } from 'drizzle-orm';

// Sections that can NEVER be auto-approved
const BLOCK_AUTO_APPROVE: string[] = [
  'intended_use',
  'contraindications',
  'risk_benefit_conclusion',
  'substantial_equivalence',
  'safety_class_assignment',
];

export interface ApproveInput {
  reviewTaskId: string;
  approvedBy: string;
  action: 'approved' | 'rejected' | 'escalated';
  editedContent?: string;
  originalContent: string;
  comments?: string;
}

export interface ApprovalResult {
  approvalId: string;
  action: string;
  diff: Record<string, unknown>;
}

export async function processApproval(input: ApproveInput): Promise<ApprovalResult> {
  const aiContentHash = hashContent(input.originalContent);
  const finalContent = input.editedContent ?? input.originalContent;
  const humanContentHash = hashContent(finalContent);

  const diff = computeDiff(input.originalContent, finalContent);

  const [approval] = await db.insert(approvals).values({
    reviewTaskId: input.reviewTaskId as `${string}-${string}-${string}-${string}-${string}`,
    approvedBy: input.approvedBy as `${string}-${string}-${string}-${string}-${string}`,
    action: input.action,
    comments: input.comments ?? null,
    aiContentHash,
    humanContentHash,
    diff: diff as unknown as Record<string, unknown>,
  }).returning({ id: approvals.id });

  // Update review task status
  await db.update(reviewTasks).set({
    status: input.action === 'approved' ? 'approved' :
            input.action === 'rejected' ? 'rejected' : 'escalated',
    completedAt: new Date(),
  }).where(eq(reviewTasks.id, input.reviewTaskId as `${string}-${string}-${string}-${string}-${string}`));

  // Update draft status
  const [task] = await db.select().from(reviewTasks)
    .where(eq(reviewTasks.id, input.reviewTaskId as `${string}-${string}-${string}-${string}-${string}`))
    .limit(1);

  if (task) {
    await db.update(generatedDrafts).set({
      status: input.action === 'approved' ? 'approved' : input.action,
    }).where(eq(generatedDrafts.id, task.draftId));
  }

  // Audit log
  await logAudit({
    projectId: task?.projectId,
    entityType: 'approval',
    entityId: approval.id,
    action: input.action,
    actorType: 'human',
    actorId: input.approvedBy,
    contentHash: humanContentHash,
    diff,
    metadata: {
      reviewTaskId: input.reviewTaskId,
      aiContentHash,
      humanContentHash,
      hasEdit: input.editedContent != null && input.editedContent !== input.originalContent,
    },
  });

  return { approvalId: approval.id, action: input.action, diff };
}

export function canAutoApprove(sectionType: string, riskLevel: string, flagCount: number): boolean {
  if (BLOCK_AUTO_APPROVE.includes(sectionType)) return false;
  if (riskLevel === 'high') return false;
  if (flagCount > 0) return false;
  return true;
}

function computeDiff(original: string, edited: string): Record<string, unknown> {
  if (original === edited) return { changed: false, similarity: 1.0 };

  const origWords = original.split(/\s+/);
  const editWords = edited.split(/\s+/);
  const addedWords = editWords.length - origWords.length;
  const similarity = 1 - (Math.abs(addedWords) / Math.max(origWords.length, editWords.length));

  return {
    changed: true,
    originalLength: original.length,
    editedLength: edited.length,
    wordDelta: addedWords,
    similarity: Math.max(0, similarity).toFixed(3),
  };
}
