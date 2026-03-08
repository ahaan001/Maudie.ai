'use client';

import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { extractDisplayContent } from '@/lib/ollama/streaming';
import type { SSEEvent, SSEStage } from '@/lib/agents/streaming-types';

export type GenerationStage = SSEStage | 'complete' | 'error';

export interface GenerationResult {
  draftId: string;
  riskLevel: string;
  autoApproved: boolean;
  confidenceScore: number;
  citationCount: number;
}

export interface GenerationState {
  projectId: string;
  sectionKey: string;
  sectionTitle: string;
  stage: GenerationStage;
  rawBuffer: string;
  displayContent: string;
  result: GenerationResult | null;
  error: string | null;
  isActive: boolean;
}

interface DraftGenerationContextValue {
  generation: GenerationState | null;
  startGeneration: (projectId: string, sectionKey: string, sectionTitle: string) => void;
  cancelGeneration: () => void;
  dismissModal: () => void;
}

const DraftGenerationContext = createContext<DraftGenerationContextValue | null>(null);

export function DraftGenerationProvider({ children }: { children: React.ReactNode }) {
  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback(
    (projectId: string, sectionKey: string, sectionTitle: string) => {
      // Cancel any in-flight generation
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setGeneration({
        projectId,
        sectionKey,
        sectionTitle,
        stage: 'retrieval',
        rawBuffer: '',
        displayContent: '',
        result: null,
        error: null,
        isActive: true,
      });

      // Run the SSE consumer asynchronously
      void (async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/agents/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionType: sectionKey }),
            signal: controller.signal,
          });

          if (!res.body) throw new Error('No response body from stream endpoint');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let lineBuffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            lineBuffer += decoder.decode(value, { stream: true });

            // SSE messages are delimited by double newlines
            const messages = lineBuffer.split('\n\n');
            lineBuffer = messages.pop() ?? '';

            for (const message of messages) {
              const dataLine = message.replace(/^data: /, '').trim();
              if (!dataLine) continue;

              let event: SSEEvent;
              try {
                event = JSON.parse(dataLine) as SSEEvent;
              } catch {
                continue;
              }

              if (event.type === 'stage') {
                setGeneration(prev =>
                  prev ? { ...prev, stage: event.stage as GenerationStage } : prev
                );
              } else if (event.type === 'chunk') {
                setGeneration(prev => {
                  if (!prev) return prev;
                  const newBuffer = prev.rawBuffer + event.content;
                  return {
                    ...prev,
                    rawBuffer: newBuffer,
                    displayContent: extractDisplayContent(newBuffer),
                    stage: 'generation' as GenerationStage,
                  };
                });
              } else if (event.type === 'complete') {
                setGeneration(prev =>
                  prev
                    ? {
                        ...prev,
                        stage: 'complete' as GenerationStage,
                        isActive: false,
                        result: {
                          draftId: event.draftId,
                          riskLevel: event.riskLevel,
                          autoApproved: event.autoApproved,
                          confidenceScore: event.confidenceScore,
                          citationCount: event.citationCount,
                        },
                      }
                    : prev
                );
              } else if (event.type === 'error') {
                setGeneration(prev =>
                  prev
                    ? { ...prev, stage: 'error' as GenerationStage, error: event.message, isActive: false }
                    : prev
                );
              }
            }
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return; // User cancelled — silent
          setGeneration(prev =>
            prev
              ? { ...prev, stage: 'error' as GenerationStage, error: (err as Error).message, isActive: false }
              : prev
          );
        }
      })();
    },
    []
  );

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    setGeneration(prev =>
      prev ? { ...prev, stage: 'error' as GenerationStage, error: 'Cancelled by user', isActive: false } : null
    );
  }, []);

  const dismissModal = useCallback(() => {
    setGeneration(null);
  }, []);

  return (
    <DraftGenerationContext.Provider value={{ generation, startGeneration, cancelGeneration, dismissModal }}>
      {children}
    </DraftGenerationContext.Provider>
  );
}

export function useDraftGenerationContext() {
  const ctx = useContext(DraftGenerationContext);
  if (!ctx) throw new Error('useDraftGenerationContext must be used inside DraftGenerationProvider');
  return ctx;
}
