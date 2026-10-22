import { test, expect, API_BASE } from './support/fixtures';



test('product detail page renders for a real product slug', async ({ page }) => {
  const productsResponse = await fetch(`${API_BASE}/products?page=1`);
  expect(productsResponse.ok).toBeTruthy();

  const productsPayload = await productsResponse.json() as { data?: Array<{ slug?: string | null; name?: string | null }> };
  const product = productsPayload.data?.find((item) => item.slug && item.name);

  expect(product?.slug, 'Expected at least one real product slug from the API').toBeTruthy();

  const response = await page.goto(`/shop/${product!.slug}`, { waitUntil: 'networkidle' });

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: String(product!.name) }).first()).toBeVisible();
});
