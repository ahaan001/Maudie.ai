export interface SectionMetadata {
  title: string;
  description: string;
  category: string;
  applicable_standards: string[];
  notes: string[];
}

const SECTION_METADATA: Record<string, SectionMetadata> = {
  device_description: {
    title: 'Device Description',
    description: 'Comprehensive description of the device, its components, and physical characteristics.',
    category: 'Device Description',
    applicable_standards: ['ISO-13485', '21-CFR-820'],
    notes: [],
  },
  intended_use: {
    title: 'Intended Use & Indications',
    description: 'Clear statement of the device intended use, indications for use, and target patient population.',
    category: 'Device Description',
    applicable_standards: ['ISO-13485', '21-CFR-820.30'],
    notes: [],
  },
  contraindications: {
    title: 'Contraindications & Warnings',
    description: 'Conditions under which the device should not be used and associated clinical warnings.',
    category: 'Clinical & Risk',
    applicable_standards: ['ISO-14971'],
    notes: [],
  },
  risk_assessment_overview: {
    title: 'Risk Assessment Overview',
    description: 'Summary of the risk management process per ISO 14971, including risk acceptability criteria.',
    category: 'Clinical & Risk',
    applicable_standards: ['ISO-14971'],
    notes: [],
  },
  failure_mode_summary: {
    title: 'Failure Mode Summary (FMEA)',
    description: 'Identification and analysis of potential failure modes and their effects on device safety.',
    category: 'Clinical & Risk',
    applicable_standards: ['ISO-14971', 'IEC-62304'],
    notes: [],
  },
  software_description: {
    title: 'Software Description',
    description: 'Overview of software architecture, safety classification, and development lifecycle documentation.',
    category: 'Software & Testing',
    applicable_standards: ['IEC-62304', 'IEC-62366-1'],
    notes: [],
  },
  test_summary: {
    title: 'Verification & Validation Summary',
    description: 'Summary of testing activities, test protocols, and results demonstrating device performance.',
    category: 'Software & Testing',
    applicable_standards: ['IEC-62304', '21-CFR-820.30'],
    notes: [],
  },
  dhf_index: {
    title: 'Design History File Index',
    description: 'Index of all design history file documents maintained throughout the device development.',
    category: 'Quality System',
    applicable_standards: ['ISO-13485', '21-CFR-820.30'],
    notes: [],
  },
  clinical_evaluation: {
    title: 'Clinical Evaluation Report',
    description: 'Systematic review of clinical data supporting device safety and performance claims.',
    category: 'Clinical & Risk',
    applicable_standards: ['ISO-14971', 'MEDDEV-2.7.1'],
    notes: [],
  },
  labeling: {
    title: 'Labeling & Instructions for Use',
    description: 'Device labeling including IFU, symbols, and user-facing safety information.',
    category: 'Device Description',
    applicable_standards: ['ISO-15223-1', '21-CFR-801'],
    notes: [],
  },
  biocompatibility: {
    title: 'Biocompatibility Assessment',
    description: 'Evaluation of device materials for biocompatibility per ISO 10993 series.',
    category: 'Clinical & Risk',
    applicable_standards: ['ISO-10993-1'],
    notes: [],
  },
  sterility: {
    title: 'Sterility & Packaging Validation',
    description: 'Validation of sterilization process and packaging integrity.',
    category: 'Quality System',
    applicable_standards: ['ISO-11135', 'ISO-11607'],
    notes: [],
  },
};

const FALLBACK_METADATA: SectionMetadata = {
  title: 'Compliance Section',
  description: 'Required regulatory compliance documentation section.',
  category: 'General',
  applicable_standards: [],
  notes: [],
};

export function getSectionMetadata(key: string): SectionMetadata & { section_key: string } {
  const meta = SECTION_METADATA[key] ?? {
    ...FALLBACK_METADATA,
    title: key
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  };
  return { ...meta, section_key: key };
}

export interface RequirementWithMeta extends SectionMetadata {
  section_key: string;
  status: 'not_started' | 'in_progress' | 'approved';
  draft_id: string | null;
  required: true;
}

export function groupRequirementsByCategory(
  reqs: RequirementWithMeta[]
): Record<string, RequirementWithMeta[]> {
  const grouped: Record<string, RequirementWithMeta[]> = {};
  for (const req of reqs) {
    if (!grouped[req.category]) grouped[req.category] = [];
    grouped[req.category].push(req);
  }
  return grouped;
}
