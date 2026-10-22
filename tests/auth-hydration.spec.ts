import { test, expect, seedCheckout, mockCheckoutApi, customer, hydrated } from './support/fixtures';

test.describe('Auth hydration', () => {
  test('fresh authenticated checkout hydrates customer fields', async ({ page }) => {
    await mockCheckoutApi(page, true);
    await seedCheckout(page, false);
    await page.goto('/checkout');
    await hydrated(page);
    await expect(page.getByRole('heading', { name: 'Contact Details' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue(customer.email);
  });

  test('fresh payment load waits for customer hydration before fetching saved payment methods', async ({ page }) => {
    await mockCheckoutApi(page, true);
    await seedCheckout(page);
    let releaseProfile!: () => void;
    const profileReady = new Promise<void>(resolve => { releaseProfile = resolve; });
    let profileRequested = false;
    let paymentMethodsCalls = 0;
    await page.route('**/api/v1/customer/me', async route => {
      profileRequested = true;
      await profileReady;
      await route.fulfill({ json: customer });
    });
    await page.route('**/api/v1/customer/payment-methods', async route => {
      paymentMethodsCalls++;
      await route.fulfill({ json: [] });
    });
    await page.goto('/payment');
    await expect.poll(() => profileRequested).toBe(true);
    expect(paymentMethodsCalls).toBe(0);
    await expect(page.getByText('Loading payment details...')).toBeVisible();
    releaseProfile();
    await expect.poll(() => paymentMethodsCalls).toBe(1);
    await expect(page.getByRole('heading', { name: 'Payment Method' })).toBeVisible();
    await expect(page).toHaveURL(/\/payment$/);
  });

  test('incomplete checkout data returns to checkout before payment setup', async ({ page }) => {
    await mockCheckoutApi(page);
    await seedCheckout(page);
    await page.addInitScript(() => {
      const form = JSON.parse(sessionStorage.getItem('checkoutForm')!);
      form.email = '';
      sessionStorage.setItem('checkoutForm', JSON.stringify(form));
    });
    let setups = 0;
    page.on('request', request => { if (request.url().endsWith('/payment/intent')) setups++; });
    await page.goto('/payment');
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { name: 'Contact Details' })).toBeVisible();
    expect(setups).toBe(0);
  });
});
