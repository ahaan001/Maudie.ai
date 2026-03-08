import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoist mock fns ---
const mocks = vi.hoisted(() => {
  const mockDocReturning = vi.fn();
  const mockDocInsertValues = vi.fn(() => ({ returning: mockDocReturning }));
  const mockDocInsert = vi.fn(() => ({ values: mockDocInsertValues }));

  const mockDocSelectOrderBy = vi.fn().mockResolvedValue([]);
  const mockDocSelectWhere = vi.fn(() => ({ orderBy: mockDocSelectOrderBy }));
  const mockDocSelectFrom = vi.fn(() => ({ where: mockDocSelectWhere, orderBy: mockDocSelectOrderBy }));
  const mockDocSelect = vi.fn(() => ({ from: mockDocSelectFrom }));

  return { mockDocReturning, mockDocInsertValues, mockDocInsert, mockDocSelect, mockDocSelectFrom, mockDocSelectWhere, mockDocSelectOrderBy };
});

vi.mock('@/lib/auth/permissions', () => ({
  requireProjectSession: vi.fn().mockResolvedValue({
    user: { userId: 'user-1111-1111-1111-111111111111', orgId: 'org-1111-1111-1111-111111111111', orgRole: 'engineer' },
  }),
  hasRole: vi.fn().mockReturnValue(true),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queue/boss', () => ({
  enqueueJob: vi.fn().mockResolvedValue('job-123'),
  QUEUES: { INGEST_DOCUMENT: 'ingest_document' },
}));

vi.mock('@/lib/utils/hash', () => ({
  hashFile: vi.fn().mockReturnValue('abc123def456'),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: mocks.mockDocInsert,
    select: mocks.mockDocSelect,
  },
  pool: {},
}));

import { POST, GET } from '@/app/api/projects/[id]/documents/route';

const PROJECT_ID = 'proj-1111-1111-1111-111111111111';
const PARAMS = { params: Promise.resolve({ id: PROJECT_ID }) };

function makePdfFormData(sizeBytes = 1024): FormData {
  const buf = Buffer.alloc(sizeBytes, 0x25);
  const file = new File([buf], 'test.pdf', { type: 'application/pdf' });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('sourceType', 'user_upload');
  return fd;
}

describe('POST /api/projects/:id/documents', () => {
  const fakeDoc = {
    id: 'doc-1111-1111-1111-111111111111',
    projectId: PROJECT_ID,
    name: 'test.pdf',
    ingestionStatus: 'pending',
    mimeType: 'application/pdf',
  };

  beforeEach(() => {
    mocks.mockDocReturning.mockResolvedValue([fakeDoc]);
  });

  it('returns 201 and creates a document record in pending state', async () => {
    const fd = makePdfFormData();
    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/documents`, {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req, PARAMS);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.document).toBeDefined();
    expect(body.document.ingestionStatus).toBe('pending');
    expect(body.jobId).toBe('job-123');
  });

  it('enqueues an INGEST_DOCUMENT job after creating the record', async () => {
    const { enqueueJob } = await import('@/lib/queue/boss');
    const fd = makePdfFormData();
    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/documents`, {
      method: 'POST',
      body: fd,
    });

    await POST(req, PARAMS);

    expect(enqueueJob).toHaveBeenCalledWith('ingest_document', expect.objectContaining({ documentId: fakeDoc.id }));
  });

  it('returns 413 when the file exceeds the size limit', async () => {
    // Allocate a real 51 MB buffer; writeFile is mocked so no actual disk I/O occurs
    const buf = Buffer.alloc(51 * 1024 * 1024);
    const bigFile = new File([buf], 'big.pdf', { type: 'application/pdf' });
    const fd = new FormData();
    fd.append('file', bigFile);

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/documents`, {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(413);
  });

  it('returns 415 for an unsupported MIME type', async () => {
    const file = new File([Buffer.alloc(10)], 'data.exe', { type: 'application/x-msdownload' });
    const fd = new FormData();
    fd.append('file', file);

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/documents`, {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req, PARAMS);
    expect(res.status).toBe(415);
  });
});

describe('GET /api/projects/:id/documents', () => {
  it('returns 200 with a documents array', async () => {
    mocks.mockDocSelectOrderBy.mockResolvedValueOnce([{ id: 'doc-1', name: 'file.pdf', ingestionStatus: 'completed' }]);

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/documents`);
    const res = await GET(req, PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.documents)).toBe(true);
  });
});
