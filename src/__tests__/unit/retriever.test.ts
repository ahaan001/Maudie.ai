import { describe, it, expect, vi } from 'vitest';

// Mock DB pool before importing retriever
vi.mock('@/lib/db/client', () => {
  const mockRelease = vi.fn();
  const mockQuery = vi.fn();
  const mockConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
  return {
    pool: { connect: mockConnect },
    db: {},
    __mockQuery: mockQuery,
    __mockRelease: mockRelease,
    __mockConnect: mockConnect,
  };
});

vi.mock('@/lib/ollama/client', () => ({
  embed: vi.fn().mockResolvedValue(Array(768).fill(0.01)),
}));

import { retrieve, formatContextForPrompt, type RetrievedChunk } from '@/lib/rag/retriever';
import * as dbClient from '@/lib/db/client';

// Helper to get the mocked query function
function getMockQuery() {
  return (dbClient as unknown as { __mockQuery: ReturnType<typeof vi.fn> }).__mockQuery;
}

function makeRow(overrides: Partial<{
  id: string; document_id: string; project_id: string; content: string;
  token_count: number; metadata: object; document_name: string; source_type: string; similarity_score: number;
}> = {}) {
  return {
    id: overrides.id ?? 'chunk-1',
    document_id: overrides.document_id ?? 'doc-1',
    project_id: overrides.project_id ?? 'proj-1',
    content: overrides.content ?? 'some text',
    token_count: overrides.token_count ?? 100,
    metadata: overrides.metadata ?? {},
    document_name: overrides.document_name ?? 'Doc A',
    source_type: overrides.source_type ?? 'pdf',
    similarity_score: overrides.similarity_score ?? 0.9,
  };
}

describe('retrieve', () => {
  const opts = { query: 'test query', projectId: 'proj-1' };

  it('returns results in descending similarity order (highest first)', async () => {
    const rows = [
      makeRow({ id: 'c1', similarity_score: 0.95 }),
      makeRow({ id: 'c2', similarity_score: 0.80 }),
      makeRow({ id: 'c3', similarity_score: 0.75 }),
    ];
    getMockQuery().mockResolvedValue({ rows });

    const results = await retrieve(opts);

    expect(results[0].id).toBe('c1');
    expect(results[1].id).toBe('c2');
    expect(results[2].id).toBe('c3');
    expect(results[0].similarityScore).toBeGreaterThan(results[1].similarityScore);
  });

  it('limits to max 3 chunks per document (deduplication)', async () => {
    // 5 rows all from the same document
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeRow({ id: `c${i}`, document_id: 'same-doc', similarity_score: 0.9 - i * 0.01 })
    );
    getMockQuery().mockResolvedValue({ rows });

    const results = await retrieve(opts);

    const fromSameDoc = results.filter(r => r.documentId === 'same-doc');
    expect(fromSameDoc.length).toBeLessThanOrEqual(3);
  });

  it('maps row fields to the RetrievedChunk shape', async () => {
    const row = makeRow({ id: 'cX', content: 'hello', document_name: 'My Doc', similarity_score: 0.88 });
    getMockQuery().mockResolvedValue({ rows: [row] });

    const results = await retrieve(opts);

    expect(results[0].id).toBe('cX');
    expect(results[0].content).toBe('hello');
    expect(results[0].documentName).toBe('My Doc');
    expect(results[0].similarityScore).toBe(0.88);
  });

  it('releases the pool client even on success', async () => {
    getMockQuery().mockResolvedValue({ rows: [makeRow()] });
    const mockRelease = (dbClient as unknown as { __mockRelease: ReturnType<typeof vi.fn> }).__mockRelease;

    await retrieve(opts);

    expect(mockRelease).toHaveBeenCalled();
  });
});

describe('formatContextForPrompt', () => {
  const chunk: RetrievedChunk = {
    id: 'cA',
    documentId: 'doc-1',
    projectId: 'proj-1',
    content: 'The device is intended for...',
    tokenCount: 20,
    similarityScore: 0.92,
    metadata: {},
    documentName: 'IFU.pdf',
    sourceType: 'pdf',
  };

  it('includes the chunk id in the output', () => {
    const output = formatContextForPrompt([chunk]);
    expect(output).toContain('cA');
  });

  it('includes the document name', () => {
    const output = formatContextForPrompt([chunk]);
    expect(output).toContain('IFU.pdf');
  });

  it('includes the chunk content', () => {
    const output = formatContextForPrompt([chunk]);
    expect(output).toContain('The device is intended for...');
  });

  it('separates multiple chunks with a divider', () => {
    const output = formatContextForPrompt([chunk, { ...chunk, id: 'cB' }]);
    expect(output).toContain('---');
  });

  it('returns an empty string for an empty array', () => {
    expect(formatContextForPrompt([])).toBe('');
  });
});
