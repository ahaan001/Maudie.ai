import { pool } from '../lib/db/client';

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE hazards
        ADD COLUMN IF NOT EXISTS hazard_category TEXT,
        ADD COLUMN IF NOT EXISTS initial_severity INTEGER,
        ADD COLUMN IF NOT EXISTS initial_probability INTEGER,
        ADD COLUMN IF NOT EXISTS mitigation_measures TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS residual_severity INTEGER,
        ADD COLUMN IF NOT EXISTS residual_probability INTEGER,
        ADD COLUMN IF NOT EXISTS acceptability TEXT,
        ADD COLUMN IF NOT EXISTS risk_status TEXT NOT NULL DEFAULT 'open';

      CREATE TABLE IF NOT EXISTS risk_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hazard_id UUID NOT NULL,
        project_id UUID NOT NULL,
        control_type TEXT NOT NULL,
        description TEXT NOT NULL,
        verification_method TEXT,
        verification_status TEXT DEFAULT 'pending',
        linked_document_id UUID,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS risk_control_hazard_idx ON risk_controls (hazard_id);
      CREATE INDEX IF NOT EXISTS risk_control_project_idx ON risk_controls (project_id);
    `);
    console.log('Risk migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
