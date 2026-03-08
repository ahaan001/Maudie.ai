import { db } from '../db/client';
import { auditLog } from '../db/schema';

export interface AuditEntry {
  projectId?: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: 'agent' | 'human' | 'system';
  actorId: string;
  contentHash?: string;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    projectId: entry.projectId ?? null,
    entityType: entry.entityType,
    entityId: entry.entityId as `${string}-${string}-${string}-${string}-${string}`,
    action: entry.action,
    actorType: entry.actorType,
    actorId: entry.actorId,
    contentHash: entry.contentHash ?? null,
    diff: (entry.diff ?? {}) as Record<string, unknown>,
    metadata: (entry.metadata ?? {}) as Record<string, unknown>,
  });
}
