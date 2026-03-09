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

export async function parseFile(filePath: string, mimeType: string): Promise<ParsedDocument> {
  // Plain text formats are read directly — no need for Tika overhead
  if (mimeType.startsWith('text/')) {
    return parseText(filePath, mimeType);
  }

  // All binary formats (PDF, DOCX, XLSX, PPTX, DOC, RTF, HTML, etc.) go through Tika
  const { parseWithTika } = await import('./tika');
  return parseWithTika(filePath);
}
