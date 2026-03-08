import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { hazards, riskControls, projects, devices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireProjectSession } from '@/lib/auth/permissions';
import { renderToBuffer, Document } from '@react-pdf/renderer';
import React, { createElement } from 'react';
import { RiskPdfDocument } from '@/components/project/risk/RiskPdfDocument';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try { await requireProjectSession(id); } catch (res) { return res as Response; }

  try {
    const pid = id as `${string}-${string}-${string}-${string}-${string}`;

    const [project] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
    const [device] = await db.select().from(devices).where(eq(devices.projectId, pid)).limit(1);
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

    const hazardsWithControls = allHazards.map((h, idx) => {
      const iS = h.initialSeverity ?? 0;
      const iP = h.initialProbability ?? 0;
      const rS = h.residualSeverity ?? 0;
      const rP = h.residualProbability ?? 0;
      return {
        ...h,
        number: idx + 1,
        initialRpr: iS && iP ? iS * iP : null,
        residualRpr: rS && rP ? rS * rP : null,
        controls: controlsByHazard.get(h.id) ?? [],
      };
    });

    const element = createElement(RiskPdfDocument, {
      project: project ?? { name: 'Unknown Project', deviceCategory: '', jurisdiction: '' },
      device: device ?? null,
      hazards: hazardsWithControls,
      generatedAt: new Date().toISOString(),
    }) as React.ReactElement<React.ComponentProps<typeof Document>>;

    const pdfBuffer = await renderToBuffer(element);
    const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer;

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="risk-management-file-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/projects/:id/risk/export]', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
