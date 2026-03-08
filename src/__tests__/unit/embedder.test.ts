import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Chunk } from '@/lib/rag/chunker';

// Mock the Ollama client before importing the embedder
vi.mock('@/lib/ollama/client', () => ({
  embed: vi.fn(),
}));

import { embedChunk, embedChunks } from '@/lib/rag/embedder';
import { embed } from '@/lib/ollama/client';

const mockEmbed = vi.mocked(embed);

const fakeChunk = (content = 'Test content for embedding'): Chunk => ({
  content,
  chunkIndex: 0,
  tokenCount: 5,
  metadata: {},
});

beforeEach(() => {
  mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe('embedChunk', () => {
  it('calls embed() with the chunk content', async () => {
    const chunk = fakeChunk('hello world');
    await embedChunk(chunk);
    expect(mockEmbed).toHaveBeenCalledOnce();
    expect(mockEmbed).toHaveBeenCalledWith('hello world');
  });

  it('returns an EmbeddedChunk with the embedding array', async () => {
    const chunk = fakeChunk();
    const result = await embedChunk(chunk);
    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('sets embeddingJson to the JSON-stringified embedding', async () => {
    const chunk = fakeChunk();
    const result = await embedChunk(chunk);
    expect(result.embeddingJson).toBe(JSON.stringify([0.1, 0.2, 0.3]));
  });

  it('preserves all original chunk fields', async () => {
    const chunk = fakeChunk('preserved');
    const result = await embedChunk(chunk);
    expect(result.content).toBe('preserved');
    expect(result.chunkIndex).toBe(0);
    expect(result.tokenCount).toBe(5);
  });
});

describe('embedChunks', () => {
  it('calls embed() once per chunk', async () => {
    const chunks = [fakeChunk('a'), fakeChunk('b'), fakeChunk('c')];
    await embedChunks(chunks);
    expect(mockEmbed).toHaveBeenCalledTimes(3);
  });

  it('returns an EmbeddedChunk for each input chunk', async () => {
    const chunks = [fakeChunk('x'), fakeChunk('y')];
    const results = await embedChunks(chunks);
    expect(results).toHaveLength(2);
    expect(results[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(results[1].embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('calls the onProgress callback once per chunk with correct args', async () => {
    const chunks = [fakeChunk('a'), fakeChunk('b'), fakeChunk('c')];
    const onProgress = vi.fn();
    await embedChunks(chunks, onProgress);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it('returns an empty array when given no chunks', async () => {
    const results = await embedChunks([]);
    expect(results).toEqual([]);
    expect(mockEmbed).not.toHaveBeenCalled();
  });
});
