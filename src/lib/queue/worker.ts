/**
 * Job queue worker — registers handlers for all queues.
 * Auto-started via src/instrumentation.ts on server boot.
 *
 * pg-boss WorkHandler receives Job<T>[] (array of jobs).
 * Process all jobs in the batch sequentially.
 */
import { getBoss, QUEUES } from './boss';
import { ingestDocument } from '../rag/ingestion';
import { runDocumentationDraftingAgent } from '../agents/documentation-drafting';
import { runRegulatoryIntelligenceAgent } from '../agents/regulatory-intelligence';
import { runReviewRedFlagAgent } from '../agents/review-redflag';
import type { SectionType, DeviceMetadata } from '../agents/types';
import type { Job } from 'pg-boss';

let started = false;

export async function startWorkers() {
  if (started) return;
  started = true;

  const boss = await getBoss();
  // Queue registration (with retry/timeout options) is handled in getBoss() → registerJobQueues()

  // ── Ingestion worker ──────────────────────────────────────────────────────
  await boss.work<{ documentId: string }>(QUEUES.INGEST_DOCUMENT, async (jobs: Job<{ documentId: string }>[]) => {
    for (const job of jobs) {
      const { documentId } = job.data;
      console.log(`[worker] Ingesting document: ${documentId}`);
      const result = await ingestDocument(documentId);
      if (result.error) throw new Error(result.error);
      console.log(`[worker] Ingested ${result.chunkCount} chunks from ${documentId}`);
    }
  });

  // ── Drafting worker ───────────────────────────────────────────────────────
  type DraftJobData = {
    projectId: string;
    sectionType: SectionType;
    deviceMetadata: DeviceMetadata;
    regulatoryProfile: string;
    triggeredBy: string;
  };

  await boss.work<DraftJobData>(QUEUES.DRAFT_SECTION, async (jobs: Job<DraftJobData>[]) => {
    for (const job of jobs) {
      console.log(`[worker] Drafting section: ${job.data.sectionType} for project: ${job.data.projectId}`);
      const result = await runDocumentationDraftingAgent(job.data);
      try {
        const { publishJobComplete } = await import('../cache');
        await publishJobComplete(job.data.projectId, {
          jobType: 'draft_generation',
          draftId: result.draftId,
          sectionType: job.data.sectionType,
        });
      } catch { /* Redis unavailable — non-fatal */ }
    }
  });

  // ── MAUDE analysis worker ─────────────────────────────────────────────────
  type MaudeJobData = { projectId: string; deviceCategory: string; keywords: string[] };

  await boss.work<MaudeJobData>(QUEUES.ANALYZE_MAUDE, async (jobs: Job<MaudeJobData>[]) => {
    for (const job of jobs) {
      console.log(`[worker] Analyzing MAUDE for project: ${job.data.projectId}`);
      await runRegulatoryIntelligenceAgent(job.data);
      try {
        const { publishJobComplete, invalidateCache } = await import('../cache');
        await invalidateCache(`maude:${job.data.projectId}`);
        await publishJobComplete(job.data.projectId, { jobType: 'intelligence_analysis' });
      } catch { /* Redis unavailable — non-fatal */ }
    }
  });

  // ── Review worker ─────────────────────────────────────────────────────────
  type ReviewJobData = {
    draftId: string;
    sectionId: string;
    projectId: string;
    content: string;
    sectionType: string;
    citationChunkIds: string[];
    allProjectChunkIds: string[];
  };

  await boss.work<ReviewJobData>(QUEUES.REVIEW_DRAFT, async (jobs: Job<ReviewJobData>[]) => {
    for (const job of jobs) {
      console.log(`[worker] Reviewing draft: ${job.data.draftId}`);
      await runReviewRedFlagAgent({
        draftId: job.data.draftId,
        sectionId: job.data.sectionId,
        projectId: job.data.projectId,
        content: job.data.content,
        sectionType: job.data.sectionType,
        citationIds: job.data.citationChunkIds,
        actualChunkIds: job.data.allProjectChunkIds,
      });
    }
  });

  console.log('[worker] All workers registered');
}
