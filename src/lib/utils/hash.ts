import { createHash } from 'crypto';

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function hashFile(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function shortHash(content: string): string {
  return hashContent(content).slice(0, 12);
}
