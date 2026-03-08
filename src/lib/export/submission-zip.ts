import JSZip from 'jszip';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from 'docx';
import type { SubmissionSection, SubmissionHazard, SubmissionAuditEntry } from './submission-pdf';

export interface ZipData {
  projectName: string;
  deviceName: string;
  sections: SubmissionSection[];
  hazards: SubmissionHazard[];
  auditEntries: SubmissionAuditEntry[];
  generatedAt: string;
}

const ECTD_MODULE: Record<string, string> = {
  device_description: 'm2-overview',
  intended_use: 'm2-overview',
  contraindications: 'm2-overview',
  risk_assessment_overview: 'm3-quality',
  failure_mode_summary: 'm3-quality',
  software_description: 'm3-quality',
  test_summary: 'm3-quality',
  dhf_index: 'm3-quality',
  biocompatibility: 'm3-quality',
  sterility: 'm3-quality',
  labeling: 'm3-quality',
  clinical_evaluation: 'm5-clinical',
};

async function buildSectionDocx(section: SubmissionSection): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '' }),
  ];

  if (section.confidenceScore != null) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `AI-generated · Confidence: ${Math.round(section.confidenceScore * 100)}% · ${section.citations.length} citation(s)`,
            italics: true,
            color: '888888',
            size: 16,
          }),
        ],
      }),
      new Paragraph({ text: '' })
    );
  }

  // Content paragraphs (split by double newline)
  for (const para of section.content.split('\n\n').filter(p => p.trim())) {
    children.push(new Paragraph({ text: para.trim() }));
    children.push(new Paragraph({ text: '' }));
  }

  if (section.citations.length > 0) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Supporting Evidence', heading: HeadingLevel.HEADING_2 })
    );
    for (const c of section.citations) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `• ${c.documentName}`, bold: true }),
          ],
        })
      );
      if (c.textExcerpt) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `  ${c.textExcerpt.slice(0, 300)}${c.textExcerpt.length > 300 ? '…' : ''}`,
                italics: true,
                color: '666666',
                size: 16,
              }),
            ],
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

function buildTraceabilityCsv(sections: SubmissionSection[]): string {
  const rows = ['SectionType,SectionTitle,DocumentName,CitationCount'];
  for (const s of sections) {
    const docCounts: Record<string, number> = {};
    for (const c of s.citations) {
      docCounts[c.documentName] = (docCounts[c.documentName] ?? 0) + 1;
    }
    if (Object.keys(docCounts).length === 0) {
      rows.push(`${s.sectionType},"${s.title}",,0`);
    } else {
      for (const [doc, count] of Object.entries(docCounts)) {
        rows.push(`${s.sectionType},"${s.title}","${doc}",${count}`);
      }
    }
  }
  return rows.join('\n');
}

function buildAuditCsv(entries: SubmissionAuditEntry[]): string {
  const rows = ['action,actor_type,actor_id,timestamp'];
  for (const e of entries) {
    rows.push(`${e.action},${e.actorType},"${e.actorId}",${e.timestamp}`);
  }
  return rows.join('\n');
}

export async function buildSubmissionZip(data: ZipData, format: 'zip' | 'ectd'): Promise<Buffer> {
  const zip = new JSZip();
  const dateStr = new Date(data.generatedAt).toISOString().slice(0, 10);
  const root = format === 'ectd'
    ? zip.folder(`ectd-${dateStr}`)!
    : zip.folder(`submission-${dateStr}`)!;

  if (format === 'ectd') {
    // Create module folders
    root.folder('m1-administrative');
    root.folder('m2-overview');
    root.folder('m3-quality');
    root.folder('m5-clinical');
  }

  // Add each section as a .docx
  for (const section of data.sections) {
    const docxBuffer = await buildSectionDocx(section);
    const filename = `${section.sectionType}.docx`;
    if (format === 'ectd') {
      const module = ECTD_MODULE[section.sectionType] ?? 'm3-quality';
      root.folder(module)!.file(filename, docxBuffer);
    } else {
      root.file(filename, docxBuffer);
    }
  }

  // Add traceability CSV
  root.file('traceability-matrix.csv', buildTraceabilityCsv(data.sections));

  // Add audit trail CSV
  root.file('audit-trail.csv', buildAuditCsv(data.auditEntries));

  // Add README
  const readme = [
    `Submission Package`,
    `==================`,
    `Project: ${data.projectName}`,
    `Device: ${data.deviceName}`,
    `Format: ${format.toUpperCase()}`,
    `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
    `Sections: ${data.sections.length}`,
    ``,
    `Files included:`,
    ...data.sections.map(s => `  ${s.sectionType}.docx — ${s.title}`),
    `  traceability-matrix.csv`,
    `  audit-trail.csv`,
    ``,
    `Generated by Maudie · Compliance-as-a-Service`,
  ].join('\n');
  root.file('README.txt', readme);

  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>;
}
