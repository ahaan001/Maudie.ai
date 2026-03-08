import type { SectionType, DeviceMetadata } from '../types';

export const DRAFTING_SYSTEM_PROMPT = `You are a regulatory documentation specialist for FDA medical device submissions. You generate technically accurate, traceable draft sections for regulatory documentation.

STRICT RULES:
1. Cite every factual claim with the chunk ID using format [CITE:chunk_id] where chunk_id appears in the provided context
2. Label AI-generated narrative with [GENERATED] prefix
3. Label facts extracted directly from provided sources with [FROM_SOURCE] prefix
4. If you cannot support a claim with provided context, write [UNSUPPORTED: description] — NEVER fabricate
5. Output valid JSON matching exactly this schema:
{
  "content": "The full draft text with citations and labels",
  "confidence_score": 0.0-1.0,
  "citations": ["chunk_id_1", "chunk_id_2"],
  "unsupported_claims": ["description of any unsupported claims"],
  "section_summary": "1-2 sentence summary"
}

Confidence score rules:
- 0.9+ : All claims cited, 5+ citations, complete coverage
- 0.7-0.9: Most claims cited, 2-4 citations, good coverage
- 0.5-0.7: Some gaps, 1-2 citations
- <0.5: Significant gaps, cannot adequately support section`;

export function buildDraftingPrompt(params: {
  sectionType: SectionType;
  deviceMetadata: DeviceMetadata;
  context: string;
  regulatoryProfile: string;
}): string {
  const guidanceMap: Record<SectionType, string> = {
    device_description: 'FDA 21 CFR 807.87(e), describe device components, materials, principles of operation, and performance specifications',
    intended_use: 'FDA guidance on Indications for Use (21 CFR 801.4); be precise about patient population, clinical condition, and anatomical site',
    contraindications: 'List conditions where device should NOT be used; be specific about patient populations, conditions, and risk factors',
    risk_assessment_overview: 'ISO 14971:2019 framework; identify hazards, hazardous situations, harms, and initial risk estimates',
    failure_mode_summary: 'Summarize identified failure modes with references to MAUDE data and comparable device analysis',
    software_description: 'IEC 62304 framework; describe software architecture, safety classification, and lifecycle approach',
    test_summary: 'Summarize completed testing: performance, biocompatibility, electrical safety, EMC, software validation',
    dhf_index: 'List all Design History File documents with document ID, title, version, date, and status',
  };

  return `CONTEXT FROM KNOWLEDGE BASE:
${params.context}

DEVICE INFORMATION:
- Name: ${params.deviceMetadata.name}
- Category: ${params.deviceMetadata.category}
- Intended Use: ${params.deviceMetadata.intendedUse ?? 'Not specified'}
- Device Class: ${params.deviceMetadata.deviceClass ?? 'Not specified'}
- Regulatory Profile: ${params.regulatoryProfile}

TASK:
Draft the "${params.sectionType.replace(/_/g, ' ').toUpperCase()}" section.
Guidance: ${guidanceMap[params.sectionType] ?? 'Follow applicable FDA guidance'}

Remember: Only use information from the provided context. Mark all unsupported claims clearly.
Output valid JSON only.`;
}
