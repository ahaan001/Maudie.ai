// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { readFile } from 'fs/promises';

export interface ParsedDocument {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    pages: number;
    info?: Record<string, unknown>;
  };
}

export async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  return parsePdfBuffer(buffer);
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer);

  return {
    text: data.text,
    pageCount: data.numpages,
    metadata: {
      title: (data.info as Record<string, string>)?.Title,
      author: (data.info as Record<string, string>)?.Author,
      pages: data.numpages,
      info: data.info as Record<string, unknown>,
    },
  };
}
