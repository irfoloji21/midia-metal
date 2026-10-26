import { test as base, expect, type Page } from '@playwright/test';

export { expect };
export const API_BASE = 'http://127.0.0.1:8013/api/v1';
export const test = base.extend({
  page: async ({ page }, runTest) => {
    // Typography downloads are not part of the application contract under test.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await runTest(page);
  },
});

export async function hydrated(page: Page) {
  await expect(page.locator('astro-island[client="load"][ssr], astro-island[client="idle"][ssr]')).toHaveCount(0);
}

export const customer = {
  id: 1, name: 'Jane Smith', email: 'jane@example.com', phone: '07123456789',
  address: '1 Test Street', city: 'London', postcode: 'E1 6AN', country: 'United Kingdom',
  is_business: true, company_name: 'Test Fabrication Ltd', company_vat_number: 'GB123456789',
};
export const product = {
  id: 101, name: 'Steel Beam', price: '£25.00', image: '', active: true,
  track_stock: false, stock_quantity: null, price_on_request: false,
  variants: [{ option: 'Finish', value: 'Galvanised', price: '£25.00' }],
};
export const cartItem = {
  id: 'product-1', product_id: product.id, name: product.name, price: product.price, qty: 2,
  image: '', selected_variants: { Finish: { option: 'Finish', value: 'Galvanised' } },
  track_stock: false, stock_quantity: null, available_stock: null,
};
export const checkoutForm = {
  firstName: 'Jane', lastName: 'Smith', phone: customer.phone, email: customer.email,
  company: customer.company_name, companyVat: customer.company_vat_number, isBusiness: true,
  fulfillmentMethod: 'delivery', shipping_address: customer.address, shipping_city: customer.city,
  shipping_postcode: customer.postcode, shipping_county: 'Greater London', shipping_country: customer.country,
  billingSameAsShipping: true, address: customer.address, city: customer.city, postcode: customer.postcode,
  county: 'Greater London', country: customer.country, notes: 'Ring the gate bell',
  shippingOptionToken: 'shiptok_123', selectedShippingOption: { service: 'Royal Mail Tracked 48', rate: 6.5 },
};
export const paymentSetup = {
  client_secret: 'pi_e2e_secret_fixture', payment_intent_id: 'pi_e2e', payment_token: 'payment-token-e2e',
  amount: 56.5,
};
export const confirmation = {
  order_number: 'ORD-BANK-123', created_at: '2026-10-22T12:00:00Z',
  payment_method: 'bank_transfer', payment_status: 'pending', total: 56.5,
  items: [{ name: 'Steel Beam', quantity: 2 }],
  bank_transfer_details: {
    account_name: 'Midia Metal Ltd', sort_code: '12-34-56', account_number: '12345678',
    reference: 'E2E-TRANSFER', amount_remaining: 5650,
    hosted_instructions_url: 'https://payments.stripe.com/instructions/test',
  },
};

export async function seedCheckout(page: Page, includeForm = true) {
  await page.addInitScript(({ item, form }) => {
    if (sessionStorage.getItem('__e2e_seeded')) return;
    localStorage.setItem('midia_cart', JSON.stringify([item]));
    if (form) sessionStorage.setItem('checkoutForm', JSON.stringify(form));
    sessionStorage.setItem('__e2e_seeded', 'true');
  }, { item: cartItem, form: includeForm ? checkoutForm : null });
}

export async function mockCheckoutApi(page: Page, authenticated = false) {
  await page.route('**/api/v1/customer/me', route => route.fulfill({
    status: authenticated ? 200 : 401, json: authenticated ? customer : { message: 'Unauthenticated.' },
  }));
  await page.route('**/api/v1/customer/payment-methods', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/products/101', route => route.fulfill({ json: product }));
  await page.route('**/api/v1/payment/intent', route => route.fulfill({ json: paymentSetup }));
  await page.route('**/api/v1/payment/status', route => route.fulfill({ json: { status: 'requires_payment_method' } }));
  await page.route('**/api/v1/orders/confirmation?*', route => route.fulfill({ json: confirmation }));
}
