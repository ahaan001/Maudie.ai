-- Migration: add organization_members, invitations, risk_controls tables
-- and new columns on hazards that were added after the initial migration.
-- Run this against your database if you set up from 0000_init.sql.

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'engineer',
  invited_by UUID,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT org_member_unique UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_member_org_idx ON organization_members(org_id);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'engineer',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS invitation_token_idx ON invitations(token);

-- Risk Controls
CREATE TABLE IF NOT EXISTS risk_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID NOT NULL REFERENCES hazards(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  control_type TEXT NOT NULL,
  description TEXT NOT NULL,
  verification_method TEXT,
  verification_status TEXT DEFAULT 'pending',
  linked_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_control_hazard_idx ON risk_controls(hazard_id);
CREATE INDEX IF NOT EXISTS risk_control_project_idx ON risk_controls(project_id);

-- New columns on hazards (ISO 14971 fields) — safe to run multiple times
ALTER TABLE hazards
  ADD COLUMN IF NOT EXISTS hazard_category TEXT,
  ADD COLUMN IF NOT EXISTS initial_severity INTEGER,
  ADD COLUMN IF NOT EXISTS initial_probability INTEGER,
  ADD COLUMN IF NOT EXISTS mitigation_measures TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS residual_severity INTEGER,
  ADD COLUMN IF NOT EXISTS residual_probability INTEGER,
  ADD COLUMN IF NOT EXISTS acceptability TEXT,
  ADD COLUMN IF NOT EXISTS risk_status TEXT NOT NULL DEFAULT 'open';
