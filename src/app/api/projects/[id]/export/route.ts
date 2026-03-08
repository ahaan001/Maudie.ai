import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import {
  projects, devices, generatedDrafts, draftSections, citations,
  documents, projectRequirements, reviewTasks, hazards, riskControls, auditLog,
} from '@/lib/db/schema';
import { eq, and, inArray, desc, notInArray, sql } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/logger';
import { getSectionMetadata } from '@/lib/section-metadata';
import { storeTempFile } from '@/lib/export/temp-store';
import { buildSubmissionZip } from '@/lib/export/submission-zip';
import { SubmissionPdfDocument } from '@/lib/export/submission-pdf';
import { renderToBuffer } from '@react-pdf/renderer';
import React, { createElement } from 'react';
import type { Document as PdfDocument } from '@react-pdf/renderer';
import crypto from 'crypto';

type UUIDString = `${string}-${string}-${string}-${string}-${string}`;

const TERMINAL_REVIEW_STATUSES = ['approved', 'auto_approved', 'rejected'];

async function getExportGate(projectId: string) {
  const pid = projectId as UUIDString;

  // Compliance score
  const reqRows = await db
    .select({ status: projectRequirements.status, count: sql<number>`cast(count(*) as int)` })
    .from(projectRequirements)
    .where(eq(projectRequirements.projectId, pid))
    .groupBy(projectRequirements.status);

  const totalRequired = reqRows.reduce((s, r) => s + r.count, 0);
  const approvedCount = reqRows.find(r => r.status === 'approved')?.count ?? 0;
  const score = totalRequired > 0 ? Math.round((approvedCount / totalRequired) * 100) : 0;

  // High-risk unapproved review tasks
  const highRiskPending = await db
    .select({ id: reviewTasks.id })
    .from(reviewTasks)
    .where(and(
      eq(reviewTasks.projectId, pid),
      eq(reviewTasks.riskLevel, 'high'),
      notInArray(reviewTasks.status, TERMINAL_REVIEW_STATUSES)
    ));

  // Section status for checklist
  const reqs = await db
    .select({
      sectionKey: projectRequirements.sectionKey,
      status: projectRequirements.status,
    })
    .from(projectRequirements)
    .where(eq(projectRequirements.projectId, pid));

  const sections = reqs.map(r => {
    const meta = getSectionMetadata(r.sectionKey);
    return { sectionKey: r.sectionKey, title: meta.title, status: r.status, required: true };
  });

  const blockers: string[] = [];
  if (score < 80) blockers.push(`Compliance score is ${score}% — minimum 80% required to export`);
  if (highRiskPending.length > 0) {
    blockers.push(`${highRiskPending.length} high-risk section(s) pending review must be resolved before export`);
  }

  return { score, sections, blockers };
}

/** GET — preflight check for ExportModal */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  try {
    const gate = await getExportGate(id);
    return NextResponse.json({ ok: gate.blockers.length === 0, ...gate });
  } catch (err) {
    console.error('[GET /api/projects/:id/export]', err);
    return NextResponse.json({ error: 'Preflight check failed' }, { status: 500 });
  }
}

/** POST — SSE streaming export generation */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let session;
  try { session = await requireProjectSession(id); } catch (res) { return res as Response; }

  let format: 'pdf' | 'zip' | 'ectd';
  try {
    const body = await req.json();
    if (!['pdf', 'zip', 'ectd'].includes(body.format)) throw new Error('invalid format');
    format = body.format as 'pdf' | 'zip' | 'ectd';
  } catch {
    return NextResponse.json({ error: 'Invalid request: format must be pdf, zip, or ectd' }, { status: 400 });
  }

  // Gate check — synchronous before opening stream
  const gate = await getExportGate(id);
  if (gate.blockers.length > 0) {
    return NextResponse.json({ error: 'Export blocked', blockers: gate.blockers }, { status: 422 });
  }

  const encoder = new TextEncoder();
  function encodeSSE(event: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      function enqueue(event: Record<string, unknown>) {
        try { controller.enqueue(encodeSSE(event)); } catch { /* client disconnected */ }
      }

      try {
        const pid = id as UUIDString;

        // ── Stage 1: Compile ──────────────────────────────────────────────
        enqueue({ type: 'stage', stage: 'compiling', message: 'Compiling approved sections...' });

        const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
        const [device] = await db.select().from(devices).where(eq(devices.projectId, pid)).limit(1);

        // Approved drafts
        const approvedDrafts = await db.select().from(generatedDrafts)
          .where(and(eq(generatedDrafts.projectId, pid), eq(generatedDrafts.status, 'approved')));

        const draftIds = approvedDrafts.map(d => d.id as UUIDString);

        // Sections + citations (only if we have approved drafts)
        type SectionRow = typeof draftSections.$inferSelect;
        type CitationRow = { id: string; draftId: string; sectionId: string; documentId: string; textExcerpt: string | null; documentName: string | null };

        let allSections: SectionRow[] = [];
        let allCitations: CitationRow[] = [];

        if (draftIds.length > 0) {
          allSections = await db.select().from(draftSections)
            .where(inArray(draftSections.draftId, draftIds));

          const citationRows = await db
            .select({
              id: citations.id,
              draftId: citations.draftId,
              sectionId: citations.sectionId,
              documentId: citations.documentId,
              textExcerpt: citations.textExcerpt,
              documentName: documents.name,
            })
            .from(citations)
            .leftJoin(documents, eq(citations.documentId, documents.id))
            .where(inArray(citations.draftId, draftIds));

          allCitations = citationRows;
        }

        // Build sections for export (one per approved draft, using first section's content)
        const sectionsByDraft = new Map<string, SectionRow>();
        for (const s of allSections) {
          if (!sectionsByDraft.has(s.draftId)) sectionsByDraft.set(s.draftId, s);
        }

        const citationsByDraft = new Map<string, CitationRow[]>();
        for (const c of allCitations) {
          const list = citationsByDraft.get(c.draftId) ?? [];
          list.push(c);
          citationsByDraft.set(c.draftId, list);
        }

        // Order by regulatory profile section order
        const SECTION_ORDER = [
          'device_description', 'intended_use', 'contraindications',
          'risk_assessment_overview', 'failure_mode_summary', 'software_description',
          'test_summary', 'dhf_index', 'clinical_evaluation', 'labeling',
          'biocompatibility', 'sterility',
        ];
        const sortedDrafts = [...approvedDrafts].sort((a, b) => {
          const ai = SECTION_ORDER.indexOf(a.sectionType);
          const bi = SECTION_ORDER.indexOf(b.sectionType);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });

        const exportSections = sortedDrafts.map(draft => {
          const section = sectionsByDraft.get(draft.id);
          const meta = getSectionMetadata(draft.sectionType);
          const draftCitations = citationsByDraft.get(draft.id) ?? [];
          return {
            sectionType: draft.sectionType,
            title: draft.title ?? meta.title,
            content: section?.content ?? '',
            confidenceScore: section?.confidenceScore ?? null,
            citations: draftCitations.map(c => ({
              documentName: c.documentName ?? 'Unknown',
              textExcerpt: c.textExcerpt,
            })),
          };
        });

        // Hazards
        const allHazards = await db.select().from(hazards)
          .where(eq(hazards.projectId, pid))
          .orderBy(desc(hazards.createdAt));
        const allControls = await db.select().from(riskControls)
          .where(eq(riskControls.projectId, pid));
        const controlsByHazard = new Map<string, typeof allControls>();
        for (const c of allControls) {
          const list = controlsByHazard.get(c.hazardId) ?? [];
          list.push(c);
          controlsByHazard.set(c.hazardId, list);
        }
        const exportHazards = allHazards.map((h, idx) => ({
          number: idx + 1,
          description: h.description,
          harm: h.harm ?? '',
          riskLevel: h.riskLevel ?? 'medium',
          initialRpr: h.initialSeverity && h.initialProbability ? h.initialSeverity * h.initialProbability : null,
          residualRpr: h.residualSeverity && h.residualProbability ? h.residualSeverity * h.residualProbability : null,
          riskStatus: h.riskStatus ?? 'open',
        }));

        // Audit entries
        const auditEntries = await db.select().from(auditLog)
          .where(eq(auditLog.projectId, pid))
          .orderBy(desc(auditLog.timestamp))
          .limit(20);

        const exportAudit = auditEntries.map(e => ({
          action: e.action,
          actorType: e.actorType,
          actorId: e.actorId,
          timestamp: e.timestamp?.toISOString() ?? new Date().toISOString(),
        }));

        // ── Stage 2: Generate ─────────────────────────────────────────────
        enqueue({ type: 'stage', stage: 'generating', message: `Generating ${format.toUpperCase()}...` });

        const dateStr = new Date().toISOString().slice(0, 10);
        const safeName = (project?.name ?? 'project').replace(/[^a-z0-9]/gi, '-').slice(0, 20).toLowerCase();

        let buffer: Buffer;
        let filename: string;

        if (format === 'pdf') {
          filename = `submission-${safeName}-${dateStr}.pdf`;
          const element = createElement(SubmissionPdfDocument, {
            project: {
              name: project?.name ?? 'Project',
              jurisdiction: project?.jurisdiction ?? 'fda_us',
              deviceCategory: project?.deviceCategory ?? '',
            },
            device: device ? {
              name: device.name,
              manufacturerName: device.manufacturerName ?? null,
              deviceClass: device.deviceClass ?? null,
            } : null,
            sections: exportSections,
            hazards: exportHazards,
            auditSummary: exportAudit,
            generatedAt: new Date().toISOString(),
          }) as React.ReactElement<React.ComponentProps<typeof PdfDocument>>;
          const pdfBuf = await renderToBuffer(element);
          buffer = Buffer.from(pdfBuf.buffer, pdfBuf.byteOffset, pdfBuf.byteLength);
        } else {
          filename = `submission-${safeName}-${format}-${dateStr}.zip`;
          buffer = await buildSubmissionZip({
            projectName: project?.name ?? 'Project',
            deviceName: device?.name ?? 'Device',
            sections: exportSections,
            hazards: exportHazards,
            auditEntries: exportAudit,
            generatedAt: new Date().toISOString(),
          }, format);
        }

        // ── Stage 3: Finalize ─────────────────────────────────────────────
        enqueue({ type: 'stage', stage: 'finalizing', message: 'Finalizing...' });

        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        const token = storeTempFile(buffer, filename);

        await logAudit({
          projectId: id,
          entityType: 'submission_export',
          entityId: id as UUIDString,
          action: 'exported',
          actorType: 'human',
          actorId: session.user.userId,
          contentHash: hash,
          metadata: {
            format,
            sectionCount: exportSections.length,
            fileSize: buffer.length,
            filename,
          },
        });

        enqueue({ type: 'complete', token, filename, hash });

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed';
        enqueue({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
