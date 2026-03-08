import mammoth from 'mammoth';
import { readFile } from 'fs/promises';

export interface ParsedDocument {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
}

export async function parseDocx(filePath: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  return parseDocxBuffer(buffer);
}

export async function parseDocxBuffer(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    const warnings = result.messages.filter(m => m.type === 'warning');
    if (warnings.length > 0) {
      console.warn('[docx-parser] Warnings:', warnings.map(w => w.message));
    }
  }

  return {
    text: result.value,
    pageCount: 1, // DOCX doesn't expose page count easily
    metadata: {
      format: 'docx',
      warnings: result.messages.length,
    },
  };
}
