'use client';

import { useQuery } from '@tanstack/react-query';

export interface RedFlag {
  type: string;
  description: string;
  location: string;
  severity: 'warning' | 'error';
}

export interface ReviewTaskRecord {
  id: string;
  projectId: string;
  draftId: string;
  status: string;
  riskLevel: string;
  flags: RedFlag[];
  reviewNotes: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function useReviewTasks(projectId: string) {
  return useQuery<{ tasks: ReviewTaskRecord[] }>({
    queryKey: ['review-tasks', projectId],
    queryFn: () =>
      fetch(`/api/review/tasks?projectId=${projectId}&status=pending`).then(r => r.json()),
    staleTime: 10_000,
  });
}
