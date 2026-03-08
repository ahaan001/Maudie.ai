CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"job_type" text NOT NULL,
	"job_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"duration_ms" integer,
	"model_used" text,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_task_id" uuid NOT NULL,
	"approved_by" uuid NOT NULL,
	"action" text NOT NULL,
	"comments" text,
	"ai_content_hash" text,
	"human_content_hash" text,
	"diff" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"content_hash" text,
	"diff" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb,
	"token_count" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"superseded" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer,
	"similarity_score" real,
	"text_excerpt" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"intended_use" text,
	"device_class" text,
	"predicate_device" text,
	"manufacturer_name" text,
	"model_number" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"file_path" text,
	"file_hash" text,
	"mime_type" text,
	"file_size" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"superseded" boolean DEFAULT false NOT NULL,
	"ingestion_status" text DEFAULT 'pending' NOT NULL,
	"ingestion_error" text,
	"ingested_at" timestamp,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "draft_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"section_type" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"confidence_score" real,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failure_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cluster_name" text NOT NULL,
	"failure_mode" text NOT NULL,
	"description" text,
	"event_count" integer DEFAULT 0 NOT NULL,
	"representative_events" jsonb DEFAULT '[]'::jsonb,
	"agent_run_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"section_type" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"agent_run_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hazards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"harm" text,
	"hazardous_situation" text,
	"severity" text,
	"probability" text,
	"risk_level" text,
	"source" text DEFAULT 'ai' NOT NULL,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"draft_id" uuid,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"org_id" uuid,
	"device_category" text DEFAULT 'assistive_wearable' NOT NULL,
	"jurisdiction" text DEFAULT 'fda_us' NOT NULL,
	"regulatory_profile" text DEFAULT 'fda_assistive_wearable' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regulatory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mdr_report_key" text,
	"device_name" text,
	"brand_name" text,
	"generic_name" text,
	"event_type" text,
	"event_date" timestamp,
	"report_text" text,
	"source" text DEFAULT 'maude' NOT NULL,
	"ingested_at" timestamp DEFAULT now(),
	CONSTRAINT "regulatory_events_mdr_report_key_unique" UNIQUE("mdr_report_key")
);
--> statement-breakpoint
CREATE TABLE "review_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"assigned_to" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"assigned_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "risk_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"hazard_id" uuid,
	"source_event_ids" jsonb DEFAULT '[]'::jsonb,
	"frequency_estimate" text,
	"severity_estimate" text,
	"ai_generated" boolean DEFAULT true NOT NULL,
	"requires_review" boolean DEFAULT true NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"agent_run_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"jurisdiction" text DEFAULT 'international' NOT NULL,
	"version" text,
	"issued_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "standards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "traceability_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"link_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'engineer' NOT NULL,
	"org_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "chunks_project_idx" ON "chunks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "req_project_idx" ON "project_requirements" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "req_project_section_unique" ON "project_requirements" USING btree ("project_id","section_key");