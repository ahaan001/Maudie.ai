'use client';

import { useQuery } from '@tanstack/react-query';
import type { RequirementWithMeta } from '@/lib/section-metadata';

interface RequirementsData {
  requirements: RequirementWithMeta[];
  grouped: Record<string, RequirementWithMeta[]>;
}

export function useRequirements(projectId: string) {
  return useQuery<RequirementsData>({
    queryKey: ['requirements', projectId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/requirements`).then(r => {
        if (!r.ok) throw new Error('Failed to fetch requirements');
        return r.json();
      }),
    staleTime: 15_000,
    enabled: !!projectId,
  });
}
