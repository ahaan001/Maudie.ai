import { describe, it, expect } from 'vitest';
import { canAutoApprove } from '@/lib/agents/hitl';

/**
 * The canAutoApprove function is a pure function that embodies the auto-approval
 * gate used by the orchestrator. These tests verify its decision rules.
 */
describe('canAutoApprove (auto-approval gate)', () => {
  it('returns true for a low-risk section with no flags', () => {
    expect(canAutoApprove('device_description', 'low', 0)).toBe(true);
  });

  it('returns false when riskLevel is "high"', () => {
    expect(canAutoApprove('device_description', 'high', 0)).toBe(false);
  });

  it('returns false when riskLevel is "medium" and there are flags', () => {
    expect(canAutoApprove('device_description', 'medium', 2)).toBe(false);
  });

  it('returns false when flagCount > 0 even at low risk', () => {
    expect(canAutoApprove('device_description', 'low', 1)).toBe(false);
  });

  it('returns false for "intended_use" section (mandatory review), even with low risk and zero flags', () => {
    expect(canAutoApprove('intended_use', 'low', 0)).toBe(false);
  });

  it('returns false for "contraindications" section (mandatory review)', () => {
    expect(canAutoApprove('contraindications', 'low', 0)).toBe(false);
  });

  it('returns false for "risk_benefit_conclusion" section (mandatory review)', () => {
    expect(canAutoApprove('risk_benefit_conclusion', 'low', 0)).toBe(false);
  });

  it('returns false for "substantial_equivalence" section (mandatory review)', () => {
    expect(canAutoApprove('substantial_equivalence', 'low', 0)).toBe(false);
  });

  it('returns false for "safety_class_assignment" section (mandatory review)', () => {
    expect(canAutoApprove('safety_class_assignment', 'low', 0)).toBe(false);
  });

  it('returns true for "test_summary" at low risk with no flags', () => {
    expect(canAutoApprove('test_summary', 'low', 0)).toBe(true);
  });

  it('returns true for "dhf_index" at low risk with no flags', () => {
    expect(canAutoApprove('dhf_index', 'low', 0)).toBe(true);
  });
});
