'use client';

import { useQuery } from '@tanstack/react-query';

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: string;
  actorId: string;
  contentHash: string | null;
  diff: Record<string, unknown>;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export function useAuditLog(projectId: string, options?: { actionFilter?: string }) {
  const qs = options?.actionFilter ? `?action=${encodeURIComponent(options.actionFilter)}` : '';
  return useQuery<{ entries: AuditEntry[]; count: number }>({
    queryKey: ['audit-log', projectId, options?.actionFilter ?? null],
    queryFn: () => fetch(`/api/projects/${projectId}/audit${qs}`).then(r => r.json()),
    staleTime: 30_000,
  });
}
