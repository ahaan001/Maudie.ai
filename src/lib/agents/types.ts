export interface AgentJobBase {
  projectId: string;
  triggeredBy?: string;
}

export interface DeviceMetadata {
  name: string;
  category: string;
  intendedUse?: string;
  deviceClass?: string;
  predicateDevice?: string;
  manufacturerName?: string;
  modelNumber?: string;
}

export type SectionType =
  | 'device_description'
  | 'intended_use'
  | 'contraindications'
  | 'risk_assessment_overview'
  | 'failure_mode_summary'
  | 'software_description'
  | 'test_summary'
  | 'dhf_index';

export const SECTION_TITLES: Record<SectionType, string> = {
  device_description: 'Device Description',
  intended_use: 'Intended Use / Indications for Use',
  contraindications: 'Contraindications',
  risk_assessment_overview: 'Risk Assessment Overview',
  failure_mode_summary: 'Failure Mode Summary',
  software_description: 'Software Description',
  test_summary: 'Test Summary',
  dhf_index: 'Design History File Index',
};

// Sections that ALWAYS require human review regardless of risk level
export const MANDATORY_REVIEW_SECTIONS: SectionType[] = [
  'intended_use',
  'contraindications',
];

export type RiskLevel = 'low' | 'medium' | 'high';

export type FlagType =
  | 'UNSUPPORTED_CLAIM'
  | 'MISSING_CITATION'
  | 'AMBIGUOUS_STATEMENT'
  | 'OUTDATED_REFERENCE'
  | 'REGULATORY_RISK_WORDING'
  | 'INCOMPLETE_SECTION';

export interface RedFlag {
  type: FlagType;
  description: string;
  location: string;
  severity: 'warning' | 'error';
}

export interface AgentRunRecord {
  id: string;
  status: 'running' | 'completed' | 'failed';
}
