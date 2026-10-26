import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { $cart, clearCart, setIsBusiness } from '@/stores/cart';
import { $customer, $isAuthLoading, $authError } from '@/stores/auth';
import PaymentIsland from './PaymentIsland';

vi.mock('@/hooks/use-cart-availability', () => ({ useCartAvailability: () => ({ blocked: false, checking: false, error: '', issues: [], refresh: vi.fn() }) }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div>Secure payment fields</div>,
  useStripe: () => null,
  useElements: () => null,
}));

beforeEach(() => {
  clearCart();
  setIsBusiness(false);
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: () => 'test-attempt' });
  $customer.set(null);
  $isAuthLoading.set(false);
  $authError.set(null);
  $cart.set([{ id: 'fan', product_id: 1, name: 'Fan', image: '/fan.png', price: 12.5, qty: 1 }]);
  sessionStorage.setItem('checkoutForm', JSON.stringify({
    firstName: 'Test', lastName: 'Buyer', email: 'test@example.test', phone: '0123456789',
    shipping_address: '12 Test Road', shipping_city: 'London', shipping_postcode: 'SW1A 1AA', shipping_country: 'United Kingdom',
    billingSameAsShipping: true, fulfillmentMethod: 'delivery', shippingOptionToken: 'test-quote', selectedShippingOption: { service: 'Delivery', rate: 6.5 },
  }));
});

afterEach(() => { cleanup(); clearCart(); sessionStorage.clear(); vi.unstubAllGlobals(); });

it('clears a failed card setup message when switching to bank transfer and preserves bank setup failures', async () => {
  const cardError = 'Card payment is currently unavailable. Please try again later.';
  const bankError = 'Bank transfer is currently unavailable. Please choose card payment.';
  const requestedMethods: string[] = [];
  vi.mocked(apiFetch).mockImplementation(async (endpoint, options) => {
    if (endpoint === '/v1/payment/intent') {
      const payload = JSON.parse(options!.body as string);
      requestedMethods.push(payload.payment_method);
      throw new Error(payload.payment_method === 'card' ? cardError : bankError);
    }
    throw new Error(`Unexpected request: ${endpoint}`);
  });
  render(<PaymentIsland />);
  expect(await screen.findByRole('alert')).toHaveTextContent(cardError);

  fireEvent.click(screen.getByRole('radio', { name: /^Bank Transfer/ }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  const bankButton = screen.getByRole('button', { name: 'Place Order & Get Transfer Details' });
  expect(bankButton).toBeEnabled();
  fireEvent.click(bankButton);

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(bankError));
  expect(requestedMethods).toEqual(['card', 'bank_transfer']);
  expect(screen.queryByText(cardError)).not.toBeInTheDocument();
  expect(bankButton).toBeEnabled();
  expect(vi.mocked(apiFetch).mock.calls.map(([endpoint]) => endpoint)).not.toContain('/v1/orders');
  expect($cart.get()).toHaveLength(1);
  expect(sessionStorage.getItem('checkoutForm')).not.toBeNull();
});
