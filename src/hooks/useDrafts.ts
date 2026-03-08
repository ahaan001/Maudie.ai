'use client';

import { useQuery } from '@tanstack/react-query';

export interface DraftRecord {
  id: string;
  sectionType: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  reviewTask: {
    id: string;
    status: string;
    riskLevel: string;
  } | null;
}

export function useDrafts(projectId: string) {
  return useQuery<{ drafts: DraftRecord[] }>({
    queryKey: ['drafts', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/drafts`).then(r => r.json()),
    staleTime: 15_000,
  });
}
