/**
 * One-time migration: enable pgvector extension, convert chunks.embedding
 * from JSONB to vector(768), and create an HNSW index for fast ANN search.
 *
 * Run with: npx tsx src/scripts/migrate-pgvector.ts
 *
 * Rollback (before running):
 *   ALTER TABLE chunks ADD COLUMN embedding_backup jsonb;
 *   UPDATE chunks SET embedding_backup = embedding::text::jsonb;
 *
 * The JSONB format [x,y,...] and pgvector format [x,y,...] use the same
 * bracket notation so the USING cast works directly.
 */
import { pool } from '../lib/db/client';

async function main() {
  const client = await pool.connect();
  try {
    console.log('[migrate-pgvector] Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    console.log('[migrate-pgvector] Altering chunks.embedding column from JSONB to vector(768)...');
    await client.query(`
      ALTER TABLE chunks
        ALTER COLUMN embedding
        TYPE vector(768)
        USING embedding::text::vector;
    `);

    console.log('[migrate-pgvector] Creating HNSW index (this may take a moment on large tables)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
        ON chunks
        USING hnsw (embedding vector_cosine_ops);
    `);

    console.log('[migrate-pgvector] Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[migrate-pgvector] Migration failed:', err);
  process.exit(1);
});
