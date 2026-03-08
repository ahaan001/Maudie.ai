'use client';

import { useQuery } from '@tanstack/react-query';

export interface ProjectSummary {
  project: {
    id: string;
    name: string;
    description: string | null;
    deviceCategory: string;
    jurisdiction: string;
    regulatoryProfile: string;
    status: string;
    createdAt: string;
  };
  device: {
    id: string;
    name: string;
    category: string;
    deviceClass: string | null;
    intendedUse: string | null;
  } | null;
  documentCount: number;
  clusterCount: number;
  drafts: Array<{
    id: string;
    sectionType: string;
    status: string;
    createdAt: string;
  }>;
  pendingReviewCount: number;
  lastIntelligenceRun: {
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  } | null;
}

export function useProjectSummary(projectId: string, initialData?: ProjectSummary) {
  return useQuery<ProjectSummary>({
    queryKey: ['project-summary', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/summary`).then(r => r.json()),
    staleTime: 60_000,
    initialData,
  });
}
