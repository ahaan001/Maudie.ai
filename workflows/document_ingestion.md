# Workflow: Document Ingestion

## Objective
Upload and ingest engineering documents into the project knowledge base for RAG retrieval.

## Prerequisites
- Project exists with device metadata
- Ollama running with nomic-embed-text model
- PostgreSQL running with pgvector extension

## Supported Document Types
| Type | Extensions | Notes |
|------|-----------|-------|
| PDF | .pdf | Must have text layer (not scanned) |
| Word | .docx | Full text extraction |
| Text | .txt, .md | Plain text |
| Spreadsheet | .csv | Header row required |

## Steps

1. **Navigate** to `/projects/:id/documents`
2. **Drag and drop** or click to upload file
3. **Wait** for ingestion status to change to `completed` (refresh page)
4. **Verify** chunk count is reasonable (typically 2-50 chunks per document)

API alternative:
```
POST /api/projects/:id/documents (multipart/form-data)
  file: <file>
  sourceType: user_upload
```

## Ingestion Pipeline (automated)
1. File saved to `./uploads/:projectId/filename`
2. pg-boss job enqueued: `ingest_document`
3. Worker picks up job:
   - Parse file (pdf-parse / mammoth / fs.readFile)
   - Chunk text (512 tokens, 50 overlap, 100 min)
   - Embed each chunk via Ollama nomic-embed-text
   - Store chunks with pgvector embedding
4. Document status updated to `completed`

## Token Budget
- Chunking: 512 tokens per chunk
- Embedding: ~100ms per chunk on CPU (nomic-embed-text)
- A 50-page PDF typically produces 30-80 chunks

## Edge Cases
- **Scanned PDF (no text layer)**: Ingestion fails with "empty document" error.
  Resolution: Use `tools/pdf_extract.py --ocr` to extract text, save as .txt, re-upload.
- **Very large file (>50MB)**: Upload rejected. Split document or extract relevant sections.
- **CSV with no headers**: Ingestion produces garbled content. Add headers manually.
- **Non-English content**: Embedding quality degrades. Note in document metadata.

## Verification
- Document status = `completed` in `/projects/:id/documents`
- Run a test search: `POST /api/projects/:id/search { "query": "test query" }`
- Expect chunks with similarity > 0.7 for relevant content

## Document Priority for MVP
Upload in this order for best draft quality:
1. Device description / product specifications
2. Intended use statement (if existing)
3. Test reports (performance, safety)
4. SOPs related to device operation
5. Standards excerpts (ISO 14971, IEC 62304 sections)
6. Prior 510(k) summaries (comparable devices)
