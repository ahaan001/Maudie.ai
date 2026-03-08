import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { failureClusters, hazards, riskInputs } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';
import { getCache, setCache } from '@/lib/cache';

type IntelligenceResponse = {
  clusters: (typeof failureClusters.$inferSelect)[];
  hazards: (typeof hazards.$inferSelect)[];
  riskInputs: (typeof riskInputs.$inferSelect)[];
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const cacheKey = `maude:${id}`;
  const cached = await getCache<IntelligenceResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const clusters = await db.select().from(failureClusters)
    .where(eq(failureClusters.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
    .orderBy(desc(failureClusters.createdAt));

  const projectHazards = await db.select().from(hazards)
    .where(eq(hazards.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
    .orderBy(desc(hazards.createdAt));

  const projectRiskInputs = await db.select().from(riskInputs)
    .where(eq(riskInputs.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
    .orderBy(desc(riskInputs.createdAt));

  const response: IntelligenceResponse = { clusters, hazards: projectHazards, riskInputs: projectRiskInputs };
  await setCache(cacheKey, response, 3600);

  return NextResponse.json(response);
}
