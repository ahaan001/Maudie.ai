'use client';

import { useQuery } from '@tanstack/react-query';

interface ComplianceScore {
  score: number;
  approvedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  totalRequired: number;
}

export function useComplianceScore(projectId: string) {
  return useQuery<ComplianceScore>({
    queryKey: ['compliance-score', projectId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/compliance-score`).then(r => {
        if (!r.ok) throw new Error('Failed to fetch compliance score');
        return r.json();
      }),
    staleTime: 30_000,
    enabled: !!projectId,
  });
}
