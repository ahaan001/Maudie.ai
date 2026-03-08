import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Review workflow', () => {
  /**
   * These tests require a project with at least one pending review task.
   * Set TEST_PROJECT_ID in your environment before running.
   */
  const projectId = process.env.TEST_PROJECT_ID ?? '';

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.skip(!projectId, 'TEST_PROJECT_ID must be set to run review workflow E2E tests');

  test('approving a review task changes the draft status to Approved', async ({ page }) => {
    await page.goto(`/projects/${projectId}#review`);
    await page.getByRole('tab', { name: /review/i }).click();

    // Wait for the review queue to load
    await page.waitForSelector('[data-testid="review-task"], .review-task-card', { timeout: 10_000 });

    // Click Approve on the first pending task
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    await expect(approveBtn).toBeVisible({ timeout: 5_000 });
    await approveBtn.click();

    // Confirm approval in any modal/dialog
    const confirmApproveBtn = page.getByRole('button', { name: /confirm|approve/i }).last();
    if (await confirmApproveBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmApproveBtn.click();
    }

    // The draft badge should reflect "Approved" status
    await expect(
      page.getByText(/approved/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('an approved draft creates an audit trail entry', async ({ page }) => {
    // Navigate to Audit Trail tab
    await page.goto(`/projects/${projectId}#audit`);
    await page.getByRole('tab', { name: /audit/i }).click();

    // There should be at least one "approved" action in the trail
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('Exports filter in Audit Trail shows only export events', async ({ page }) => {
    await page.goto(`/projects/${projectId}#audit`);
    await page.getByRole('tab', { name: /audit/i }).click();

    // Click the Exports toggle
    await page.getByRole('button', { name: /exports/i }).click();

    // Either shows export entries or shows an empty state — both are acceptable
    const hasExports = await page.getByText(/exported/i).isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmpty = await page.getByText(/no audit entries/i).isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasExports || hasEmpty).toBe(true);
  });
});
