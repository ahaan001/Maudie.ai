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
  const { parsePdf } = await import('./pdf');
  const { parseDocx } = await import('./docx');

  if (mimeType === 'application/pdf') {
    return parsePdf(filePath);
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDocx(filePath);
  } else {
    return parseText(filePath, mimeType);
  }
}
