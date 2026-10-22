import { test, expect } from './support/fixtures';

async function mockAdminApi(page: import('@playwright/test').Page) {
  // Mock essential endpoints for admin
  await page.route('**/api/admin/me', async route => {
    await route.fulfill({
      status: 200,
      json: { id: 1, name: 'Admin', email: 'admin@midiametal.com' }
    });
  });

  await page.route('**/api/admin/dashboard', async route => {
    await route.fulfill({
      status: 200,
      json: {
        stats: { monthly_revenue: 125, total_products: 3, pending_orders: 1, unread_messages: 0 },
        payments: { net_collected: 125, pending_payments: 50, completed_refunds: 25, unreconciled_orders: 0 },
        period: { label: 'October 2026', start: '2026-10-01', end: '2026-10-31', basis: 'order_created_at' },
        recent_orders: [], recent_messages: [],
      }
    });
  });

  await page.route('**/api/admin/stats/top-products', async route => {
    await route.fulfill({
      status: 200,
      json: []
    });
  });

  await page.route('**/api/admin/products*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0 }
    });
  });

  await page.route('**/api/admin/product-category-list', async route => {
    await route.fulfill({
      status: 200,
      json: []
    });
  });
}

test('authenticated admin can open dashboard route', async ({ page }) => {
  await mockAdminApi(page);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Admin Panel')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Payments · October 2026' })).toBeVisible();
  await expect(page.getByText('£125.00', { exact: true })).toBeVisible();
});

test('authenticated admin can open nested dashboard route', async ({ page }) => {
  await mockAdminApi(page);

  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Coming Soon')).toHaveCount(0);
  await expect(page.getByText('Net Collected', { exact: true })).toBeVisible();
});

test('authenticated admin can open products route', async ({ page }) => {
  await mockAdminApi(page);

  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /add product/i })).toBeVisible({ timeout: 10000 });
});
