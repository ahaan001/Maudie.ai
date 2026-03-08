-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'engineer',
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  org_id UUID,
  device_category TEXT NOT NULL DEFAULT 'assistive_wearable',
  jurisdiction TEXT NOT NULL DEFAULT 'fda_us',
  regulatory_profile TEXT NOT NULL DEFAULT 'fda_assistive_wearable',
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  intended_use TEXT,
  device_class TEXT,
  predicate_device TEXT,
  manufacturer_name TEXT,
  model_number TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  file_path TEXT,
  file_hash TEXT,
  mime_type TEXT,
  file_size INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  ingestion_status TEXT NOT NULL DEFAULT 'pending',
  ingestion_error TEXT,
  ingested_at TIMESTAMPTZ,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_project_idx ON documents(project_id);

-- Chunks (embedding stored as JSONB array for app-level cosine similarity)
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding JSONB,
  token_count INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_project_idx ON chunks(project_id);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks(document_id);

-- Standards
CREATE TABLE IF NOT EXISTS standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  jurisdiction TEXT NOT NULL DEFAULT 'international',
  version TEXT,
  issued_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regulatory Events (MAUDE)
CREATE TABLE IF NOT EXISTS regulatory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mdr_report_key TEXT UNIQUE,
  device_name TEXT,
  brand_name TEXT,
  generic_name TEXT,
  event_type TEXT,
  event_date TIMESTAMPTZ,
  report_text TEXT,
  source TEXT NOT NULL DEFAULT 'maude',
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failure Clusters
CREATE TABLE IF NOT EXISTS failure_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  failure_mode TEXT NOT NULL,
  description TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  representative_events JSONB DEFAULT '[]',
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hazards
CREATE TABLE IF NOT EXISTS hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  harm TEXT,
  hazardous_situation TEXT,
  severity TEXT,
  probability TEXT,
  risk_level TEXT,
  source TEXT NOT NULL DEFAULT 'ai',
  ai_generated BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk Inputs
CREATE TABLE IF NOT EXISTS risk_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hazard_id UUID REFERENCES hazards(id),
  source_event_ids JSONB DEFAULT '[]',
  frequency_estimate TEXT,
  severity_estimate TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT TRUE,
  requires_review BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Drafts
CREATE TABLE IF NOT EXISTS generated_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  agent_run_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft Sections
CREATE TABLE IF NOT EXISTS draft_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES generated_drafts(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  confidence_score REAL,
  ai_generated BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Citations
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES generated_drafts(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES draft_sections(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES chunks(id),
  document_id UUID NOT NULL REFERENCES documents(id),
  page_number INTEGER,
  similarity_score REAL,
  text_excerpt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review Tasks
CREATE TABLE IF NOT EXISTS review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES generated_drafts(id) ON DELETE CASCADE,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  flags JSONB DEFAULT '[]',
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_task_id UUID NOT NULL REFERENCES review_tasks(id) ON DELETE CASCADE,
  approved_by UUID NOT NULL,
  action TEXT NOT NULL,
  comments TEXT,
  ai_content_hash TEXT,
  human_content_hash TEXT,
  diff JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Runs
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  job_id TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  input JSONB DEFAULT '{}',
  output JSONB,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  duration_ms INTEGER,
  model_used TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Audit Log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  content_hash TEXT,
  diff JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Traceability Links
CREATE TABLE IF NOT EXISTS traceability_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  link_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default standards
INSERT INTO standards (name, code, jurisdiction, version) VALUES
  ('Quality Management Systems for Medical Devices', 'ISO-13485', 'international', '2016'),
  ('Risk Management for Medical Devices', 'ISO-14971', 'international', '2019'),
  ('Software Life Cycle Processes', 'IEC-62304', 'international', '2006+AMD1:2015'),
  ('Application of Usability Engineering', 'IEC-62366-1', 'international', '2015'),
  ('General Safety and Performance', 'MDR-2017/745', 'eu', '2017'),
  ('Design Controls', '21-CFR-820', 'fda_us', 'current')
ON CONFLICT (code) DO NOTHING;
