import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { projects, devices, projectRequirements } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadRegulatoryProfile } from '@/lib/regulatory-profiles';
import { requireSession, hasRole } from '@/lib/auth/permissions';
import { getCache, setCache, invalidateCache } from '@/lib/cache';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  deviceCategory: z.enum(['assistive_wearable', 'surgical', 'rehabilitation', 'diagnostic']).default('assistive_wearable'),
  jurisdiction: z.enum(['fda_us', 'ce_eu']).default('fda_us'),
  device: z.object({
    name: z.string().min(1),
    intendedUse: z.string().optional(),
    deviceClass: z.enum(['I', 'II', 'III']).optional(),
    predicateDevice: z.string().optional(),
    manufacturerName: z.string().optional(),
    modelNumber: z.string().optional(),
  }),
});

const PROFILE_MAP: Record<string, Record<string, string>> = {
  fda_us: {
    assistive_wearable: 'fda_assistive_wearable',
    surgical: 'fda_surgical',
    default: 'fda_assistive_wearable',
  },
  ce_eu: { default: 'ce_mdr' },
};

export async function GET() {
  try {
    let session;
    try {
      session = await requireSession();
    } catch (res) {
      return res as Response;
    }

    const orgId = session.user.orgId;
    if (!orgId) {
      return NextResponse.json({ projects: [] });
    }

    const cacheKey = `projects:${orgId}`;
    const cached = await getCache<(typeof projects.$inferSelect)[]>(cacheKey);
    if (cached) return NextResponse.json({ projects: cached });

    const allProjects = await db.select().from(projects)
      .where(eq(projects.orgId, orgId as `${string}-${string}-${string}-${string}-${string}`))
      .orderBy(projects.createdAt);

    await setCache(cacheKey, allProjects, 30);
    return NextResponse.json({ projects: allProjects });
  } catch (err) {
    console.error('[GET /api/projects]', err);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let session;
    try {
      session = await requireSession();
    } catch (res) {
      return res as Response;
    }

    if (!hasRole(session.user.orgRole, 'viewer')) {
      return NextResponse.json({ error: 'Forbidden: organization membership required' }, { status: 403 });
    }

    const orgId = session.user.orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization associated with your account' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { name, description, deviceCategory, jurisdiction, device } = parsed.data;

    const regulatoryProfile =
      PROFILE_MAP[jurisdiction]?.[deviceCategory] ??
      PROFILE_MAP[jurisdiction]?.['default'] ??
      'fda_assistive_wearable';

    const [project] = await db.insert(projects).values({
      name,
      description,
      deviceCategory,
      jurisdiction,
      regulatoryProfile,
      orgId: orgId as `${string}-${string}-${string}-${string}-${string}`,
      createdBy: session.user.userId as `${string}-${string}-${string}-${string}-${string}`,
    }).returning();

    await db.insert(devices).values({
      projectId: project.id,
      name: device.name,
      category: deviceCategory,
      intendedUse: device.intendedUse,
      deviceClass: device.deviceClass,
      predicateDevice: device.predicateDevice,
      manufacturerName: device.manufacturerName,
      modelNumber: device.modelNumber,
    });

    // Seed project_requirements from the regulatory profile
    try {
      const profile = await loadRegulatoryProfile(regulatoryProfile);
      if (profile.required_sections?.length > 0) {
        await db.insert(projectRequirements).values(
          profile.required_sections.map(sectionKey => ({
            projectId: project.id,
            sectionKey,
            status: 'not_started' as const,
          }))
        );
      }
    } catch (seedErr) {
      console.warn('[POST /api/projects] Failed to seed requirements:', seedErr);
    }

    await invalidateCache(`projects:${orgId}`);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/projects]', err);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
