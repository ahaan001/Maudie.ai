import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Project creation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('creates a new project and redirects to the project detail page', async ({ page }) => {
    await page.goto('/projects/new');
    await expect(page).toHaveURL('/projects/new');

    // Fill project fields
    await page.getByLabel(/project name/i).fill('E2E Test Device Project');
    await page.getByLabel(/description/i).fill('Created by automated E2E test');

    // Device fields
    await page.getByLabel(/device name/i).fill('TestBot 9000');

    // Submit
    await page.getByRole('button', { name: /create project/i }).click();

    // Should redirect to the project detail page
    await page.waitForURL(/\/projects\/[a-f0-9-]{36}/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/projects\/[a-f0-9-]{36}/);
  });

  test('displays the device name on the project detail page after creation', async ({ page }) => {
    await page.goto('/projects/new');

    await page.getByLabel(/project name/i).fill('E2E Device Name Check');
    await page.getByLabel(/device name/i).fill('MyTestDevice');

    await page.getByRole('button', { name: /create project/i }).click();

    await page.waitForURL(/\/projects\/[a-f0-9-]{36}/, { timeout: 15_000 });

    // Device name should appear in the header area
    await expect(page.getByText('MyTestDevice')).toBeVisible({ timeout: 8_000 });
  });

  test('shows a validation error when the project name is missing', async ({ page }) => {
    await page.goto('/projects/new');

    // Leave project name blank, fill device name
    await page.getByLabel(/device name/i).fill('SomeDevice');
    await page.getByRole('button', { name: /create project/i }).click();

    // Should stay on the new project page (HTML5 required or API validation)
    await expect(page).toHaveURL('/projects/new');
  });
});
