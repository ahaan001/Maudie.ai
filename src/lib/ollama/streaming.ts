/**
 * Pure utility functions for Ollama streaming response handling.
 * No Next.js or DB imports — safe to use on client and server.
 */

/**
 * Progressively extract the "content" field value from a partially-accumulated
 * Ollama JSON response. Since Ollama with format:'json' streams the raw JSON
 * object character-by-character, this parser finds the content field and returns
 * only the human-readable prose, hiding the JSON wrapper.
 *
 * Returns empty string until the content field start is found in the buffer.
 */
export function extractDisplayContent(rawBuffer: string): string {
  const marker = '"content": "';
  const start = rawBuffer.indexOf(marker);
  if (start === -1) return '';

  let i = start + marker.length;
  const chars: string[] = [];

  while (i < rawBuffer.length) {
    const ch = rawBuffer[i];

    if (ch === '\\') {
      const next = rawBuffer[i + 1];
      if (next === undefined) break; // incomplete escape — wait for more tokens
      if (next === 'n') chars.push('\n');
      else if (next === 't') chars.push('\t');
      else if (next === 'r') chars.push('\r');
      else if (next === '"') chars.push('"');
      else if (next === '\\') chars.push('\\');
      else chars.push(next);
      i += 2;
    } else if (ch === '"') {
      // Unescaped closing quote — content field is complete
      break;
    } else {
      chars.push(ch);
      i++;
    }
  }

  return chars.join('');
}

export interface OllamaStreamChunk {
  response: string;
  done: boolean;
  evalCount?: number;
  promptEvalCount?: number;
}

/**
 * Parse one newline-delimited JSON line from Ollama's streaming response.
 * Returns null for empty or malformed lines.
 */
export function parseOllamaStreamLine(line: string): OllamaStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      response?: string;
      done?: boolean;
      eval_count?: number;
      prompt_eval_count?: number;
    };
    return {
      response: parsed.response ?? '',
      done: parsed.done ?? false,
      evalCount: parsed.eval_count,
      promptEvalCount: parsed.prompt_eval_count,
    };
  } catch {
    return null;
  }
}
