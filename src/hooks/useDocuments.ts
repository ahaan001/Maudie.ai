'use client';

import { useQuery } from '@tanstack/react-query';

export interface DocumentRecord {
  id: string;
  name: string;
  sourceType: string;
  mimeType: string | null;
  fileSize: number | null;
  ingestionStatus: string;
  ingestionError: string | null;
  createdAt: string;
}

export function useDocuments(projectId: string) {
  return useQuery<{ documents: DocumentRecord[] }>({
    queryKey: ['documents', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/documents`).then(r => r.json()),
    staleTime: 30_000,
  });
}
