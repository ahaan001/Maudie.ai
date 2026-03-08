# maudie.ai

AI-powered engineering intelligence platform for medical robotics regulatory compliance. maudie.ai assists engineering teams in generating, reviewing, and managing FDA regulatory documentation with full audit traceability.

---

## Table of Contents

- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Start Services](#start-services)
  - [Install Dependencies & Run](#install-dependencies--run)
  - [Database Migration](#database-migration)
- [Features](#features)
  - [Projects](#projects)
  - [Document Ingestion](#document-ingestion)
  - [Regulatory Intelligence](#regulatory-intelligence)
  - [Documentation Drafts](#documentation-drafts)
  - [Review Queue (HITL)](#review-queue-hitl)
  - [ISO 14971 Risk Management](#iso-14971-risk-management)
  - [Compliance Score & Requirements](#compliance-score--requirements)
  - [Traceability Matrix](#traceability-matrix)
  - [Export](#export)
  - [Audit Trail](#audit-trail)
  - [Team & Organization Management](#team--organization-management)
  - [Analytics Dashboard](#analytics-dashboard)
- [Architecture](#architecture)
  - [Full Stack](#full-stack)
  - [Multi-Agent System](#multi-agent-system)
  - [RAG Pipeline](#rag-pipeline)
  - [Database Schema](#database-schema)
  - [API Routes](#api-routes)
- [Development](#development)
  - [Testing](#testing)

---

## Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm (or pnpm / bun)

### Environment Variables

Create a `.env` file in the project root:

```env
# PostgreSQL (matches docker-compose defaults)
DATABASE_URL=postgresql://compliance_user:compliance_pass@localhost:5432/compliance_db

# NextAuth — generate with: openssl rand -base64 32
AUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Optional: Redis for caching (defaults to in-memory if unset)
REDIS_URL=redis://localhost:6379

# Optional: file upload size limit in MB (default 50)
MAX_FILE_SIZE_MB=50
```

### Start Services

Spin up PostgreSQL 16 + pgvector and Ollama via Docker:

```bash
docker compose up -d
```

Pull the Mistral 7B model into Ollama (one-time, ~4 GB):

```bash
docker exec compliance_ollama ollama pull mistral
```

Verify services are running:

```bash
docker compose ps
```

### Install Dependencies & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

> **GPU acceleration (optional):** Uncomment the `deploy.resources` block in `docker-compose.yml` if you have an NVIDIA GPU. Without a GPU, Ollama runs on CPU — inference will be slower.

### Database Migration

Run the schema migration against the running PostgreSQL container:

```bash
npm run db:migrate
```

This executes `src/lib/db/migrations/0000_init.sql` which creates all tables. Run once after the database container is up.

---

## Features

### Projects

**Routes:** `/projects`, `/projects/new`, `/projects/[id]`

The projects listing page (`/projects`) shows all compliance projects — name, description, device category, jurisdiction, and creation date. Each card links to that project's unified detail view.

Creating a project (`/projects/new`) requires:
- **Project name and description** — identifies the submission
- **Device category** — Assistive / Wearable Robotics, Surgical, Rehabilitation, Diagnostic
- **Jurisdiction** — FDA/US or CE/EU
- **Device information** — device name, intended use, FDA device class (I/II/III), model number, and manufacturer name

On submission, a `projects` row, a linked `devices` row, and a full set of `project_requirements` rows (seeded from the regulatory profile) are created. The regulatory profile determines which documentation sections are required for that jurisdiction and device category.

### Document Ingestion

**Route:** `/projects/[id]#documents`

Engineers upload supporting documentation into the project. Supported formats:

| Format | Parser |
|--------|--------|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| Plain text / CSV | native |

**How it works:**

1. File is uploaded via API, validated for size (configurable, default 50 MB) and MIME type, and stored server-side.
2. A `pg-boss` job is enqueued to run ingestion asynchronously.
3. The ingestion pipeline (`src/lib/rag/ingestion.ts`) parses the raw file into text.
4. Text is split into overlapping chunks (`src/lib/rag/chunker.ts`) using a token-aware strategy via `js-tiktoken` (CHUNK_SIZE=512, OVERLAP=50 tokens).
5. Each chunk is embedded with Ollama (Mistral 7B) via `src/lib/ollama/client.ts`.
6. Chunks and their vector embeddings are stored in the `chunks` table using pgvector.
7. Document ingestion status (`pending → processing → completed`) is tracked in the `documents` table.

Documents are versioned. Re-uploading marks old chunks as `superseded = true` so stale content is excluded from retrieval without deletion.

Source types include: `user_upload`, `maude`, `standard`, `internal`, `bom`.

### Regulatory Intelligence

**Route:** `/projects/[id]#intelligence`

Analyses FDA MAUDE (Manufacturer and User Facility Device Experience) adverse event data to surface failure patterns comparable to the project's device.

**How it works:**

1. MAUDE event records are stored in the `regulatory_events` table.
2. The Regulatory Intelligence agent (`src/lib/agents/regulatory-intelligence/`) clusters events by failure mode using semantic similarity via the Ollama embedding model.
3. Clusters are persisted in `failure_clusters` with a representative event count and summary.
4. Risk inputs derived from clusters are stored in `risk_inputs` and linked to `hazards`, forming the basis of the ISO 14971 risk file.

This analysis gives engineers a structured view of real-world failure modes before drafting documentation.

### Documentation Drafts

**Route:** `/projects/[id]#drafts`

Generates structured regulatory documentation sections using the multi-agent pipeline. Each section is drafted with full citation traceability back to source documents.

**How it works:**

1. The API triggers `orchestrateDraftGeneration()` in `src/lib/agents/orchestrator.ts`.
2. The **Documentation Drafting Agent** (`src/lib/agents/documentation-drafting/`) retrieves relevant chunks via RAG, synthesizes content with Mistral 7B, and records source citations.
3. The **Review Red-Flag Agent** (`src/lib/agents/review-redflag/`) scores the draft for risk level, citation coverage, and potential issues.
4. If the draft is low-risk with no flags, the orchestrator **auto-approves** it and the corresponding `project_requirements` entry is marked `approved`.
5. Otherwise, a `review_tasks` record is created for human review.

Draft records include: section type, confidence score, AI-generated flag, version, and content hash. All citations link back to specific chunks and documents. Agent progress is streamed to the UI via a Server-Sent Events (SSE) endpoint.

### Review Queue (HITL)

**Route:** `/projects/[id]#review`

Human-in-the-loop review queue for AI-generated content that was not auto-approved. Engineers review, edit, approve, reject, or escalate each draft section.

**Risk levels:** `low`, `medium`, `high` — determined by the Red-Flag Agent based on citation gaps, confidence score, and content flags.

**Blocked sections** (always routed to human review regardless of risk level): `intended_use`, `contraindications`, `risk_benefit_conclusion`, `substantial_equivalence`, `safety_class_assignment`.

**Approval workflow:**
- Each approval is recorded in the `approvals` table with the reviewer's ID, action taken, comments, and a content hash diff showing what changed between AI output and final approved content.
- Approving a section updates the corresponding `project_requirements` row to `approved` and increments the project's compliance score.
- Traceability links connect approvals back to drafts, sections, and source chunks.

Low-risk, well-cited sections bypass this queue entirely via auto-approval.

### ISO 14971 Risk Management

**Route:** `/projects/[id]#risk`

Full ISO 14971 risk file management with a risk matrix visualization.

**Hazard management:**
- Create, edit, and delete hazards with: description, harm, hazardous situation, hazard category, initial/residual severity (1–5), initial/residual probability (1–5), mitigation measures, and acceptability (Acceptable / ALARP / Unacceptable).
- Risk level is computed from severity × probability and classified automatically.
- Risk status tracks lifecycle: `open → mitigated → accepted → transferred`.

**Risk controls:**
- Each hazard can have one or more risk controls linked to it.
- Control types: Design, Protective Measure, Information for Safety.
- Each control records a verification method and verification status (`pending → verified → failed`).

**AI-assisted hazard suggestion:**
- The `POST /api/projects/[id]/risk/hazards/[hazardId]/suggest` endpoint calls the Regulatory Intelligence agent to suggest risk controls for a hazard based on MAUDE comparable device data.

**Risk matrix:**
- A 5×5 heat-map grid visualizing all hazards by severity × probability, color-coded by acceptability zone.

### Compliance Score & Requirements

**Route:** `/projects/[id]#overview` (score ring)
**API:** `GET /api/projects/[id]/compliance-score`

Each project has a compliance score computed as:

```
score = Math.round((approved_requirements / total_requirements) * 100)
```

The `project_requirements` table is seeded from the regulatory profile on project creation, with one row per required documentation section. As drafts are approved (by human or auto-approval), the corresponding requirements move from `not_started → in_progress → approved`.

The score is displayed as an animated ring on the project overview and as a KPI card on the Analytics dashboard.

### Traceability Matrix

**Route:** `/projects/[id]#drafts` (Traceability tab)
**API:** `GET /api/projects/[id]/traceability-matrix`

A matrix showing which source documents and standards support each approved draft section. Every citation from the drafting agent is recorded in the `citations` table with:
- Source chunk and document
- Similarity score from retrieval
- Text excerpt used as evidence

The matrix provides the evidence chain required to demonstrate in a submission that every claim in the regulatory documentation is grounded in supporting evidence.

### Export

**API:** `POST /api/projects/[id]/export` → `GET /api/projects/[id]/export/download`

Generates a submission-ready ZIP archive containing:
- Approved draft sections as formatted DOCX files
- Traceability matrix as an Excel spreadsheet
- Audit trail as a CSV
- Metadata manifest (project info, device info, export timestamp)

The export endpoint requires `engineer` role or higher.

### Audit Trail

**Route:** `/projects/[id]#audit`
**API:** `GET /api/projects/[id]/audit`

Immutable, append-only log of every action taken on a project. Covers:

| Actor type | Examples |
|------------|---------|
| `agent` | draft generated, intelligence run, auto-approval |
| `human` | document uploaded, section approved, hazard created |
| `system` | orchestration routing, job completion |

Each entry records: entity type, entity ID, action, actor, content hash, diff (for edits), and timestamp. This log is the compliance record demonstrating that all AI outputs were reviewed before use in submissions.

### Team & Organization Management

**Routes:** `/settings/team` (admin only)
**APIs:** `GET/DELETE /api/org/members`, `POST /api/org/invite`, `POST /api/org/accept-invite`

Organization admins can:
- View all current members and their roles
- Invite new members by email (generates a signed invitation token with expiry)
- Remove existing members

**Role hierarchy (lowest to highest):** `viewer → reviewer → engineer → admin → owner`

Role-based access control is enforced on every API route via `requireSession()` and `hasRole()` in `src/lib/auth/permissions.ts`.

### Analytics Dashboard

**Route:** `/analytics`
**APIs:** `GET /api/analytics/overview`, `GET /api/analytics/projects-timeline`, `GET /api/analytics/agent-performance`, `GET /api/analytics/review-metrics`

Cross-project visibility for engineering leaders and QA managers. All charts support a date range filter (Last 7 days / 30 days / 90 days / All time).

**KPI cards:**
- Total Projects, Avg Compliance Score (color-coded by threshold), Drafts Approved, Pending Reviews, Docs Ingested, Avg Generation Time

**Charts (Recharts):**
- **Project compliance bar chart** — horizontal bar per project, color-coded teal ≥80% / amber ≥50% / red <50%
- **Review funnel** — vertical bar chart showing Total Reviews → Auto-approved → Human Reviewed → Approved → Rejected, with approval/escalation/auto-approval rate pills
- **Draft generation timeline** — line chart of weekly project creation volume over the selected period

**Agent performance table:**
- Per-agent breakdown: total runs, avg duration, success rate, avg confidence score

**Backend:**
- All four endpoints filter by the authenticated user's `orgId` and accept a `?days=N` query param
- Aggregation queries run directly against PostgreSQL using raw SQL with `DATE_TRUNC`, `EXTRACT(EPOCH ...)`, and `FILTER` clauses

---

## Architecture

### Full Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) with React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI components | Radix UI primitives + Lucide icons |
| Charts | Recharts |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 + pgvector (via Docker) |
| Job queue | pg-boss (PostgreSQL-backed async jobs) |
| Cache | Redis (optional; graceful no-op fallback) |
| Auth | NextAuth v5 (JWT sessions, credentials provider) |
| Local LLM | Ollama serving Mistral 7B (embeddings + inference) |
| Document parsing | pdf-parse, mammoth (DOCX), csv-parse |

### Multi-Agent System

The platform uses a multi-agent architecture where each agent has a single responsibility. Agents are orchestrated by `src/lib/agents/orchestrator.ts`.

```
orchestrateDraftGeneration()
        │
        ▼
┌──────────────────────────┐
│  Documentation Drafting  │  ← RAG retrieval → Mistral inference → citations
│  Agent                   │
└────────────┬─────────────┘
             │ draft + section + citations
             ▼
┌──────────────────────────┐
│  Review Red-Flag Agent   │  ← score confidence, check citation coverage
└────────────┬─────────────┘
             │ risk level + flags
             ▼
      ┌──────┴──────┐
      │             │
  low risk      needs review
  no flags           │
      │               ▼
      ▼        Review Queue (HITL)
  Auto-approve       │
                      ▼
               Human approves/rejects
```

Agent progress is streamed to the UI in real time via `GET /api/projects/[id]/agents/stream` (Server-Sent Events).

Each agent run is recorded in the `agent_runs` table with input, output, token counts, model used, duration, and status.

| Agent | Location | Role |
|-------|----------|------|
| Orchestrator | `src/lib/agents/orchestrator.ts` | Coordinates the full draft → review pipeline |
| Documentation Drafting | `src/lib/agents/documentation-drafting/` | Retrieves evidence, generates section content, records citations |
| Regulatory Intelligence | `src/lib/agents/regulatory-intelligence/` | Clusters MAUDE events into failure modes, seeds risk inputs |
| Retrieval / Evidence | `src/lib/agents/retrieval-evidence/` | RAG retrieval helper |
| Review Red-Flag | `src/lib/agents/review-redflag/` | Scores drafts, raises flags, assigns risk level |
| HITL | `src/lib/agents/hitl/` | Auto-approval logic and approval processing |

### RAG Pipeline

Retrieval-Augmented Generation connects uploaded documents to draft generation.

```
Upload → Parse → Chunk → Embed → Store (pgvector)
                                    │
                                    ▼
Draft request → Query embed → Cosine similarity → Top-k chunks → LLM prompt
```

| Step | File | Notes |
|------|------|-------|
| Chunking | `src/lib/rag/chunker.ts` | Token-aware, overlapping windows (512 tokens, 50 overlap) via js-tiktoken |
| Embedding | `src/lib/rag/embedder.ts` | Ollama Mistral 7B embedding endpoint, 768-dim vectors |
| Ingestion | `src/lib/rag/ingestion.ts` | Orchestrates parse → chunk → embed → store |
| Retrieval | `src/lib/rag/retriever.ts` | pgvector cosine similarity (`<=>` operator), deduplication to max 3 chunks/document |

### Database Schema

Tables organised into logical groups:

| Group | Tables |
|-------|--------|
| Auth | `users`, `organizations`, `organization_members`, `invitations` |
| Projects | `projects`, `devices`, `project_requirements` |
| Documents & RAG | `documents`, `chunks`, `standards` |
| Regulatory Data | `regulatory_events`, `failure_clusters` |
| Risk | `hazards`, `risk_inputs`, `risk_controls` |
| Drafts | `generated_drafts`, `draft_sections`, `citations` |
| Review | `review_tasks`, `approvals` |
| Agent ops | `agent_runs` |
| Compliance | `audit_log`, `traceability_links` |

All primary keys are UUIDs generated by PostgreSQL (`gen_random_uuid()`). Schema is defined in `src/lib/db/schema.ts` and typed via Drizzle ORM's `$inferSelect` / `$inferInsert` helpers.

### API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/projects` | session | List all projects for org (Redis cached, 30s TTL) |
| POST | `/api/projects` | engineer+ | Create project + device + requirements |
| GET | `/api/projects/[id]` | project member | Fetch single project |
| GET/POST | `/api/projects/[id]/documents` | project member / engineer+ | List or upload documents |
| GET | `/api/projects/[id]/documents/[docId]/chunks` | project member | Fetch chunks for a document |
| GET | `/api/projects/[id]/documents/[docId]/preview` | project member | Stream document file preview |
| GET | `/api/projects/[id]/drafts` | project member | List drafts with section count + review task |
| GET | `/api/projects/[id]/compliance-score` | project member | Per-project compliance score (approved/total requirements) |
| GET | `/api/projects/[id]/requirements` | project member | List all project requirements |
| GET | `/api/projects/[id]/summary` | project member | AI-generated project summary |
| GET | `/api/projects/[id]/search` | project member | Full-text semantic search over chunks |
| GET | `/api/projects/[id]/intelligence` | project member | Regulatory intelligence results + failure clusters |
| GET | `/api/projects/[id]/risk` | project member | Risk file summary |
| GET/POST | `/api/projects/[id]/risk/hazards` | project member / engineer+ | List or create hazards |
| GET/PUT/DELETE | `/api/projects/[id]/risk/hazards/[hazardId]` | project member / engineer+ | Fetch, update, or delete a hazard |
| GET/POST | `/api/projects/[id]/risk/hazards/[hazardId]/controls` | project member / engineer+ | List or add risk controls |
| POST | `/api/projects/[id]/risk/hazards/[hazardId]/suggest` | engineer+ | AI-suggested risk controls |
| GET | `/api/projects/[id]/traceability-matrix` | project member | Citation traceability matrix |
| GET | `/api/projects/[id]/audit` | project member | Project audit trail |
| POST | `/api/projects/[id]/agents/run` | engineer+ | Trigger agent run (draft generation, intelligence) |
| GET | `/api/projects/[id]/agents/stream` | project member | SSE stream for agent progress |
| POST | `/api/projects/[id]/export` | engineer+ | Generate submission ZIP |
| GET | `/api/projects/[id]/export/download` | project member | Download generated ZIP |
| GET | `/api/projects/[id]/jobs/watch` | project member | SSE stream for job completion events |
| GET | `/api/drafts/[id]` | project member | Fetch draft with sections + citations |
| GET/PUT | `/api/drafts/[id]/sections/[sid]` | project member / engineer+ | Fetch or update a draft section |
| GET | `/api/drafts/[id]/evidence-reviewed` | project member | Evidence reviewed status |
| GET | `/api/review/tasks` | session | List review tasks (filterable by project) |
| PUT | `/api/review/tasks/[id]/approve` | reviewer+ | Approve a review task |
| PUT | `/api/review/tasks/[id]/reject` | reviewer+ | Reject a review task |
| GET | `/api/analytics/overview` | session | Cross-project KPIs (totals, scores, tokens, timing) |
| GET | `/api/analytics/projects-timeline` | session | Weekly project creation counts (last 12 weeks) |
| GET | `/api/analytics/agent-performance` | session | Per-agent: runs, duration, success rate, confidence |
| GET | `/api/analytics/review-metrics` | session | Approval rates, escalation rate, funnel, risk breakdown |
| GET | `/api/org/members` | admin+ | List org members |
| POST | `/api/org/invite` | admin+ | Send member invitation |
| POST | `/api/org/accept-invite` | none | Accept invitation via token |
| DELETE | `/api/org/members/[userId]` | admin+ | Remove a member |
| POST | `/api/auth/register` | none | Register new account |
| GET/POST | `/api/auth/[...nextauth]` | — | NextAuth handlers |
| GET | `/api/admin/jobs` | admin+ | List pg-boss job queue |
| GET | `/api/health` | none | System health check (DB + Ollama) |
| POST | `/api/startup` | none | Initialization hook |

---

## Development

```bash
# Type-check without emitting
npm run typecheck

# Lint
npm run lint

# Dev server with Turbopack
npm run dev

# Production build
npm run build && npm start

# Re-run database migration
npm run db:migrate
```

**Regulatory profiles** (device-specific section requirements and standards mappings) are JSON files in `src/regulatory_profiles/`:
- `fda_assistive_wearable.json`
- `fda_surgical.json`
- `ce_mdr.json`

To add a new profile, create a JSON file in that directory and add the corresponding enum values to the Zod schema in `src/app/api/projects/route.ts`.

### Testing

The platform uses **Vitest** for unit and integration tests and **Playwright** for end-to-end tests.

```bash
# Run all unit tests
npm test

# Run unit tests with coverage report
npm run test:coverage

# Run E2E tests (requires dev server running or auto-starts one)
npm run test:e2e
```

**Unit tests** (`src/__tests__/unit/`) — 5 test files, 43 tests:

| File | What's tested |
|------|--------------|
| `chunker.test.ts` | `chunkText()` — empty input, min token threshold, sequential index, overlap, token budget |
| `embedder.test.ts` | `embedChunk()`, `embedChunks()` — Ollama mock, `onProgress` callback, empty input |
| `retriever.test.ts` | `retrieve()` — similarity ordering, 3-chunks-per-doc deduplication, field mapping, pool release |
| `orchestrator.test.ts` | `canAutoApprove()` — pure function: risk level, flag count, blocked section types |
| `compliance-score.test.ts` | Score formula — 0/0, 0/N, N/N, and fractional cases |

**Integration tests** (`src/__tests__/integration/`) — 4 test files, 17 tests:

| File | What's tested |
|------|--------------|
| `projects-api.test.ts` | POST 201 + 3 DB inserts, 400 validation, GET 200 with org filter |
| `documents-api.test.ts` | POST 201 + job enqueue, 413 oversized, 415 bad MIME, GET 200 |
| `drafts-api.test.ts` | GET 200 + section/review enrichment, null review task, empty array |
| `auth.test.ts` | 401 on all project routes when unauthenticated |

**E2E tests** (`e2e/`) — Playwright with Chromium:

| File | Flow tested |
|------|------------|
| `project-creation.spec.ts` | Create project → redirect to `/projects/:id` → device name visible → validation error |
| `document-upload.spec.ts` | Upload PDF → appears in documents list → status badge shown |
| `review-workflow.spec.ts` | Approve review task → Approved badge → audit trail entry → filter toggle |

**CI (GitHub Actions)** — `.github/workflows/ci.yml`:
- Runs on all PRs and pushes to `main`
- Spins up `pgvector/pgvector:pg16` as a service
- Steps: `npm ci` → migrate DB → `typecheck` → `lint` → unit tests → integration tests

> **Disclaimer:** All AI-generated content is a draft aid only. Engineering and regulatory review is required before use in any FDA submission or regulatory correspondence.
