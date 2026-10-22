import { test, expect, hydrated } from './support/fixtures';

test('admin can log in with seeded credentials', async ({ page }) => {
  await page.goto('/admin/login');
  await hydrated(page);
  await page.locator('input[type="email"]').fill('admin@midiametal.com');
  await page.locator('input[type="password"]').fill('password');
  const response = page.waitForResponse(response => response.url().endsWith('/api/admin/login'));
  await page.getByRole('button', { name: /sign in/i }).click();
  expect((await response).ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Admin Panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByText('Net Collected', { exact: true })).toBeVisible();
});
