// Import from the library path directly — avoids pdf-parse v1's test-runner side effect
// which tries to open a non-existent fixture file when requiring the main index.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _pdfParseModule = require('pdf-parse/lib/pdf-parse.js');
// Turbopack wraps CJS modules — unwrap if needed
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, string> }> =
  typeof _pdfParseModule === 'function' ? _pdfParseModule : _pdfParseModule.default;
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
