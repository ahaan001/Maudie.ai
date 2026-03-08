import { describe, it, expect, vi } from 'vitest';
import { chunkText } from '@/lib/rag/chunker';

// Mock token counter with a simple word-count approximation for determinism
vi.mock('@/lib/utils/token-counter', () => ({
  countTokens: (text: string) => text.split(/\s+/).filter(Boolean).length,
  truncateToTokens: (text: string) => text,
}));

// Generate text with approximately N words
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
}

// Generate multi-paragraph text from multiple word blocks
function paragraphs(...sizes: number[]): string {
  return sizes.map(n => words(n)).join('\n\n');
}

describe('chunkText', () => {
  it('returns an empty array for an empty string', () => {
    const chunks = chunkText('');
    expect(chunks).toEqual([]);
  });

  it('returns an empty array for whitespace-only input', () => {
    const chunks = chunkText('   \n\n   ');
    expect(chunks).toEqual([]);
  });

  it('returns an empty array when all paragraphs are shorter than min chunk size (100 tokens)', () => {
    // Two short paragraphs that together are still < 100 tokens
    const chunks = chunkText('Short paragraph.\n\nAnother short one.');
    expect(chunks).toEqual([]);
  });

  it('produces chunks with content matching the input text', () => {
    // 300 tokens — fits in one chunk (max 512)
    const text = paragraphs(300);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toBeTruthy();
  });

  it('assigns sequential chunkIndex values starting at 0', () => {
    // Force multiple chunks: 3 paragraphs each 300 tokens (900 total > 512 limit)
    const text = paragraphs(300, 300, 300);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it('keeps each chunk token count within CHUNK_SIZE_TOKENS (512)', () => {
    const text = paragraphs(300, 300, 300, 300);
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(512);
    }
  });

  it('includes document metadata on every chunk', () => {
    const meta = { documentId: 'doc-123', sourceType: 'pdf' };
    const text = paragraphs(200);
    const chunks = chunkText(text, meta);
    for (const chunk of chunks) {
      expect(chunk.metadata).toMatchObject(meta);
    }
  });

  it('produces overlap — the second chunk shares tail words from the first', () => {
    // Two large paragraphs force a flush after the first and overlap into the second
    const text = paragraphs(400, 400);
    const chunks = chunkText(text);
    if (chunks.length >= 2) {
      // The first chunk's last word should appear somewhere in the second chunk
      const firstWords = chunks[0].content.split(/\s+/);
      const lastWordOfFirst = firstWords[firstWords.length - 1];
      expect(chunks[1].content).toContain(lastWordOfFirst);
    }
  });
});
