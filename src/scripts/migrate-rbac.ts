import { pool } from '../lib/db/client';

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'engineer',
        invited_by UUID,
        joined_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT org_member_unique UNIQUE (org_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS org_member_org_idx ON organization_members (org_id);

      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'engineer',
        token TEXT NOT NULL UNIQUE,
        invited_by UUID NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS invitation_token_idx ON invitations (token);
    `);
    console.log('RBAC migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
