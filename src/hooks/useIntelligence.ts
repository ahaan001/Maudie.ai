'use client';

import { useQuery } from '@tanstack/react-query';

export interface FailureCluster {
  id: string;
  clusterName: string;
  failureMode: string;
  description: string | null;
  eventCount: number;
  representativeEvents: unknown[];
  createdAt: string;
}

export interface HazardRecord {
  id: string;
  description: string;
  harm: string | null;
  riskLevel: string | null;
  severity: string | null;
  probability: string | null;
}

export interface IntelligenceData {
  clusters: FailureCluster[];
  hazards: HazardRecord[];
  riskInputs: unknown[];
}

export function useIntelligence(projectId: string, isRunning: boolean) {
  return useQuery<IntelligenceData>({
    queryKey: ['intelligence', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/intelligence`).then(r => r.json()),
    refetchInterval: isRunning ? 5_000 : false,
    staleTime: 15_000,
  });
}
