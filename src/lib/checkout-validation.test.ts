import { describe, expect, it } from 'vitest';
import { getCheckoutErrors, normalizeCheckoutForm } from './checkout-validation';
import type { CheckoutFormData } from '@/types/cart';

const form = { firstName: 'Jane', lastName: 'Smith', phone: '07700000000', email: 'jane@example.com', shipping_address: '10 High Street', shipping_city: 'London', shipping_postcode: 'SW1A 1AA', billingSameAsShipping: true, fulfillmentMethod: 'click_collect' } as CheckoutFormData;
describe('checkout validation', () => {
  it.each(['firstName', 'lastName', 'phone', 'email', 'shipping_address', 'shipping_city', 'shipping_postcode'] as const)('rejects whitespace in %s', field => {
    expect(getCheckoutErrors({ ...form, [field]: '   ' })[field]).toBeTruthy();
  });
  it('rejects an invalid postcode for collection as well as delivery', () => {
    expect(getCheckoutErrors({ ...form, shipping_postcode: 'NOT-A-POSTCODE' }).shipping_postcode).toBeTruthy();
  });
  it.each(['sw1a1aa', 'M1 1AE', 'B33 8TH', 'CR2 6XH', 'DN55 1PT', 'GIR 0AA'])('accepts and normalizes %s', shipping_postcode => {
    expect(getCheckoutErrors({ ...form, shipping_postcode })).toEqual({});
    expect(normalizeCheckoutForm({ ...form, firstName: ' Jane ', shipping_postcode }).firstName).toBe('Jane');
  });
  it('validates separate billing and business fields', () => {
    expect(getCheckoutErrors({ ...form, billingSameAsShipping: false, address: ' ', city: ' ', postcode: 'invalid', company: ' ' }, true)).toMatchObject({ address: expect.any(String), city: expect.any(String), postcode: expect.any(String), company: expect.any(String) });
  });
});
