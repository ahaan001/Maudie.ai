# Workflow: Draft Generation

## Objective
Generate AI-drafted documentation sections for FDA regulatory submissions using RAG-augmented Mistral 7B.

## Prerequisites
- Project exists with device metadata
- At least 3 documents fully ingested (ingestion_status = completed)
- Ollama running with mistral:7b-instruct model
- Recommended: 5+ relevant documents for good citation coverage

## Supported Section Types
| Section | Risk Level | Auto-Approve Eligible |
|---------|-----------|----------------------|
| device_description | low | Yes (if well-cited) |
| intended_use | medium | NO — always requires review |
| contraindications | medium | NO — always requires review |
| risk_assessment_overview | medium | No |
| failure_mode_summary | medium | No |
| software_description | low | Yes (if well-cited) |
| test_summary | low | Yes (if well-cited) |
| dhf_index | low | Yes |

## Steps

1. **Navigate** to `/projects/:id/drafts`
2. **Click** "Generate Draft"
3. **Select** section type from dropdown
4. **Confirm** — job is queued (pg-boss)
5. **Wait** ~60-120 seconds on CPU (Mistral 7B inference)
6. **Refresh** page to see generated draft
7. **Click** draft to view content, confidence score, and citations
8. **Review task** created automatically by ReviewRedFlagAgent

## Quality Gates
Before promoting a draft:
- confidence_score >= 0.6
- citation_count >= 2
- No REGULATORY_RISK_WORDING flags with severity='error'
- Human sign-off recorded in approvals table

## What to Expect from the Agent
- Content labeled [GENERATED] = AI-written narrative
- Content labeled [FROM_SOURCE] = extracted from your documents
- Citations in format [CITE:chunk_uuid]
- Claims labeled [UNSUPPORTED: ...] where no source was found

## Edge Cases
- **Ollama timeout (>5 min)**: Ollama may be slow on CPU. Check `docker logs compliance_ollama`.
- **No chunks retrieved**: Similarity threshold too high or documents not ingested. Check `/documents` page.
- **JSON parse failure**: Agent returns raw text, confidence_score set to 0.4, mandatory review triggered.
- **Low confidence (<0.6)**: Add more relevant documents and re-generate.

## After Generation
1. Check the review queue at `/projects/:id/review`
2. A ReviewTask has been created with red-flag analysis
3. Assign to a reviewer and complete the sign-off workflow

## Regulatory Caution
AI-generated content is a DRAFT AID only. The following require regulatory expertise before use:
- Intended Use statements
- Contraindications
- 510(k) substantial equivalence arguments
- Risk-benefit conclusions
