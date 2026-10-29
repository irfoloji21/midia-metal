import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api';
import { $cart, $coupon, clearCart, updateQuantity } from '@/stores/cart';
import { $customer } from '@/stores/auth';
import type { AppliedCoupon } from '@/types/cart';
import CartIsland from './CartIsland';
import CheckoutIsland from './CheckoutIsland';

vi.mock('@/hooks/use-cart-availability', () => ({ useCartAvailability: () => ({ blocked: false, checking: false, error: '', issues: [], refresh: vi.fn() }) }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const coupon: AppliedCoupon = { code: 'SAVE10', type: 'percentage', value: 10, discount: 6.25, message: '10% discount applied!' };

beforeEach(() => {
  clearCart();
  vi.resetAllMocks();
  sessionStorage.clear();
  $customer.set(null);
  $cart.set([{ id: 'fan', product_id: 1, name: 'Fan', image: '/fan.png', price: 12.5, qty: 1 }]);
  $coupon.set(coupon);
});
afterEach(() => { cleanup(); clearCart(); sessionStorage.clear(); });

it('blocks cart navigation until the saved coupon is checked, and retries a transient error without a request loop', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('Server unavailable', 500));
  render(<CartIsland />);
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.queryByText('−£6.25')).not.toBeInTheDocument();
  const retry = await screen.findByRole('button', { name: 'Retry coupon' });
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('aria-disabled', 'true');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(apiFetch).toHaveBeenCalledTimes(1);
  vi.mocked(apiFetch).mockResolvedValueOnce({ ...coupon, discount: 1.25 });
  fireEvent.click(retry);
  expect(await screen.findByText('−£1.25')).toBeInTheDocument();
  expect(screen.getByText('£11.25')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('aria-disabled', 'false');
});

it('hides checkout totals and disables progression while a restored coupon is pending', async () => {
  let resolve!: (value: AppliedCoupon) => void;
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise<AppliedCoupon>(yes => { resolve = yes; }));
  sessionStorage.setItem('checkoutForm', JSON.stringify({ fulfillmentMethod: 'click_collect' }));
  render(<CheckoutIsland />);
  expect(screen.getByRole('button', { name: 'Proceed to payment' })).toBeDisabled();
  expect(screen.queryByText('−£6.25')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Checking your coupon');
  await act(async () => { resolve({ ...coupon, discount: 1.25 }); });
  expect(screen.getByText('−£1.25')).toBeInTheDocument();
  expect(screen.getByText('£11.25')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Proceed to payment' })).toBeEnabled();
});

it('revalidates after quantity changes and shows the minimum failure before allowing checkout without the coupon', async () => {
  $cart.set([{ ...$cart.get()[0], qty: 5 }]);
  vi.mocked(apiFetch).mockResolvedValueOnce(coupon);
  render(<CartIsland />);
  expect(await screen.findByText('−£6.25')).toBeInTheDocument();
  let reject!: (error: Error) => void;
  vi.mocked(apiFetch).mockReturnValueOnce(new Promise((_resolve, no) => { reject = no; }));
  await act(async () => { updateQuantity('fan', 1); });
  expect(screen.queryByText('−£6.25')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('aria-disabled', 'true');
  await act(async () => { reject(new ApiError('Minimum order amount is £50', 422)); });
  expect(screen.getByRole('alert')).toHaveTextContent('SAVE10 was removed');
  expect(screen.getByRole('alert')).toHaveTextContent('Minimum order amount is £50');
  expect($coupon.get()).toBeNull();
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('aria-disabled', 'false');
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
});
