import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { generatedDrafts, citations, documents, projects } from '@/lib/db/schema';
import { eq, ne, sql } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';
import { loadRegulatoryProfile } from '@/lib/regulatory-profiles';
import { getSectionMetadata } from '@/lib/section-metadata';

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  const pid = id as `${string}-${string}-${string}-${string}-${string}`;
  const format = req.nextUrl.searchParams.get('format');

  const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const profile = await loadRegulatoryProfile(project.regulatoryProfile);

  const allDrafts = await db.select().from(generatedDrafts)
    .where(eq(generatedDrafts.projectId, pid));
  const activeDrafts = allDrafts.filter(d => d.status !== 'rejected');

  // Aggregate citations per draft
  const sectionRows = await Promise.all(activeDrafts.map(async draft => {
    const rows = await db.select({
      documentId: citations.documentId,
      documentName: documents.name,
      sourceType: documents.sourceType,
      count: sql<number>`cast(count(*) as int)`,
      avgSim: sql<number>`coalesce(avg(${citations.similarityScore}), 0)`,
    }).from(citations)
      .leftJoin(documents, eq(citations.documentId, documents.id))
      .where(eq(citations.draftId, draft.id))
      .groupBy(citations.documentId, documents.name, documents.sourceType);

    const uniqueSources = rows.length;
    const sourceTypes = new Set(rows.map(r => r.sourceType).filter(Boolean));
    const sourceTypeDiversity = sourceTypes.size;
    const avgSimilarity = rows.length > 0
      ? rows.reduce((sum, r) => sum + Number(r.avgSim), 0) / rows.length
      : 0;

    const evidenceStrength = clamp(
      (uniqueSources / 10) * 0.4 + (sourceTypeDiversity / 5) * 0.3 + avgSimilarity * 0.3,
      0,
      1,
    );

    const byDocument = rows
      .filter(r => r.documentId)
      .map(r => ({
        documentId: r.documentId!,
        documentName: r.documentName ?? 'Unknown',
        sourceType: r.sourceType ?? 'user_upload',
        citationCount: r.count,
      }));

    const sourceTypeBreakdown: Record<string, number> = {};
    for (const r of rows) {
      const st = r.sourceType ?? 'user_upload';
      sourceTypeBreakdown[st] = (sourceTypeBreakdown[st] ?? 0) + r.count;
    }

    const meta = getSectionMetadata(draft.sectionType);

    return {
      sectionType: draft.sectionType,
      sectionTitle: meta.title,
      draftId: draft.id,
      status: draft.status,
      totalCitations: rows.reduce((sum, r) => sum + r.count, 0),
      evidenceStrength,
      byDocument,
      sourceTypeBreakdown,
    };
  }));

  const coverageGaps = profile.required_sections.filter(
    s => !activeDrafts.some(d => d.sectionType === s),
  );

  // Deduplicate allDocuments
  const docMap = new Map<string, { documentId: string; documentName: string; sourceType: string }>();
  for (const row of sectionRows) {
    for (const d of row.byDocument) {
      docMap.set(d.documentId, { documentId: d.documentId, documentName: d.documentName, sourceType: d.sourceType });
    }
  }
  const allDocuments = Array.from(docMap.values());

  if (format === 'csv') {
    const lines: string[] = ['SectionType,SectionTitle,DocumentName,SourceType,CitationCount,EvidenceStrength'];
    for (const row of sectionRows) {
      if (row.byDocument.length === 0) {
        lines.push(`${row.sectionType},"${row.sectionTitle}",,, 0,${row.evidenceStrength.toFixed(3)}`);
      } else {
        for (const d of row.byDocument) {
          lines.push(`${row.sectionType},"${row.sectionTitle}","${d.documentName}",${d.sourceType},${d.citationCount},${row.evidenceStrength.toFixed(3)}`);
        }
      }
    }
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="traceability-matrix-${id.slice(0, 8)}.csv"`,
      },
    });
  }

  return NextResponse.json({ sections: sectionRows, coverageGaps, allDocuments });
}
