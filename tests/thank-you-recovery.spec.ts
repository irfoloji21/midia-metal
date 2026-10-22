import { test, expect, confirmation } from './support/fixtures';

const credentials = { order: 'ORD-BANK-123', token: 'valid+token&value' };
const query = new URLSearchParams(credentials).toString();

test('restores stored confirmation credentials and fetches authoritative order details', async ({ page }) => {
  let calls = 0;
  await page.addInitScript(value => {
    sessionStorage.setItem('orderConfirmation', JSON.stringify(value));
    sessionStorage.setItem('lastOrder', JSON.stringify({ orderDetails: { orderNumber: 'UNVERIFIED', total: '£999.99' } }));
  }, credentials);
  await page.route('**/api/v1/orders/confirmation?*', async route => {
    calls++;
    const params = new URL(route.request().url()).searchParams;
    expect(Object.fromEntries(params)).toEqual(credentials);
    await route.fulfill({ json: { ...confirmation, payment_status: 'paid' } });
  });
  await page.goto('/thank-you');
  await expect(page.locator('#order-number')).toHaveText('ORD-BANK-123');
  await expect(page.locator('#order-items')).toHaveText('Steel Beam × 2');
  await expect(page.locator('#order-total')).toHaveText('£56.50');
  await expect(page.locator('#order-payment-status')).toHaveText('Payment received');
  await expect(page.getByText('UNVERIFIED')).toHaveCount(0);
  expect(calls).toBe(1);
});

test('direct confirmation links remove credentials from the address bar and survive reload', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/orders/confirmation?*', async route => {
    calls++;
    expect(Object.fromEntries(new URL(route.request().url()).searchParams)).toEqual(credentials);
    await route.fulfill({ json: { ...confirmation, payment_method: 'card', payment_status: 'paid' } });
  });
  await page.goto(`/thank-you?${query}`);
  await expect(page.locator('#order-payment-status')).toHaveText('Payment received');
  await expect(page.locator('#payment-method')).toHaveText('Credit / Debit Card');
  await expect(page).toHaveURL(/\/thank-you$/);
  await page.reload();
  await expect(page.locator('#order-number')).toHaveText('ORD-BANK-123');
  expect(calls).toBe(2);
  await expect(page.locator('#refresh-payment-status')).toBeHidden();
});

test('failed confirmation lookup shows recovery and can be retried', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/orders/confirmation?*', async route => {
    calls++;
    await route.fulfill(calls === 1
      ? { status: 403, json: { message: 'Invalid confirmation token.' } }
      : { json: { ...confirmation, payment_status: 'paid' } });
  });
  await page.goto(`/thank-you?${query}`);
  await expect(page.locator('#order-payment-status')).toHaveText('We could not load your order details. Please try again or refer to your confirmation email.');
  await page.locator('#refresh-payment-status').click();
  await expect(page.locator('#order-payment-status')).toHaveText('Payment received');
  expect(calls).toBe(2);
});

test('pending transfer details disappear after payment is received', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/orders/confirmation?*', async route => {
    calls++;
    await route.fulfill({ json: { ...confirmation, payment_status: calls === 1 ? 'pending' : 'paid' } });
  });
  await page.goto(`/thank-you?${query}`);
  await expect(page.locator('#order-payment-status')).toHaveText('Awaiting payment');
  await expect(page.locator('#stripe-transfer-details')).toBeVisible();
  await expect(page.locator('#transfer-fields')).toContainText('£56.50');
  await expect(page.locator('#stripe-transfer-link')).toHaveAttribute('href', confirmation.bank_transfer_details.hosted_instructions_url);
  await page.locator('#refresh-payment-status').click();
  await expect(page.locator('#order-payment-status')).toHaveText('Payment received');
  await expect(page.locator('#stripe-transfer-details')).toBeHidden();
  await expect(page.locator('#refresh-payment-status')).toBeHidden();
});

test('legacy cached order details alone cannot stand in for a verified confirmation', async ({ page }) => {
  let calls = 0;
  await page.addInitScript(() => sessionStorage.setItem('lastOrder', JSON.stringify({ orderDetails: { orderNumber: 'UNVERIFIED' } })));
  await page.route('**/api/v1/orders/confirmation?*', async route => { calls++; await route.abort(); });
  await page.goto('/thank-you');
  await expect(page.locator('#order-payment-status')).toHaveText('Order details are unavailable. Please use your confirmation email or sign in to your account.');
  await expect(page.getByText('UNVERIFIED')).toHaveCount(0);
  expect(calls).toBe(0);
});

test('transfer instructions never link to an untrusted lookalike domain', async ({ page }) => {
  await page.route('**/api/v1/orders/confirmation?*', route => route.fulfill({ json: {
    ...confirmation, bank_transfer_details: { ...confirmation.bank_transfer_details, hosted_instructions_url: 'https://stripe.com.example.test/instructions' },
  } }));
  await page.goto(`/thank-you?${query}`);
  await expect(page.locator('#order-payment-status')).toHaveText('Awaiting payment');
  await expect(page.locator('#stripe-transfer-link')).toBeHidden();
});
