'use client';

import { useQuery } from '@tanstack/react-query';

export interface DraftSection {
  id: string;
  sectionType: string;
  content: string;
  contentHash: string;
  confidenceScore: number | null;
  aiGenerated: boolean;
  version: number;
}

export interface EnrichedCitation {
  id: string;
  sectionId: string;
  chunkId: string;
  documentId: string;
  pageNumber: number | null;
  similarityScore: number | null;
  textExcerpt: string | null;
  documentName: string | null;
  sourceType: string | null;
  chunkContent: string | null;
  chunkIndex: number | null;
  chunkMetadata: { page_number?: number; section?: string; heading?: string } | null;
}

export interface DraftContent {
  draft: {
    id: string;
    sectionType: string;
    title: string | null;
    status: string;
  };
  sections: DraftSection[];
  citations: EnrichedCitation[];
}

export function useDraftContent(draftId: string | null) {
  return useQuery<DraftContent>({
    queryKey: ['draft-content', draftId],
    queryFn: () => fetch(`/api/drafts/${draftId}`).then(r => r.json()),
    enabled: !!draftId,
    staleTime: Infinity,
  });
}
