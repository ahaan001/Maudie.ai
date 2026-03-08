import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoist mock fns so vi.mock factories can reference them ---
const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockSelectOrderBy = vi.fn().mockResolvedValue([]);
  const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  return { mockReturning, mockInsertValues, mockInsert, mockSelect, mockSelectFrom, mockSelectWhere, mockSelectOrderBy };
});

vi.mock('@/lib/auth/permissions', () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { userId: 'user-1111-1111-1111-111111111111', orgId: 'org-1111-1111-1111-111111111111', orgRole: 'engineer' },
  }),
  requireProjectSession: vi.fn().mockResolvedValue({
    user: { userId: 'user-1111-1111-1111-111111111111', orgId: 'org-1111-1111-1111-111111111111', orgRole: 'engineer' },
  }),
  hasRole: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
  },
  pool: {},
}));

vi.mock('@/lib/regulatory-profiles', () => ({
  loadRegulatoryProfile: vi.fn().mockResolvedValue({
    required_sections: ['device_description', 'intended_use'],
  }),
}));

import { GET, POST } from '@/app/api/projects/route';

const ORG_ID = 'org-1111-1111-1111-111111111111';
const USER_ID = 'user-1111-1111-1111-111111111111';

const validBody = {
  name: 'Test Device Project',
  description: 'A test project',
  deviceCategory: 'assistive_wearable',
  jurisdiction: 'fda_us',
  device: {
    name: 'TestBot 2000',
    intendedUse: 'Assists rehabilitation',
    deviceClass: 'II',
  },
};

describe('POST /api/projects', () => {
  const fakeProject = {
    id: 'proj-1111-1111-1111-111111111111',
    name: validBody.name,
    orgId: ORG_ID,
    createdBy: USER_ID,
    deviceCategory: 'assistive_wearable',
    jurisdiction: 'fda_us',
    regulatoryProfile: 'fda_assistive_wearable',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // First insert (projects) returns the project; subsequent inserts return []
    mocks.mockReturning
      .mockResolvedValueOnce([fakeProject])
      .mockResolvedValue([]);
  });

  it('returns 201 with the created project on valid input', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.project).toBeDefined();
    expect(body.project.name).toBe(validBody.name);
  });

  it('inserts project, device, and requirements rows (three inserts total)', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    // projects + devices + projectRequirements
    expect(mocks.mockInsert).toHaveBeenCalledTimes(3);
  });

  it('returns 400 with details when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: '' }), // missing device, empty name
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/projects', () => {
  it('returns 200 with a projects array', async () => {
    const fakeProjects = [
      { id: 'proj-abc', name: 'Alpha', orgId: ORG_ID },
    ];
    mocks.mockSelectOrderBy.mockResolvedValueOnce(fakeProjects);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.projects)).toBe(true);
  });
});
