import { test, expect, hydrated } from './support/fixtures';
import type { Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await hydrated(page);
  const accept = page.getByRole('button', { name: 'Accept All' });
  if (await accept.isVisible()) await accept.click();
  await page.getByLabel('Email address').fill('asd@asd.com');
  await page.getByLabel('Password *', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Order History' })).toBeVisible();
}

test('customer can log in and retain the session after reload', async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order History' })).toBeVisible();
});

test('customer can log out and cannot revisit the protected account', async ({ page }) => {
  await login(page);
  const response = page.waitForResponse(response => response.url().endsWith('/api/v1/customer/logout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Logout' }).click();
  expect((await response).ok()).toBe(true);
  await expect(page).toHaveURL('/');
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login$/);
});
