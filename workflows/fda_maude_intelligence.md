# Workflow: FDA MAUDE Intelligence

## Objective
Ingest FDA MAUDE adverse event data for comparable devices and generate structured risk inputs for the project.

## Prerequisites
- MAUDE CSV data downloaded from FDA website
- Project exists with device category set to assistive_wearable
- PostgreSQL running

## Steps

### Step 1: Download MAUDE Data
1. Go to FDA MAUDE database (see link in plan)
2. Download: `mdrfoi.zip` (device reports) and `foitext.zip` (event text)
3. Extract to `.tmp/maude/`

### Step 2: Ingest MAUDE Records
```bash
export DATABASE_URL=postgresql://compliance_user:compliance_pass@localhost:5432/compliance_db
python tools/maude_ingest.py .tmp/maude/mdrfoi.txt --keywords "exoskeleton,orthosis,prosthetic,wearable robot"
```
Expected: 50-500 records for assistive/wearable devices

### Step 3: Ingest MAUDE Text
If text file is separate:
```bash
python tools/maude_ingest.py .tmp/maude/foitext.txt --keywords "exoskeleton,orthosis,prosthetic"
```

### Step 4: Run Regulatory Intelligence Agent
1. Navigate to `/projects/:id/intelligence`
2. Click "Run MAUDE Analysis"
3. Wait 30-120 seconds
4. Refresh page to see failure clusters and hazard inputs

API alternative:
```
POST /api/projects/:id/agents/run
{
  "agent": "regulatory_intelligence",
  "params": {
    "keywords": ["exoskeleton", "orthosis", "wearable robot"]
  }
}
```

## Outputs
- `failure_clusters` records: grouped adverse event patterns
- `hazards` records: AI-generated hazard descriptions (requires review)
- `risk_inputs` records: risk estimates (requires review)

## Regulatory Caution
All AI-generated risk inputs:
- Are labeled `ai_generated = true`
- Are labeled `requires_review = true`
- Must be reviewed by a qualified engineer before use in a risk management file
- Are NOT suitable for direct inclusion in a risk assessment without engineering validation

## Edge Cases
- **No MAUDE records found**: Keyword filters too restrictive. Try broader terms.
- **MAUDE CSV format change**: FDA occasionally updates column names. Check `tools/maude_ingest.py` column mappings.
- **Large MAUDE files**: Process in batches using `--limit` flag.

## Verification
- GET `/api/projects/:id/intelligence` returns clusters and hazards
- Review failure cluster descriptions for relevance
- Flag any clusters that are not applicable to your device category
