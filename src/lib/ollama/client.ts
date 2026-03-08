import { countTokens } from '../utils/token-counter';
import { parseOllamaStreamLine } from './streaming';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'mistral:7b-instruct';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';

export interface GenerateOptions {
  model?: string;
  system?: string;
  prompt: string;
  format?: 'json';
  temperature?: number;
  num_predict?: number;
}

export interface GenerateResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  durationMs: number;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const payload: Record<string, unknown> = {
    model,
    prompt: options.prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
      num_predict: options.num_predict ?? 2048,
    },
  };

  if (options.system) payload.system = options.system;
  if (options.format) payload.format = options.format;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000), // 5 min timeout for slow CPU inference
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama generate failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { response: string; eval_count?: number; prompt_eval_count?: number };

  const inputTokens = data.prompt_eval_count ?? countTokens((options.system ?? '') + options.prompt);
  const outputTokens = data.eval_count ?? countTokens(data.response ?? '');

  return {
    response: data.response ?? '',
    inputTokens,
    outputTokens,
    model,
    durationMs: Date.now() - start,
  };
}

export async function generateStream(
  options: GenerateOptions,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const payload: Record<string, unknown> = {
    model,
    prompt: options.prompt,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.2,
      num_predict: options.num_predict ?? 2048,
    },
  };

  if (options.system) payload.system = options.system;
  if (options.format) payload.format = options.format;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: signal ?? AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama generateStream failed (${res.status}): ${err}`);
  }

  if (!res.body) throw new Error('Ollama streaming response has no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let lineBuffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const parsed = parseOllamaStreamLine(line);
        if (!parsed) continue;

        if (parsed.response) {
          fullResponse += parsed.response;
          onToken(parsed.response);
        }

        if (parsed.done) {
          outputTokens = parsed.evalCount ?? countTokens(fullResponse);
          inputTokens = parsed.promptEvalCount ?? countTokens((options.system ?? '') + options.prompt);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    response: fullResponse,
    inputTokens,
    outputTokens,
    model,
    durationMs: Date.now() - start,
  };
}

export async function embed(text: string, model?: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model ?? EMBED_MODEL,
      prompt: text,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Ollama embed failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

export async function summarize(text: string, targetTokens: number): Promise<string> {
  const result = await generate({
    system: 'You are a precise technical summarizer. Summarize the following content concisely. Preserve all citation IDs (format [CHUNK:id]), key facts, and regulatory references. Do not add new information.',
    prompt: `Summarize to approximately ${targetTokens} tokens, preserving all citations:\n\n${text}`,
    temperature: 0.1,
    num_predict: targetTokens + 200,
  });
  return result.response;
}

export async function checkOllamaHealth(): Promise<{ healthy: boolean; models?: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { healthy: false };
    const data = await res.json() as { models?: Array<{ name: string }> };
    return { healthy: true, models: data.models?.map(m => m.name) ?? [] };
  } catch {
    return { healthy: false };
  }
}
