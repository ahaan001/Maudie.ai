/**
 * Shared SSE event types for draft generation streaming.
 * Imported by both the server-side SSE route and the client-side context.
 * Must not import any server-only modules.
 */

export type SSEStage = 'retrieval' | 'generation' | 'writing' | 'review';

export type SSEEvent =
  | { type: 'stage'; stage: SSEStage; message: string }
  | { type: 'chunk'; content: string }
  | {
      type: 'complete';
      draftId: string;
      riskLevel: string;
      autoApproved: boolean;
      confidenceScore: number;
      citationCount: number;
    }
  | { type: 'error'; message: string };
