import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core';

// pgvector custom type — schema reflects post-migration state.
// Run src/scripts/migrate-pgvector.ts to ALTER the DB column.
const pgVector = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector(768)'; },
  fromDriver(v: string): number[] { return JSON.parse(v); },
  toDriver(v: number[]): string { return `[${v.join(',')}]`; },
});
import { sql, relations } from 'drizzle-orm';

// ─── Users & Auth ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('engineer'), // admin | engineer | reviewer
  orgId: uuid('org_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Organization Roles & Membership ─────────────────────────────────────────

export const orgRoles = ['owner', 'admin', 'engineer', 'reviewer', 'viewer'] as const;
export type OrgRole = typeof orgRoles[number];

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull().default('engineer'), // OrgRole
  invitedBy: uuid('invited_by'),
  joinedAt: timestamp('joined_at').defaultNow(),
}, (table) => ({
  orgMemberUnique: uniqueIndex('org_member_unique').on(table.orgId, table.userId),
  orgMemberOrgIdx: index('org_member_org_idx').on(table.orgId),
}));

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('engineer'), // OrgRole
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  invitationTokenIdx: uniqueIndex('invitation_token_idx').on(table.token),
}));

// ─── Projects & Devices ───────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  orgId: uuid('org_id'),
  deviceCategory: text('device_category').notNull().default('assistive_wearable'),
  jurisdiction: text('jurisdiction').notNull().default('fda_us'),
  regulatoryProfile: text('regulatory_profile').notNull().default('fda_assistive_wearable'),
  status: text('status').notNull().default('active'), // active | archived
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  intendedUse: text('intended_use'),
  deviceClass: text('device_class'), // I | II | III
  predicateDevice: text('predicate_device'),
  manufacturerName: text('manufacturer_name'),
  modelNumber: text('model_number'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Documents & RAG ──────────────────────────────────────────────────────────

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull(), // user_upload | maude | standard | internal | bom
  filePath: text('file_path'),
  fileHash: text('file_hash'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  version: integer('version').notNull().default(1),
  superseded: boolean('superseded').notNull().default(false),
  ingestionStatus: text('ingestion_status').notNull().default('pending'), // pending | processing | completed | failed
  ingestionError: text('ingestion_error'),
  ingestedAt: timestamp('ingested_at'),
  uploadedBy: uuid('uploaded_by'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdx: index('documents_project_idx').on(table.projectId),
}));

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid('document_id').notNull(),
  projectId: uuid('project_id').notNull(),
  content: text('content').notNull(),
  // pgvector vector(768) column — stores nomic-embed-text embeddings (768 dims)
  embedding: pgVector('embedding'),
  tokenCount: integer('token_count').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  superseded: boolean('superseded').notNull().default(false),
  metadata: jsonb('metadata').default({}), // page_number, section, heading, etc.
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  projectIdx: index('chunks_project_idx').on(table.projectId),
  documentIdx: index('chunks_document_idx').on(table.documentId),
}));

// ─── Standards ────────────────────────────────────────────────────────────────

export const standards = pgTable('standards', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  code: text('code').notNull().unique(), // e.g. ISO-14971, IEC-62304
  jurisdiction: text('jurisdiction').notNull().default('international'),
  version: text('version'),
  issuedDate: timestamp('issued_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Regulatory Events (MAUDE) ────────────────────────────────────────────────

export const regulatoryEvents = pgTable('regulatory_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mdrReportKey: text('mdr_report_key').unique(),
  deviceName: text('device_name'),
  brandName: text('brand_name'),
  genericName: text('generic_name'),
  eventType: text('event_type'), // malfunction | injury | death | other
  eventDate: timestamp('event_date'),
  reportText: text('report_text'),
  source: text('source').notNull().default('maude'),
  ingestedAt: timestamp('ingested_at').defaultNow(),
});

export const failureClusters = pgTable('failure_clusters', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  clusterName: text('cluster_name').notNull(),
  failureMode: text('failure_mode').notNull(),
  description: text('description'),
  eventCount: integer('event_count').notNull().default(0),
  representativeEvents: jsonb('representative_events').default([]),
  agentRunId: uuid('agent_run_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Risk Management ──────────────────────────────────────────────────────────

export const hazards = pgTable('hazards', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  description: text('description').notNull(),
  harm: text('harm'),
  hazardousSituation: text('hazardous_situation'),
  severity: text('severity'), // negligible | minor | serious | critical | catastrophic
  probability: text('probability'), // remote | unlikely | occasional | probable | frequent
  riskLevel: text('risk_level'), // low | medium | high | unacceptable
  source: text('source').notNull().default('ai'), // ai | human
  aiGenerated: boolean('ai_generated').notNull().default(true),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  // ISO 14971 Risk Management fields
  hazardCategory: text('hazard_category'), // mechanical|electrical|thermal|software|use_error|biological
  initialSeverity: integer('initial_severity'),       // 1-5
  initialProbability: integer('initial_probability'), // 1-5
  mitigationMeasures: text('mitigation_measures').array().default([]),
  residualSeverity: integer('residual_severity'),       // 1-5
  residualProbability: integer('residual_probability'), // 1-5
  acceptability: text('acceptability'), // acceptable|alarp|unacceptable
  riskStatus: text('risk_status').notNull().default('open'), // open|mitigated|accepted|transferred
});

export const riskControls = pgTable('risk_controls', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  hazardId: uuid('hazard_id').notNull(),
  projectId: uuid('project_id').notNull(),
  controlType: text('control_type').notNull(), // design|protective|information
  description: text('description').notNull(),
  verificationMethod: text('verification_method'),
  verificationStatus: text('verification_status').default('pending'), // pending|verified|failed
  linkedDocumentId: uuid('linked_document_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  riskControlHazardIdx: index('risk_control_hazard_idx').on(table.hazardId),
  riskControlProjectIdx: index('risk_control_project_idx').on(table.projectId),
}));

export const riskInputs = pgTable('risk_inputs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  hazardId: uuid('hazard_id'),
  sourceEventIds: jsonb('source_event_ids').default([]),
  frequencyEstimate: text('frequency_estimate'),
  severityEstimate: text('severity_estimate'),
  aiGenerated: boolean('ai_generated').notNull().default(true),
  requiresReview: boolean('requires_review').notNull().default(true),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  agentRunId: uuid('agent_run_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Documentation Artifacts ──────────────────────────────────────────────────

export const generatedDrafts = pgTable('generated_drafts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  sectionType: text('section_type').notNull(),
  title: text('title'),
  status: text('status').notNull().default('draft'), // draft | in_review | approved | rejected
  agentRunId: uuid('agent_run_id'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projectRequirements = pgTable('project_requirements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  sectionKey: text('section_key').notNull(),
  status: text('status').notNull().default('not_started'), // not_started | in_progress | approved
  draftId: uuid('draft_id'), // nullable FK to generatedDrafts
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  reqProjectIdx: index('req_project_idx').on(table.projectId),
  reqProjectSectionUnique: uniqueIndex('req_project_section_unique').on(table.projectId, table.sectionKey),
}));

export const draftSections = pgTable('draft_sections', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  draftId: uuid('draft_id').notNull(),
  sectionType: text('section_type').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull(),
  confidenceScore: real('confidence_score'),
  aiGenerated: boolean('ai_generated').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

export const citations = pgTable('citations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  draftId: uuid('draft_id').notNull(),
  sectionId: uuid('section_id').notNull(),
  chunkId: uuid('chunk_id').notNull(),
  documentId: uuid('document_id').notNull(),
  pageNumber: integer('page_number'),
  similarityScore: real('similarity_score'),
  textExcerpt: text('text_excerpt'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Review & Approval ────────────────────────────────────────────────────────

export const reviewTasks = pgTable('review_tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  draftId: uuid('draft_id').notNull(),
  assignedTo: uuid('assigned_to'),
  status: text('status').notNull().default('pending'), // pending | assigned | in_review | approved | rejected | escalated | auto_approved
  riskLevel: text('risk_level').notNull().default('medium'), // low | medium | high
  flags: jsonb('flags').default([]),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  assignedAt: timestamp('assigned_at'),
  completedAt: timestamp('completed_at'),
});

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  reviewTaskId: uuid('review_task_id').notNull(),
  approvedBy: uuid('approved_by').notNull(),
  action: text('action').notNull(), // approved | rejected | escalated | auto_approved
  comments: text('comments'),
  aiContentHash: text('ai_content_hash'),
  humanContentHash: text('human_content_hash'),
  diff: jsonb('diff').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Agent Operations ─────────────────────────────────────────────────────────

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull(),
  agentName: text('agent_name').notNull(),
  jobType: text('job_type').notNull(),
  jobId: text('job_id'), // pg-boss job ID
  status: text('status').notNull().default('running'), // running | completed | failed
  input: jsonb('input').default({}),
  output: jsonb('output'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  durationMs: integer('duration_ms'),
  modelUsed: text('model_used'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id'),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(), // created | ai_generated | reviewed | edited | approved | rejected | auto_approved
  actorType: text('actor_type').notNull(), // agent | human | system
  actorId: text('actor_id').notNull(), // agent name or user ID
  contentHash: text('content_hash'),
  diff: jsonb('diff').default({}),
  timestamp: timestamp('timestamp').defaultNow(),
  metadata: jsonb('metadata').default({}),
});

// ─── Traceability ─────────────────────────────────────────────────────────────

export const traceabilityLinks = pgTable('traceability_links', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text('source_type').notNull(),
  sourceId: uuid('source_id').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  linkType: text('link_type').notNull(), // derives_from | cites | validates | references
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type GeneratedDraft = typeof generatedDrafts.$inferSelect;
export type DraftSection = typeof draftSections.$inferSelect;
export type Citation = typeof citations.$inferSelect;
export type ReviewTask = typeof reviewTasks.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type RegulatoryEvent = typeof regulatoryEvents.$inferSelect;
export type Hazard = typeof hazards.$inferSelect;
export type RiskControl = typeof riskControls.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
