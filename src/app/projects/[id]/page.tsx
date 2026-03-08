import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { projects, devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { loadRegulatoryProfile } from '@/lib/regulatory-profiles';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ProjectDetailClient } from '@/components/project/ProjectDetailClient';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pid = id as `${string}-${string}-${string}-${string}-${string}`;

  const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
  if (!project) notFound();

  const [device] = await db.select().from(devices).where(eq(devices.projectId, pid)).limit(1);

  const regulatoryProfile = await loadRegulatoryProfile(project.regulatoryProfile);

  const initialProject = {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    deviceCategory: project.deviceCategory,
    jurisdiction: project.jurisdiction,
    regulatoryProfile: project.regulatoryProfile,
    status: project.status,
    createdAt: project.createdAt?.toISOString() ?? new Date().toISOString(),
  };

  const initialDevice = device
    ? {
        id: device.id,
        name: device.name,
        category: device.category,
        deviceClass: device.deviceClass ?? null,
        intendedUse: device.intendedUse ?? null,
      }
    : null;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--navy)' }}>
      <Sidebar projectId={id} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-8 py-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <ProjectDetailClient
              projectId={id}
              initialProject={initialProject}
              initialDevice={initialDevice}
              regulatoryProfile={regulatoryProfile}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
