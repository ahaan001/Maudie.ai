import { db, pool } from '../db/client';
import { documents, chunks } from '../db/schema';
import { parseFile } from '../parsers/text';
import { chunkText } from './chunker';
import { embedChunks } from './embedder';
import { eq, sql } from 'drizzle-orm';

export interface IngestionResult {
  documentId: string;
  chunkCount: number;
  totalTokens: number;
  durationMs: number;
  error?: string;
}

export async function ingestDocument(documentId: string): Promise<IngestionResult> {
  const start = Date.now();

  // Mark as processing
  await db.update(documents)
    .set({ ingestionStatus: 'processing' })
    .where(eq(documents.id, documentId));

  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) throw new Error(`Document not found: ${documentId}`);
    if (!doc.filePath) throw new Error(`No file path for document: ${documentId}`);
    if (!doc.mimeType) throw new Error(`No mime type for document: ${documentId}`);

    // Parse
    const parsed = await parseFile(doc.filePath, doc.mimeType);

    if (!parsed.text || parsed.text.trim().length < 50) {
      throw new Error('Document appears to be empty or unreadable (possibly a scanned PDF without text layer)');
    }

    // Chunk
    const rawChunks = chunkText(parsed.text, {
      documentId,
      documentName: doc.name,
      sourceType: doc.sourceType,
      projectId: doc.projectId,
      pageCount: parsed.pageCount,
    });

    if (rawChunks.length === 0) {
      throw new Error('No chunks produced from document');
    }

    // Embed
    const embeddedChunks = await embedChunks(rawChunks, (i, total) => {
      console.log(`[ingestion] Embedding chunk ${i}/${total} for document ${documentId}`);
    });

    // Supersede old chunks if re-ingesting
    await db.update(chunks)
      .set({ superseded: true })
      .where(eq(chunks.documentId, documentId));

    // Store chunks with embedding as pgvector literal [x,y,...]
    const client = await pool.connect();
    let totalTokens = 0;
    try {
      await client.query('BEGIN');
      for (const chunk of embeddedChunks) {
        await client.query(`
          INSERT INTO chunks (document_id, project_id, content, embedding, token_count, chunk_index, metadata)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        `, [
          documentId,
          doc.projectId,
          chunk.content,
          JSON.stringify(chunk.embedding),
          chunk.tokenCount,
          chunk.chunkIndex,
          JSON.stringify(chunk.metadata),
        ]);
        totalTokens += chunk.tokenCount;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Mark complete
    await db.update(documents)
      .set({
        ingestionStatus: 'completed',
        ingestedAt: new Date(),
        ingestionError: null,
      })
      .where(eq(documents.id, documentId));

    return {
      documentId,
      chunkCount: embeddedChunks.length,
      totalTokens,
      durationMs: Date.now() - start,
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    await db.update(documents)
      .set({ ingestionStatus: 'failed', ingestionError: errMsg })
      .where(eq(documents.id, documentId));

    return {
      documentId,
      chunkCount: 0,
      totalTokens: 0,
      durationMs: Date.now() - start,
      error: errMsg,
    };
  }
}
