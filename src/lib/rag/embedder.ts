import { embed } from '../ollama/client';
import type { Chunk } from './chunker';

export interface EmbeddedChunk extends Chunk {
  embedding: number[];
  embeddingJson: string;
}

export async function embedChunk(chunk: Chunk): Promise<EmbeddedChunk> {
  // Prepend metadata context to improve retrieval quality
  const textToEmbed = chunk.content;
  const embedding = await embed(textToEmbed);

  return {
    ...chunk,
    embedding,
    embeddingJson: JSON.stringify(embedding),
  };
}

export async function embedChunks(
  chunks: Chunk[],
  onProgress?: (i: number, total: number) => void
): Promise<EmbeddedChunk[]> {
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedded = await embedChunk(chunks[i]);
    results.push(embedded);
    onProgress?.(i + 1, chunks.length);
  }

  return results;
}
