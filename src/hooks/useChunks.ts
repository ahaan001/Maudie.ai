'use client';

import { useQuery } from '@tanstack/react-query';

export interface ChunkPreview {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export function useChunks(projectId: string, docId: string, enabled: boolean) {
  return useQuery<{ chunks: ChunkPreview[] }>({
    queryKey: ['chunks', docId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/documents/${docId}/chunks`).then(r => r.json()),
    enabled,
    staleTime: Infinity,
  });
}
