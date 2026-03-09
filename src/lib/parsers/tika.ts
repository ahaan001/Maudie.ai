import { readFile } from 'fs/promises';

export interface ParsedDocument {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

const TIKA_URL = process.env.TIKA_URL ?? 'http://localhost:9998';

/**
 * Extract text and metadata from any document type using Apache Tika.
 * Handles PDF, DOCX, XLSX, PPTX, ODT, RTF, HTML, and 1000+ other formats.
 */
export async function parseWithTika(filePath: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);

  // Run text extraction and metadata fetch in parallel
  const [textRes, metaRes] = await Promise.all([
    fetch(`${TIKA_URL}/tika`, {
      method: 'PUT',
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    }),
    fetch(`${TIKA_URL}/meta`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    }),
  ]);

  if (!textRes.ok) {
    throw new Error(`Tika text extraction failed: HTTP ${textRes.status} from ${TIKA_URL}`);
  }

  const text = await textRes.text();
  const meta: Record<string, unknown> = metaRes.ok ? await metaRes.json() : {};

  // Tika reports page count under different keys depending on format
  const rawPageCount =
    meta['xmpTPg:NPages'] ??
    meta['meta:page-count'] ??
    meta['Page-Count'] ??
    meta['pdf:PDFVersion'] ? undefined : // don't misuse pdf version as page count
    meta['page-count'] ??
    '1';
  const pageCount = Math.max(1, parseInt(String(rawPageCount), 10) || 1);

  return {
    text: text.trim(),
    pageCount,
    metadata: meta,
  };
}
