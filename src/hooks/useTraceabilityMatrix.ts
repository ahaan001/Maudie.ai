'use client';

import { useQuery } from '@tanstack/react-query';

export interface MatrixDocumentEntry {
  documentId: string;
  documentName: string;
  sourceType: string;
  citationCount: number;
}

export interface MatrixSectionRow {
  sectionType: string;
  sectionTitle: string;
  draftId: string;
  status: string;
  totalCitations: number;
  evidenceStrength: number;
  byDocument: MatrixDocumentEntry[];
  sourceTypeBreakdown: Record<string, number>;
}

export interface TraceabilityMatrixData {
  sections: MatrixSectionRow[];
  coverageGaps: string[];
  allDocuments: { documentId: string; documentName: string; sourceType: string }[];
}

export function useTraceabilityMatrix(projectId: string) {
  return useQuery<TraceabilityMatrixData>({
    queryKey: ['traceability-matrix', projectId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/traceability-matrix`).then(r => r.json()),
    staleTime: 30_000,
  });
}
