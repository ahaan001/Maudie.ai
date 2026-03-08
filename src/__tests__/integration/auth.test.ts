import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Auth integration tests — no permission mocks.
 * These tests verify that unauthenticated requests are rejected with 401.
 * The real requireSession / requireProjectSession are used, with auth() mocked
 * to return null (unauthenticated).
 */
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn().mockResolvedValue(null), // no session
}));

// DB mock to prevent real DB connections
vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
  pool: {},
}));

vi.mock('@/lib/cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

import { GET as getProjects, POST as postProject } from '@/app/api/projects/route';
import { GET as getDocuments } from '@/app/api/projects/[id]/documents/route';
import { GET as getDrafts } from '@/app/api/projects/[id]/drafts/route';

const PROJECT_ID = 'proj-1111-1111-1111-111111111111';

describe('unauthenticated requests', () => {
  it('GET /api/projects → 401', async () => {
    const res = await getProjects();
    expect(res.status).toBe(401);
  });

  it('POST /api/projects → 401', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await postProject(req);
    expect(res.status).toBe(401);
  });

  it('GET /api/projects/:id/documents → 401', async () => {
    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/documents`);
    const params = { params: Promise.resolve({ id: PROJECT_ID }) };
    const res = await getDocuments(req, params);
    expect(res.status).toBe(401);
  });

  it('GET /api/projects/:id/drafts → 401', async () => {
    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/drafts`);
    const params = { params: Promise.resolve({ id: PROJECT_ID }) };
    const res = await getDrafts(req, params);
    expect(res.status).toBe(401);
  });
});
