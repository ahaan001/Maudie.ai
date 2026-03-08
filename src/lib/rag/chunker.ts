import { countTokens } from '../utils/token-counter';

export interface Chunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 50;
const MIN_CHUNK_TOKENS = 100;

export function chunkText(text: string, documentMeta: Record<string, unknown> = {}): Chunk[] {
  // Normalize whitespace but preserve paragraph breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const paragraphs = normalized.split(/\n\n+/).filter(p => p.trim().length > 20);

  const chunks: Chunk[] = [];
  let buffer = '';
  let chunkIndex = 0;

  function flushBuffer(overlapFrom?: string) {
    const trimmed = buffer.trim();
    const tokens = countTokens(trimmed);
    if (tokens >= MIN_CHUNK_TOKENS) {
      chunks.push({
        content: trimmed,
        chunkIndex: chunkIndex++,
        tokenCount: tokens,
        metadata: { ...documentMeta },
      });
    }
    // Set overlap: take last ~CHUNK_OVERLAP_TOKENS tokens worth of text
    if (overlapFrom) {
      const words = overlapFrom.trim().split(/\s+/);
      // Estimate overlap words (1 token ≈ 0.75 words)
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP_TOKENS * 0.75));
      buffer = overlapWords.join(' ');
    } else {
      buffer = '';
    }
  }

  for (const paragraph of paragraphs) {
    const combined = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    const tokens = countTokens(combined);

    if (tokens >= CHUNK_SIZE_TOKENS) {
      if (buffer) {
        flushBuffer(buffer);
        buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      } else {
        // Single large paragraph: split by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?\n]+/g) ?? [paragraph];
        for (const sentence of sentences) {
          const next = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim();
          if (countTokens(next) >= CHUNK_SIZE_TOKENS) {
            if (buffer) flushBuffer(buffer);
            buffer = sentence.trim();
          } else {
            buffer = next;
          }
        }
      }
    } else {
      buffer = combined;
    }
  }

  // Flush remaining
  if (buffer && countTokens(buffer.trim()) >= MIN_CHUNK_TOKENS) {
    const trimmed = buffer.trim();
    chunks.push({
      content: trimmed,
      chunkIndex: chunkIndex++,
      tokenCount: countTokens(trimmed),
      metadata: { ...documentMeta },
    });
  }

  return chunks;
}
