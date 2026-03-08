import { generate } from '../../ollama/client';
import { db, pool } from '../../db/client';
import { failureClusters, hazards, riskInputs, agentRuns } from '../../db/schema';
import { logAudit } from '../../audit/logger';
import { eq } from 'drizzle-orm';

const CLUSTER_SYSTEM_PROMPT = `You are a medical device regulatory analyst specializing in adverse event analysis.
Analyze the provided FDA MAUDE event summaries and identify failure mode clusters.

Output valid JSON with EXACTLY this schema:
{
  "clusters": [
    {
      "cluster_name": "Short descriptive name",
      "failure_mode": "mechanical_failure|software_error|user_error|electrical_failure|material_degradation|environmental|other",
      "description": "Detailed description of the failure pattern",
      "event_count": 5,
      "representative_events": ["brief event description 1", "brief event description 2"],
      "hazard": "The underlying hazard",
      "harm": "Type of harm that could result",
      "severity_estimate": "negligible|minor|serious|critical|catastrophic",
      "frequency_estimate": "remote|unlikely|occasional|probable|frequent"
    }
  ],
  "comparable_devices": ["device name 1", "device name 2"],
  "analysis_summary": "2-3 sentence overview of findings"
}`;

export interface MaudeAnalysisJob {
  projectId: string;
  deviceCategory: string;
  keywords: string[];
}

export interface RegulatoryAnalysisResult {
  clusterCount: number;
  hazardCount: number;
  riskInputCount: number;
  agentRunId: string;
}

export async function runRegulatoryIntelligenceAgent(job: MaudeAnalysisJob): Promise<RegulatoryAnalysisResult> {
  const runStart = Date.now();

  const [run] = await db.insert(agentRuns).values({
    projectId: job.projectId,
    agentName: 'RegulatoryIntelligenceAgent',
    jobType: 'analyze_maude',
    status: 'running',
    input: job as unknown as Record<string, unknown>,
    modelUsed: process.env.OLLAMA_MODEL ?? 'mistral:7b-instruct',
  }).returning({ id: agentRuns.id });

  try {
    // Fetch MAUDE events matching keywords (max 50 for token budget)
    const client = await pool.connect();
    let events: Array<{ mdr_report_key: string; device_name: string; event_type: string; report_text: string }> = [];
    try {
      const keywordConditions = job.keywords.map((_, i) =>
        `(LOWER(device_name) LIKE LOWER($${i + 1}) OR LOWER(report_text) LIKE LOWER($${i + 1}))`
      ).join(' OR ');
      const params = job.keywords.map(k => `%${k}%`);

      const result = await client.query(
        `SELECT mdr_report_key, device_name, event_type, LEFT(report_text, 500) as report_text
         FROM regulatory_events
         WHERE ${keywordConditions}
         ORDER BY ingested_at DESC
         LIMIT 50`,
        params
      );
      events = result.rows;
    } finally {
      client.release();
    }

    if (events.length === 0) {
      await db.update(agentRuns).set({
        status: 'completed',
        output: { message: 'No MAUDE events found for keywords', clusterCount: 0 } as Record<string, unknown>,
        durationMs: Date.now() - runStart,
        completedAt: new Date(),
      }).where(eq(agentRuns.id, run.id));

      return { clusterCount: 0, hazardCount: 0, riskInputCount: 0, agentRunId: run.id };
    }

    // Summarize events for LLM (batch in groups of 10 to manage tokens)
    const eventSummaries: string[] = [];
    const batchSize = 10;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchText = batch.map((e, j) =>
        `Event ${i + j + 1}: Device: ${e.device_name ?? 'unknown'} | Type: ${e.event_type ?? 'unknown'} | Report: ${e.report_text ?? 'no text'}`
      ).join('\n\n');

      if (batch.length <= 5) {
        // Small batch: just use text directly
        eventSummaries.push(batchText);
      } else {
        // Summarize larger batch to save tokens
        const sumResult = await generate({
          system: 'Summarize these medical device adverse events into key failure patterns. Be concise.',
          prompt: batchText,
          temperature: 0.1,
          num_predict: 800,
        });
        eventSummaries.push(sumResult.response);
      }
    }

    const combinedSummaries = eventSummaries.join('\n\n---\n\n');

    // Cluster analysis
    const { response, inputTokens, outputTokens } = await generate({
      system: CLUSTER_SYSTEM_PROMPT,
      prompt: `Analyze these FDA MAUDE adverse event summaries for ${job.deviceCategory} devices:\n\n${combinedSummaries}\n\nIdentify failure clusters and generate risk inputs. Output JSON.`,
      format: 'json',
      temperature: 0.15,
      num_predict: 2000,
    });

    let analysis: {
      clusters: Array<{
        cluster_name: string;
        failure_mode: string;
        description: string;
        event_count: number;
        representative_events: string[];
        hazard: string;
        harm: string;
        severity_estimate: string;
        frequency_estimate: string;
      }>;
      comparable_devices: string[];
      analysis_summary: string;
    };

    try {
      const cleaned = response.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      // Minimal fallback
      analysis = { clusters: [], comparable_devices: [], analysis_summary: 'Analysis failed to parse' };
    }

    // Store clusters, hazards, and risk inputs
    let clusterCount = 0;
    let hazardCount = 0;
    let riskInputCount = 0;

    for (const cluster of (analysis.clusters ?? [])) {
      const [fc] = await db.insert(failureClusters).values({
        projectId: job.projectId,
        clusterName: cluster.cluster_name,
        failureMode: cluster.failure_mode,
        description: cluster.description,
        eventCount: cluster.event_count ?? 0,
        representativeEvents: (cluster.representative_events ?? []) as unknown as Record<string, unknown>[],
        agentRunId: run.id,
      }).returning({ id: failureClusters.id });
      clusterCount++;

      // Create hazard record
      const [hazard] = await db.insert(hazards).values({
        projectId: job.projectId,
        description: cluster.hazard ?? cluster.description,
        harm: cluster.harm,
        severity: cluster.severity_estimate,
        probability: cluster.frequency_estimate,
        source: 'ai',
        aiGenerated: true,
      }).returning({ id: hazards.id });
      hazardCount++;

      // Create risk input
      await db.insert(riskInputs).values({
        projectId: job.projectId,
        hazardId: hazard.id,
        sourceEventIds: events.slice(0, 5).map(e => e.mdr_report_key) as unknown as Record<string, unknown>[],
        frequencyEstimate: cluster.frequency_estimate,
        severityEstimate: cluster.severity_estimate,
        aiGenerated: true,
        requiresReview: true,
        agentRunId: run.id,
      });
      riskInputCount++;
    }

    await db.update(agentRuns).set({
      status: 'completed',
      output: { clusterCount, hazardCount, riskInputCount, eventsAnalyzed: events.length } as Record<string, unknown>,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - runStart,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, run.id));

    await logAudit({
      projectId: job.projectId,
      entityType: 'agent_run',
      entityId: run.id,
      action: 'completed',
      actorType: 'agent',
      actorId: 'RegulatoryIntelligenceAgent',
      metadata: { clusterCount, hazardCount, eventsAnalyzed: events.length },
    });

    return { clusterCount, hazardCount, riskInputCount, agentRunId: run.id };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await db.update(agentRuns).set({
      status: 'failed',
      error: errMsg,
      durationMs: Date.now() - runStart,
      completedAt: new Date(),
    }).where(eq(agentRuns.id, run.id));
    throw error;
  }
}
