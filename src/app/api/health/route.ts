import { NextResponse } from 'next/server';
import { checkOllamaHealth } from '@/lib/ollama/client';
import { pool } from '@/lib/db/client';

export async function GET() {
  const [ollamaHealth, dbHealth] = await Promise.allSettled([
    checkOllamaHealth(),
    pool.query('SELECT 1'),
  ]);

  const status = {
    ollama: ollamaHealth.status === 'fulfilled' ? ollamaHealth.value : { healthy: false },
    database: dbHealth.status === 'fulfilled' ? { healthy: true } : { healthy: false },
    timestamp: new Date().toISOString(),
  };

  const allHealthy = status.ollama.healthy && status.database.healthy;
  return NextResponse.json(status, { status: allHealthy ? 200 : 503 });
}
