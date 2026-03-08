# Workflow: Review and Sign-Off

## Objective
Human engineers review AI-generated draft sections, apply corrections, and formally approve or reject for the project record.

## Prerequisites
- Draft section has been generated
- ReviewTask exists with status = pending
- Reviewer has appropriate access

## Review Task States
`pending` → `in_review` → `approved` | `rejected` | `escalated`

## Steps

1. **Navigate** to `/projects/:id/review`
2. **Select** a pending task from the queue (left panel)
3. **Read** the draft content in the right panel
4. **Review** the flag list at the top:
   - Red flags (error): must address before approval
   - Yellow flags (warning): consider before approval
5. **Edit** the content inline if needed
6. **Add** review comments (required for rejection)
7. **Approve or Reject**:
   - Approve: records your sign-off, content hash, and any edits in audit_log
   - Reject: draft status set to rejected, re-generation needed

## What is Recorded
Every approval action creates an immutable audit record:
- Reviewer identity (user ID)
- Timestamp
- SHA-256 hash of AI-generated content
- SHA-256 hash of human-approved content
- JSON diff showing what was changed
- Review comments

## Mandatory Review Sections (cannot be skipped)
- `intended_use` — always requires human sign-off
- `contraindications` — always requires human sign-off
- Any section with `risk_level = high` flag from ReviewRedFlagAgent
- Any section with `REGULATORY_RISK_WORDING` error flag

## Auto-Approve Logic
The system may auto-approve low-risk sections if:
- risk_level = low
- Zero flags from ReviewRedFlagAgent
- confidence_score >= 0.6
- citation_count >= 2
- Section type NOT in mandatory review list

Auto-approved sections are still logged in audit_log with actor = system.

## Regulatory Caution
Approval in this system records the engineer's decision for audit purposes.
It does NOT constitute:
- FDA regulatory clearance
- Legal compliance determination
- A substitute for qualified regulatory affairs review
- Sign-off on clinical claims

## Exporting Approved Content
1. Navigate to `/projects/:id/audit`
2. Click "Export CSV" for full audit trail
3. Approved draft content is available via GET /api/drafts/:id
