import { test, expect, seedCheckout, mockCheckoutApi, paymentSetup, cartItem } from './support/fixtures';

for (const authenticated of [false, true]) {
  test.describe(`${authenticated ? 'Customer' : 'Guest'} bank transfer`, () => {
    test.beforeEach(async ({ page }) => {
      await seedCheckout(page);
      await mockCheckoutApi(page, authenticated);
    });

    test('creates a Stripe-backed order and shows verified pending transfer details', async ({ page }) => {
      const setups: Record<string, unknown>[] = [];
      const orders: Record<string, unknown>[] = [];
      await page.route('**/api/v1/payment/intent', async route => {
        setups.push(route.request().postDataJSON());
        await route.fulfill({ json: paymentSetup });
      });
      await page.route('**/api/v1/orders', async route => {
        orders.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: { confirmation: { order: 'ORD-BANK-123', token: 'confirmation-token-123' } } });
      });
      await page.goto('/payment');
      await page.getByRole('radio', { name: /^Bank Transfer/ }).check();
      await page.getByRole('button', { name: 'Place Order & Get Transfer Details' }).click();
      await expect(page.locator('#order-number')).toHaveText('ORD-BANK-123');
      await expect(page).toHaveURL(/\/thank-you$/);
      await expect(page.locator('#order-payment-status')).toHaveText('Awaiting payment');
      await expect(page.locator('#transfer-fields')).toContainText('E2E-TRANSFER');
      expect(orders).toHaveLength(1);
      expect(orders[0]).toMatchObject({
        customer_name: 'Jane Smith', customer_email: 'jane@example.com', customer_phone: '07123456789',
        fulfilment_method: 'delivery', shipping_option_token: 'shiptok_123', payment_method: 'bank_transfer',
        notes: 'Ring the gate bell',
        stripe_payment_intent_id: paymentSetup.payment_intent_id, payment_token: paymentSetup.payment_token,
        save_card: false, items: [{ product_id: 101, quantity: 2, selected_variants: cartItem.selected_variants }],
      });
      const bankSetups = setups.filter(setup => setup.payment_method === 'bank_transfer');
      expect(bankSetups).toHaveLength(1);
      expect(bankSetups[0].payment_attempt_id).toEqual(expect.any(String));
      // The seeded draft and customer still contain legacy business data.
      for (const payload of [...setups, ...orders]) {
        expect(payload).not.toHaveProperty('is_business');
        expect(payload).not.toHaveProperty('company_name');
        expect(payload).not.toHaveProperty('company_vat_number');
      }
      const state = await page.evaluate(() => ({
        checkout: sessionStorage.getItem('checkoutForm'), stripe: sessionStorage.getItem('stripeCheckout'),
        cart: localStorage.getItem('midia_cart'), confirmation: JSON.parse(sessionStorage.getItem('orderConfirmation')!),
      }));
      expect(state).toEqual({ checkout: null, stripe: null, cart: '[]', confirmation: { order: 'ORD-BANK-123', token: 'confirmation-token-123' } });
    });

    for (const failure of ['422', '500', 'network'] as const) {
      test(`preserves checkout after ${failure} and retries the same payment session`, async ({ page }) => {
        const orders: Record<string, unknown>[] = [];
        let bankSetups = 0;
        await page.route('**/api/v1/payment/intent', async route => {
          if (route.request().postDataJSON().payment_method === 'bank_transfer') bankSetups++;
          await route.fulfill({ json: paymentSetup });
        });
        await page.route('**/api/v1/orders', async route => {
          orders.push(route.request().postDataJSON());
          if (orders.length > 1) {
            await route.fulfill({ status: 201, json: { confirmation: { order: 'ORD-BANK-123', token: 'confirmation-token-123' } } });
          } else if (failure === 'network') {
            await route.abort('failed');
          } else {
            await route.fulfill({ status: Number(failure), json: { message: failure === '422' ? 'The customer phone field is required.' : 'Internal server error.' } });
          }
        });
        await page.goto('/payment');
        await page.getByRole('radio', { name: /^Bank Transfer/ }).check();
        await page.getByRole('button', { name: 'Place Order & Get Transfer Details' }).click();
        await expect(page.locator('[data-sonner-toast][data-type="error"]').first()).toBeVisible();
        await expect(page).toHaveURL(/\/payment$/);
        const retry = page.getByRole('button', { name: 'Complete order confirmation' });
        await expect(retry).toBeEnabled();
        expect(orders).toHaveLength(1);
        const state = await page.evaluate(() => ({
          checkout: JSON.parse(sessionStorage.getItem('checkoutForm')!),
          cart: JSON.parse(localStorage.getItem('midia_cart')!),
          stripe: JSON.parse(sessionStorage.getItem('stripeCheckout')!),
        }));
        expect(state.checkout.email).toBe('jane@example.com');
        expect(state.cart[0]).toMatchObject({ id: 'product-1', qty: 2 });
        expect(state.stripe.setup).toEqual(paymentSetup);
        await retry.click();
        await expect(page.locator('#order-number')).toHaveText('ORD-BANK-123');
        expect(orders).toHaveLength(2);
        expect(orders[1]).toEqual(orders[0]);
        expect(bankSetups).toBe(1);
      });
    }

    test('payment setup failure preserves the attempt ID and never submits an unbacked order', async ({ page }) => {
      const attempts: string[] = [];
      let orders = 0;
      await page.route('**/api/v1/payment/intent', async route => {
        const payload = route.request().postDataJSON();
        if (payload.payment_method === 'bank_transfer') {
          attempts.push(payload.payment_attempt_id);
          await route.fulfill({ status: 503, json: { message: 'Transfer setup unavailable.' } });
        } else await route.fulfill({ json: paymentSetup });
      });
      await page.route('**/api/v1/orders', async route => { orders++; await route.abort(); });
      await page.goto('/payment');
      await page.getByRole('radio', { name: /^Bank Transfer/ }).check();
      const submit = page.getByRole('button', { name: 'Place Order & Get Transfer Details' });
      await submit.click();
      await expect(page.getByText('Transfer setup unavailable.', { exact: true }).first()).toBeVisible();
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect.poll(() => attempts.length).toBe(2);
      expect(attempts[1]).toBe(attempts[0]);
      expect(orders).toBe(0);
      await expect(page).toHaveURL(/\/payment$/);
    });
  });
}
