import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { $cart, $coupon, clearCart } from '@/stores/cart';
import { $customer, $isAuthLoading, $authError } from '@/stores/auth';
import type { AppliedCoupon } from '@/types/cart';
import PaymentIsland from './PaymentIsland';

vi.mock('@/hooks/use-cart-availability', () => ({ useCartAvailability: () => ({ blocked: false, checking: false, error: '', issues: [], refresh: vi.fn() }) }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div>Secure payment fields</div>,
  useStripe: () => null,
  useElements: () => null,
}));
const coupon: AppliedCoupon = { code: 'SAVE10', type: 'percentage', value: 10, discount: 6.25, message: '10% discount applied!' };
const setup = { client_secret: 'test-client-secret', payment_intent_id: 'pi_test', payment_token: 'test-token', amount: 17.75 };

beforeEach(() => {
  clearCart();
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: () => 'test-attempt' });
  $customer.set(null);
  $isAuthLoading.set(false);
  $authError.set(null);
  $cart.set([{ id: 'fan', product_id: 1, name: 'Fan', image: '/fan.png', price: 12.5, qty: 1 }]);
  $coupon.set(coupon);
  sessionStorage.setItem('checkoutForm', JSON.stringify({
    firstName: 'Test', lastName: 'Buyer', email: 'test@example.test', phone: '0123456789',
    shipping_address: '12 Test Road', shipping_city: 'London', shipping_postcode: 'SW1A 1AA', shipping_country: 'United Kingdom',
    billingSameAsShipping: true, fulfillmentMethod: 'delivery', shippingOptionToken: 'test-quote', selectedShippingOption: { service: 'Delivery', rate: 6.5 },
  }));
});
afterEach(() => { cleanup(); clearCart(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it('waits for the current coupon amount before creating either card or bank payment setup', async () => {
  let resolve!: (value: AppliedCoupon) => void;
  const validation = new Promise<AppliedCoupon>(yes => { resolve = yes; });
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/coupons/apply') return validation;
    if (endpoint === '/v1/payment/intent') return setup;
    if (endpoint === '/v1/payment/status') return { status: 'requires_payment_method' };
    throw new Error(`Unexpected request: ${endpoint}`);
  });
  render(<PaymentIsland />);
  expect(screen.getByRole('status')).toHaveTextContent('Checking your coupon');
  expect(screen.queryByText('−£6.25')).not.toBeInTheDocument();
  expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Bank Transfer', { selector: 'p' }));
  expect(screen.queryByRole('button', { name: 'Place Order & Get Transfer Details' })).not.toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Credit / Debit Card'));
  await act(async () => { resolve({ ...coupon, discount: 1.25 }); });
  expect(screen.getByText('−£1.25')).toBeInTheDocument();
  expect(screen.getByText('£17.75')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('stripe-elements')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Pay £17.75 Securely' })).toBeInTheDocument();
});

it('does not expose Stripe confirmation when the authoritative payment amount differs from the displayed total', async () => {
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/coupons/apply') return { ...coupon, discount: 1.25 };
    if (endpoint === '/v1/payment/intent') return { ...setup, amount: 18.75 };
    throw new Error(`Unexpected request: ${endpoint}`);
  });
  render(<PaymentIsland />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your order total has changed');
  expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Pay .* Securely/ })).not.toBeInTheDocument();
  expect(vi.mocked(apiFetch).mock.calls.map(([path]) => path)).not.toContain('/v1/payment/status');
});

it('accepts an old business draft without a company name and excludes retired fields from payment setup', async () => {
  $coupon.set(null);
  const draft = JSON.parse(sessionStorage.getItem('checkoutForm')!);
  sessionStorage.setItem('checkoutForm', JSON.stringify({ ...draft, isBusiness: true, company: '', companyVat: 'GB123456789' }));
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/payment/intent') return { ...setup, amount: 19 };
    if (endpoint === '/v1/payment/status') return { status: 'requires_payment_method' };
    throw new Error(`Unexpected request: ${endpoint}`);
  });
  render(<PaymentIsland />);
  expect(await screen.findByRole('button', { name: 'Pay £19.00 Securely' })).toBeInTheDocument();
  const [, request] = vi.mocked(apiFetch).mock.calls.find(([path]) => path === '/v1/payment/intent')!;
  const payload = JSON.parse(request!.body as string);
  expect(payload).toMatchObject({ customer_email: draft.email, payment_method: 'card', shipping_option_token: 'test-quote' });
  expect(payload).not.toHaveProperty('is_business');
  expect(payload).not.toHaveProperty('company_name');
  expect(payload).not.toHaveProperty('company_vat_number');
  expect(JSON.parse(sessionStorage.getItem('checkoutForm')!)).toEqual({ ...draft, postcode: '' });
});

it.each([false, true])('preserves a confirmed legacy payment only when the remaining checkout still matches (changed: %s)', async changed => {
  $coupon.set(null);
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/payment/intent') return { ...setup, amount: 19 };
    if (endpoint === '/v1/payment/status') return { status: 'requires_payment_method' };
    throw new Error(`Unexpected request: ${endpoint}`);
  });
  const firstRender = render(<PaymentIsland />);
  await screen.findByRole('button', { name: 'Pay £19.00 Securely' });
  firstRender.unmount();

  const saved = JSON.parse(sessionStorage.getItem('stripeCheckout')!);
  const [payload, ...context] = JSON.parse(saved.key);
  saved.key = JSON.stringify([{ ...payload, is_business: true, company_name: 'Legacy Ltd', company_vat_number: 'GB123456789' }, ...context]);
  saved.confirmed = true;
  sessionStorage.setItem('stripeCheckout', JSON.stringify(saved));
  if (changed) {
    const draft = JSON.parse(sessionStorage.getItem('checkoutForm')!);
    sessionStorage.setItem('checkoutForm', JSON.stringify({ ...draft, shipping_address: '99 Changed Road' }));
  }
  vi.mocked(apiFetch).mockClear();
  render(<PaymentIsland />);

  if (changed) {
    await screen.findByRole('button', { name: 'Pay £19.00 Securely' });
    expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path === '/v1/payment/intent')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Complete order confirmation' })).not.toBeInTheDocument();
  } else {
    expect(await screen.findByRole('button', { name: 'Complete order confirmation' })).toBeEnabled();
    expect(apiFetch).not.toHaveBeenCalled();
    const restored = JSON.parse(sessionStorage.getItem('stripeCheckout')!);
    expect(restored).toMatchObject({ attempt: saved.attempt, setup: saved.setup, confirmed: true });
    expect(restored.key).toBe(JSON.stringify([payload, ...context]));
  }
});
