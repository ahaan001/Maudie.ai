import { readFile } from 'fs/promises';

export interface ParsedDocument {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export async function parseText(filePath: string, mimeType?: string): Promise<ParsedDocument> {
  const content = await readFile(filePath, 'utf-8');
  return parseTextContent(content, mimeType);
}

export function parseTextContent(content: string, mimeType?: string): ParsedDocument {
  return {
    text: content,
    pageCount: 1,
    metadata: {
      format: mimeType ?? 'text/plain',
      characterCount: content.length,
      lineCount: content.split('\n').length,
    },
  };
}

const PDF_TYPES = new Set(['application/pdf']);
const DOCX_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export async function parseFile(filePath: string, mimeType: string): Promise<ParsedDocument> {
  // Plain text formats are read directly
  if (mimeType.startsWith('text/')) {
    return parseText(filePath, mimeType);
  }

  // PDF — use local pdf-parse (no external service required)
  if (PDF_TYPES.has(mimeType)) {
    const { parsePdf } = await import('./pdf');
    const result = await parsePdf(filePath);
    return { text: result.text, pageCount: result.pageCount, metadata: result.metadata };
  }

  // DOCX / DOC — use local mammoth (no external service required)
  if (DOCX_TYPES.has(mimeType)) {
    const { parseDocx } = await import('./docx');
    return parseDocx(filePath);
  }

  // All other binary formats (xlsx, pptx, odt, rtf, etc.) are not yet supported
  throw new Error(
    `File format "${mimeType}" is not supported for ingestion. Supported formats: PDF, DOCX, DOC, and plain text (TXT, MD, CSV, HTML).`
  );
}
