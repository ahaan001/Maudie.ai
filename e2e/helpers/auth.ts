import type { Page } from '@playwright/test';

/**
 * Log in with the given credentials.
 * Set TEST_USER_EMAIL / TEST_USER_PASSWORD in your environment before running E2E tests.
 */
export async function login(
  page: Page,
  email = process.env.TEST_USER_EMAIL ?? 'admin@maudie.ai',
  password = process.env.TEST_USER_PASSWORD ?? 'testpassword123',
) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}
