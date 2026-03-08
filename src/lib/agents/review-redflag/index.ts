import { generate } from '../../ollama/client';
import { db } from '../../db/client';
import { reviewTasks, agentRuns, generatedDrafts } from '../../db/schema';
import { logAudit } from '../../audit/logger';
import { MANDATORY_REVIEW_SECTIONS, type SectionType, type FlagType, type RedFlag, type RiskLevel } from '../types';
import { eq } from 'drizzle-orm';

const REVIEW_SYSTEM_PROMPT = `You are a regulatory documentation quality reviewer for FDA medical device submissions.
Review the provided draft section and identify quality, safety, and regulatory issues.

Output valid JSON with EXACTLY this schema:
{
  "flags": [
    {"type": "FLAG_TYPE", "description": "specific description", "location": "section or phrase", "severity": "warning|error"}
  ],
  "risk_level": "low|medium|high",
  "requires_human_review": true|false,
  "overall_quality_score": 0.0,
  "summary": "1-2 sentence assessment"
}

Flag types:
- UNSUPPORTED_CLAIM: Factual claim without citation [CITE:...] backing
- MISSING_CITATION: Citation referenced but chunk ID not resolvable
- AMBIGUOUS_STATEMENT: Unclear, vague, or potentially misleading language
- OUTDATED_REFERENCE: Reference to potentially outdated standards or guidance
- REGULATORY_RISK_WORDING: Language that could create regulatory liability (absolute safety claims, unapproved indications)
- INCOMPLETE_SECTION: Section lacks required elements for this document type

Risk level:
- low: No errors, only minor warnings, well-cited
- medium: Some warnings or 1-2 errors but recoverable
- high: Multiple errors, REGULATORY_RISK_WORDING, or zero citations`;

export interface ReviewJobInput {
  draftId: string;
  sectionId: string;
  projectId: string;
  content: string;
  sectionType: string;
  citationIds: string[];
  actualChunkIds: string[];
}

export interface ReviewResult {
  taskId: string;
  flags: RedFlag[];
  riskLevel: RiskLevel;
  requiresHumanReview: boolean;
  qualityScore: number;
}

export async function runReviewRedFlagAgent(input: ReviewJobInput): Promise<ReviewResult> {
  const runStart = Date.now();

  const [run] = await db.insert(agentRuns).values({
    projectId: input.projectId,
    agentName: 'ReviewRedFlagAgent',
    jobType: 'review_draft',
    status: 'running',
    input: { draftId: input.draftId, sectionType: input.sectionType } as Record<string, unknown>,
    modelUsed: process.env.OLLAMA_MODEL ?? 'mistral:7b-instruct',
  }).returning({ id: agentRuns.id });

  try {
    // Check citation validity mechanically
    const actualChunkSet = new Set(input.actualChunkIds);
    const unresolvable = input.citationIds.filter(id => !actualChunkSet.has(id));

    const prompt = `Review this "${input.sectionType.replace(/_/g, ' ')}" draft section:

CONTENT:
${input.content.slice(0, 2500)}

CITED CHUNK IDs: ${input.citationIds.join(', ') || 'none'}
UNRESOLVABLE CITATION IDs: ${unresolvable.join(', ') || 'none'}

Identify all issues and output JSON as specified.`;

    const { response, inputTokens, outputTokens } = await generate({
      system: REVIEW_SYSTEM_PROMPT,
      prompt,
      format: 'json',
      temperature: 0.1,
      num_predict: 1200,
    });

    let result: {
      flags: RedFlag[];
      risk_level: RiskLevel;
      requires_human_review: boolean;
      overall_quality_score: number;
      summary?: string;
    };

    try {
      const cleaned = response.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      result = {
        flags: [],
        risk_level: 'medium',
        requires_human_review: true,
        overall_quality_score: 0.5,
      };
    }

    // Add mechanical citation flags
    if (unresolvable.length > 0) {
      result.flags.push({
        type: 'MISSING_CITATION',
        description: `${unresolvable.length} citation(s) reference chunk IDs not in knowledge base: ${unresolvable.slice(0, 3).join(', ')}`,
        location: 'citations',
        severity: 'error',
      });
      result.risk_level = 'high';
      result.requires_human_review = true;
    }

    // Mandatory review sections override
    if (MANDATORY_REVIEW_SECTIONS.includes(input.sectionType as SectionType)) {
      result.requires_human_review = true;
      if (result.risk_level === 'low') result.risk_level = 'medium';
    }

    // REGULATORY_RISK_WORDING always escalates
    const hasRegulatoryRisk = result.flags.some(f => f.type === 'REGULATORY_RISK_WORDING');
    if (hasRegulatoryRisk) {
      result.risk_level = 'high';
      result.requires_human_review = true;
    }

    // Create review task
    const [task] = await db.insert(reviewTasks).values({
      projectId: input.projectId,
      draftId: input.draftId as `${string}-${string}-${string}-${string}-${string}`,
      status: result.requires_human_review ? 'pending' : 'auto_approved',
      riskLevel: result.risk_level,
      flags: result.flags as unknown as Record<string, unknown>[],
    }).returning({ id: reviewTasks.id });

    // Update draft status
    const draftStatus = result.requires_human_review ? 'in_review' : 'approved';
    await db.update(generatedDrafts).set({ status: draftStatus })
      .where(eq(generatedDrafts.id, input.draftId as `${string}-${string}-${string}-${string}-${string}`));

    await db.update(agentRuns).set({
      status: 'completed',
      output: { taskId: task.id, riskLevel: result.risk_level, flagCount: result.flags.length } as Record<string, unknown>,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - runStart,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, run.id));

    await logAudit({
      projectId: input.projectId,
      entityType: 'review_task',
      entityId: task.id,
      action: 'created',
      actorType: 'agent',
      actorId: 'ReviewRedFlagAgent',
      metadata: { draftId: input.draftId, flagCount: result.flags.length, riskLevel: result.risk_level, qualityScore: result.overall_quality_score },
    });

    return {
      taskId: task.id,
      flags: result.flags,
      riskLevel: result.risk_level,
      requiresHumanReview: result.requires_human_review,
      qualityScore: result.overall_quality_score ?? 0.5,
    };

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
