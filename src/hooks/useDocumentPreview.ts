'use client';

import { useQuery } from '@tanstack/react-query';

export interface PreviewChunk {
  id: string;
  chunkIndex: number;
  content: string;
  metadata: { page_number?: number; section?: string; heading?: string } | null;
  isCited: boolean;
}

export interface DocumentPreviewData {
  document: {
    id: string;
    name: string;
    sourceType: string;
    mimeType: string | null;
    ingestionStatus: string;
  };
  chunks: PreviewChunk[];
}

export function useDocumentPreview(
  projectId: string,
  docId: string | null,
  chunkId: string | null,
) {
  return useQuery<DocumentPreviewData>({
    queryKey: ['document-preview', docId, chunkId],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/documents/${docId}/preview?chunkId=${chunkId}`)
        .then(r => r.json()),
    enabled: !!docId && !!chunkId,
    staleTime: Infinity,
  });
}
