# Workflow: Audit Export

## Objective
Export the full audit trail and approved content for regulatory record-keeping.

## Steps

### Full Audit Log Export
```
GET /api/projects/:id/audit?format=csv
```
Or navigate to `/projects/:id/audit` and click "Export CSV".

### Programmatic Export
```bash
curl -o audit_trail.csv "http://localhost:3000/api/projects/PROJECT_ID/audit?format=csv"
```

## Audit Record Fields
| Field | Description |
|-------|-------------|
| id | Unique audit entry ID |
| entity_type | Type: draft_section, approval, agent_run, etc. |
| entity_id | UUID of the entity |
| action | What happened: ai_generated, approved, rejected, edited |
| actor_type | agent or human |
| actor_id | Agent name or user ID |
| content_hash | SHA-256 of content at time of action |
| timestamp | ISO 8601 timestamp |

## What the Audit Trail Proves
- Which content was AI-generated (actor_type = agent)
- Which content was human-reviewed (action = reviewed)
- Which content was human-approved (action = approved)
- What was changed between AI output and human-approved version (diff field)
- When each decision was made

## Limitations
- Audit log is append-only within the application
- Database administrators can technically modify records — use DB-level write protection for production
- No cryptographic signing of audit records in MVP (planned for Phase 2)

## For Regulatory Submissions
The audit trail can be used to demonstrate:
- Design control traceability (21 CFR 820.30)
- Documentation of who generated, reviewed, and approved each document element
- AI transparency: what was AI-generated vs human-authored
