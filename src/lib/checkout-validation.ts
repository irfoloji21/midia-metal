import type { CheckoutFormData } from '@/types/cart';

export type CheckoutErrors = Partial<Record<keyof CheckoutFormData, string>>;

// Older browser drafts may still contain the retired business fields.
const retiredFields = new Set(['isBusiness', 'company', 'companyVat']);

export function normalizeCheckoutForm(form: CheckoutFormData): CheckoutFormData {
  const normalized = Object.fromEntries(Object.entries(form)
    .filter(([key]) => !retiredFields.has(key))
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as unknown as CheckoutFormData;
  for (const field of ['shipping_postcode', 'postcode'] as const) {
    const compact = String(normalized[field] || '').replace(/\s/g, '').toUpperCase();
    normalized[field] = compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
  }
  return normalized;
}

export function getCheckoutErrors(form: CheckoutFormData): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const required: Array<[keyof CheckoutFormData, string]> = [
    ['firstName', 'First name'], ['lastName', 'Last name'], ['phone', 'Phone'], ['email', 'Email address'],
    ['shipping_address', 'Street address'], ['shipping_city', 'Town / city'], ['shipping_postcode', 'Postcode'],
  ];
  if (!form.billingSameAsShipping) required.push(['address', 'Billing street address'], ['city', 'Billing town / city'], ['postcode', 'Billing postcode']);
  for (const [field, label] of required) {
    if (!String(form[field] ?? '').trim()) errors[field] = `${label} is required.`;
  }
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email?.trim() || '')) errors.email = 'Enter a valid email address.';
  const normalized = normalizeCheckoutForm(form);
  for (const field of (form.billingSameAsShipping ? ['shipping_postcode'] : ['shipping_postcode', 'postcode']) as Array<'shipping_postcode' | 'postcode'>) {
    if (!errors[field] && !/^(GIR 0AA|[A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]? \d[ABD-HJLNP-UW-Z]{2})$/i.test(normalized[field] || '')) {
      errors[field] = 'Enter a valid UK postcode, for example SW1A 1AA.';
    }
  }
  return errors;
}
