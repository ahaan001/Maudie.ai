import { describe, it, expect } from 'vitest';

/**
 * Pure unit tests for the compliance score calculation formula.
 * Formula from /api/projects/[id]/compliance-score route:
 *   score = totalRequired > 0 ? Math.round((approvedCount / totalRequired) * 100) : 0
 */
function calcScore(approved: number, inProgress: number, notStarted: number): number {
  const total = approved + inProgress + notStarted;
  return total > 0 ? Math.round((approved / total) * 100) : 0;
}

describe('compliance score calculation', () => {
  it('returns 100 when all sections are approved', () => {
    expect(calcScore(8, 0, 0)).toBe(100);
  });

  it('returns 0 when no sections are approved', () => {
    expect(calcScore(0, 4, 4)).toBe(0);
  });

  it('returns 0 when there are no requirements at all', () => {
    expect(calcScore(0, 0, 0)).toBe(0);
  });

  it('returns 50 when half the sections are approved', () => {
    expect(calcScore(4, 4, 0)).toBe(50);
  });

  it('rounds the score to the nearest integer', () => {
    // 1 approved out of 3 = 33.333... → rounds to 33
    expect(calcScore(1, 1, 1)).toBe(33);
  });

  it('includes in_progress sections in the denominator but not the numerator', () => {
    // 2 approved, 3 in_progress, 5 not_started → 2/10 = 20%
    expect(calcScore(2, 3, 5)).toBe(20);
  });

  it('caps at 100 when all required sections are approved', () => {
    expect(calcScore(10, 0, 0)).toBe(100);
  });
});
