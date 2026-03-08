export interface RegulatoryProfile {
  profile_id: string;
  name: string;
  jurisdiction: string;
  device_category: string;
  device_class_default: string;
  applicable_standards: string[];
  typical_regulatory_pathway: string;
  predicate_search_terms?: string[];
  maude_keywords?: string[];
  required_sections: string[];
  mandatory_review_sections: string[];
  key_guidance_documents?: string[];
  risk_classification_framework?: string;
  software_classification_framework?: string;
  notes?: string[];
}
