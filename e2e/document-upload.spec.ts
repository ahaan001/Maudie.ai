import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import path from 'path';

const TEST_PDF = path.join(__dirname, 'fixtures', 'test.pdf');

test.describe('Document upload', () => {
  /**
   * These tests require a project to already exist.
   * Set TEST_PROJECT_ID in your environment, or create a project first using the API/UI.
   */
  const projectId = process.env.TEST_PROJECT_ID ?? '';

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.skip(!projectId, 'TEST_PROJECT_ID must be set to run document upload E2E tests');

  test('uploaded PDF appears in the documents list', async ({ page }) => {
    await page.goto(`/projects/${projectId}#documents`);

    // Open the Documents tab
    await page.getByRole('tab', { name: /documents/i }).click();

    // Click the upload button
    await page.getByRole('button', { name: /upload/i }).click();

    // Set the file on the file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF);

    // Confirm the upload if there's a confirmation step
    const confirmBtn = page.getByRole('button', { name: /upload|confirm|submit/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // The document should appear in the list within 10 seconds
    await expect(page.getByText('test.pdf')).toBeVisible({ timeout: 10_000 });

    // Status should be pending or processing (ingestion is async)
    const statusBadge = page.locator('[data-testid="doc-status"], .doc-status').first();
    if (await statusBadge.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const status = await statusBadge.textContent();
      expect(['pending', 'processing', 'completed']).toContain(status?.toLowerCase().trim());
    }
  });
});
