import { getEncoding } from 'js-tiktoken';

let enc: ReturnType<typeof getEncoding> | null = null;

function getEncoder() {
  if (!enc) {
    // cl100k_base is the closest publicly available tokenizer to Mistral's tokenizer
    enc = getEncoding('cl100k_base');
  }
  return enc;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return getEncoder().encode(text).length;
  } catch {
    // Fallback: rough character-based estimate (1 token ≈ 4 chars)
    return Math.ceil(text.length / 4);
  }
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const e = getEncoder();
  const tokens = e.encode(text);
  if (tokens.length <= maxTokens) return text;
  // Proportional character slice as a simple approximation
  const ratio = maxTokens / tokens.length;
  return text.slice(0, Math.floor(text.length * ratio));
}
