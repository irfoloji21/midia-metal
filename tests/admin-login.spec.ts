import { test, expect, hydrated } from './support/fixtures';

test('admin can log in with seeded credentials', async ({ page }) => {
  await page.goto('/admin/login');
  await hydrated(page);
  const email = page.getByLabel('Email Address', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  // Fields intentionally stay read-only until the user enters them.
  await email.click();
  await email.fill('admin@midiametal.com');
  await password.click();
  await password.fill('password');
  const response = page.waitForResponse(response => response.url().endsWith('/api/admin/login'));
  await page.getByRole('button', { name: /sign in/i }).click();
  expect((await response).ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Admin Panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByText('Net Collected', { exact: true })).toBeVisible();
});
