import { PgBoss } from 'pg-boss';
import type { SendOptions } from 'pg-boss';

// Job queue names
export const QUEUES = {
  INGEST_DOCUMENT: 'ingest_document',
  DRAFT_SECTION: 'draft_section',
  ANALYZE_MAUDE: 'analyze_maude',
  REVIEW_DRAFT: 'review_draft',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

let boss: PgBoss | null = null;

async function registerJobQueues(b: PgBoss): Promise<void> {
  await b.createQueue(QUEUES.INGEST_DOCUMENT, { retryLimit: 5, expireInSeconds: 600 });
  await b.createQueue(QUEUES.DRAFT_SECTION,   { retryLimit: 3, expireInSeconds: 1800 });
  await b.createQueue(QUEUES.ANALYZE_MAUDE,   { retryLimit: 3, expireInSeconds: 3600 });
  await b.createQueue(QUEUES.REVIEW_DRAFT,    { retryLimit: 2, expireInSeconds: 300 });
}

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL!);

    boss.on('error', (err: Error) => {
      console.error('[pg-boss] Error:', err);
    });

    await boss.start();
    await registerJobQueues(boss);
    console.log('[pg-boss] Started');
  }
  return boss;
}

export async function enqueueJob<T extends object>(
  queue: string,
  data: T,
  options?: SendOptions
): Promise<string | null> {
  const b = await getBoss();
  return b.send(queue, data, options ?? {});
}
