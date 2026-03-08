import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/permissions', () => ({
  requireProjectSession: vi.fn().mockResolvedValue({
    user: { userId: 'user-1111-1111-1111-111111111111', orgId: 'org-1111-1111-1111-111111111111', orgRole: 'reviewer' },
  }),
}));

// Build a chainable+thenable mock that supports:
//   db.select().from().where()            (enrichment queries — await where directly)
//   db.select().from().where().orderBy()  (main query — await orderBy)
const mocks = vi.hoisted(() => {
  // Queue of results for sequential db.select() calls
  const results: unknown[][] = [];

  function makeChain(value: unknown[]) {
    const thenable = {
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        return Promise.resolve(value).then(resolve, reject);
      },
      catch(reject: (e: unknown) => void) {
        return Promise.resolve(value).catch(reject);
      },
      finally(fn: () => void) {
        return Promise.resolve(value).finally(fn);
      },
      orderBy: vi.fn().mockResolvedValue(value),
      limit: vi.fn().mockResolvedValue(value),
    };
    return thenable;
  }

  const mockSelect = vi.fn(() => {
    const value = results.shift() ?? [];
    const chain = makeChain(value);
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => chain),
        orderBy: vi.fn().mockResolvedValue(value),
      })),
    };
  });

  return { mockSelect, results };
});

vi.mock('@/lib/db/client', () => ({
  db: { select: mocks.mockSelect },
  pool: {},
}));

import { GET } from '@/app/api/projects/[id]/drafts/route';

const PROJECT_ID = 'proj-1111-1111-1111-111111111111';
const PARAMS = { params: Promise.resolve({ id: PROJECT_ID }) };

const fakeDraft = {
  id: 'draft-1111-1111-1111-111111111111',
  projectId: PROJECT_ID,
  sectionType: 'device_description',
  title: 'Device Description',
  status: 'approved',
  agentRunId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('GET /api/projects/:id/drafts', () => {
  it('returns 200 with a drafts array', async () => {
    // Queue: [mainQuery→drafts, sections, tasks]
    mocks.results.push([fakeDraft], [{ id: 'section-1' }], [{ id: 'task-1', status: 'approved', riskLevel: 'low' }]);

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/drafts`);
    const res = await GET(req, PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.drafts)).toBe(true);
  });

  it('enriches each draft with sectionCount and reviewTask', async () => {
    mocks.results.push(
      [fakeDraft],
      [{ id: 's1' }, { id: 's2' }],
      [{ id: 't1', status: 'pending', riskLevel: 'medium' }],
    );

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/drafts`);
    const res = await GET(req, PARAMS);
    const body = await res.json();

    const draft = body.drafts[0];
    expect(draft.sectionCount).toBe(2);
    expect(draft.reviewTask).toMatchObject({ id: 't1', status: 'pending' });
  });

  it('sets reviewTask to null when no review task exists', async () => {
    mocks.results.push([fakeDraft], [], []);

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/drafts`);
    const res = await GET(req, PARAMS);
    const body = await res.json();

    expect(body.drafts[0].reviewTask).toBeNull();
  });

  it('returns an empty array when the project has no drafts', async () => {
    mocks.results.push([]);

    const req = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/drafts`);
    const res = await GET(req, PARAMS);
    const body = await res.json();

    expect(body.drafts).toEqual([]);
  });
});
