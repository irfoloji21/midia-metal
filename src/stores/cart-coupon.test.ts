import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api';
import { $cart, $coupon, $couponState, $discount, $total, applyCoupon, clearCart, refreshCoupon, refreshCartAvailability, removeCoupon, updateQuantity } from './cart';
import type { AppliedCoupon } from '@/types/cart';

vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const result = (discount: number): AppliedCoupon => ({ code: 'SAVE10', type: 'percentage', value: 10, discount, message: '10% discount applied!' });
function deferred() {
  let resolve!: (value: AppliedCoupon) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AppliedCoupon>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  clearCart();
  vi.resetAllMocks();
  $cart.set([{ id: 'fan', product_id: 1, name: 'Fan', image: '', price: 12.5, qty: 5 }]);
});
afterEach(() => { clearCart(); vi.useRealTimers(); });

describe('coupon amounts belong to the currently validated basket', () => {
  it('sends an exact monetary subtotal at the minimum-order boundary', async () => {
    $cart.set([{ ...$cart.get()[0], price: 0.6, qty: 3 }]);
    vi.mocked(apiFetch).mockImplementation(async (_url, options) => {
      const amount = JSON.parse(options?.body as string).order_amount;
      if (amount < 1.8) throw new ApiError('Minimum order amount is £1.80', 422);
      return result(0.18);
    });
    await applyCoupon('SAVE10');
    expect(JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string).order_amount).toBe(1.8);
    expect($couponState.get()).toMatchObject({ status: 'valid', discount: 0.18 });
    expect($total.get()).toBe(1.62);
  });

  it('revalidates percentage discounts when quantity decreases and increases', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(result(6.25));
    await applyCoupon('save10');
    expect($discount.get()).toBe(6.25);
    updateQuantity('fan', 1);
    expect($couponState.get()).toMatchObject({ blocked: true, status: 'pending', discount: 0 });
    vi.mocked(apiFetch).mockResolvedValueOnce(result(1.25));
    await refreshCoupon();
    expect(JSON.parse(vi.mocked(apiFetch).mock.calls[1][1]?.body as string)).toEqual({ code: 'SAVE10', order_amount: 12.5 });
    expect($discount.get()).toBe(1.25);
    expect($total.get() + 6.5).toBe(17.75);
    updateQuantity('fan', 8);
    vi.mocked(apiFetch).mockResolvedValueOnce(result(10));
    await refreshCoupon();
    expect($discount.get()).toBe(10);
    expect($total.get()).toBe(90);
  });

  it('uses the server fixed-amount cap after a basket falls below the coupon value', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...result(20), type: 'fixed', value: 20 });
    await applyCoupon('SAVE10');
    updateQuantity('fan', 1);
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...result(12.5), type: 'fixed', value: 20 });
    await refreshCoupon();
    expect($discount.get()).toBe(12.5);
    expect($total.get()).toBe(0);
  });

  it('removes a coupon rejected below its minimum and explains the changed total', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(result(6.25));
    await applyCoupon('SAVE10');
    updateQuantity('fan', 1);
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('Minimum order amount is £50', 422));
    expect(await refreshCoupon()).toBe(false);
    expect($coupon.get()).toBeNull();
    expect(localStorage.getItem('midia_coupon')).toBeNull();
    expect($couponState.get()).toMatchObject({ status: 'invalid', blocked: false, discount: 0 });
    expect($couponState.get().message).toContain('Minimum order amount');
    expect($total.get()).toBe(12.5);
    await refreshCoupon();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the code but blocks stale totals on a temporary error, then recovers by explicit retry', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(result(6.25));
    await applyCoupon('SAVE10');
    updateQuantity('fan', 1);
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('Unavailable', 500));
    await refreshCoupon();
    expect($coupon.get()?.code).toBe('SAVE10');
    expect($couponState.get()).toMatchObject({ status: 'error', blocked: true, discount: 0 });
    vi.mocked(apiFetch).mockResolvedValueOnce(result(1.25));
    expect(await refreshCoupon(true)).toBe(true);
    expect($couponState.get()).toMatchObject({ status: 'valid', blocked: false, discount: 1.25 });
  });

  it('ignores out-of-order responses even when an aborted request still resolves', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    vi.mocked(apiFetch).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const oldApply = applyCoupon('SAVE10');
    updateQuantity('fan', 1);
    const newApply = refreshCoupon();
    expect(vi.mocked(apiFetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    newRequest.resolve(result(1.25));
    await newApply;
    oldRequest.resolve(result(6.25));
    await oldApply;
    expect($discount.get()).toBe(1.25);
    expect(JSON.parse(localStorage.getItem('midia_coupon')!)).toMatchObject({ discount: 1.25 });
  });

  it('does not restore a coupon removed while validation is in flight', async () => {
    const request = deferred();
    vi.mocked(apiFetch).mockReturnValueOnce(request.promise);
    const pending = applyCoupon('SAVE10');
    removeCoupon();
    request.resolve(result(6.25));
    await pending;
    expect($coupon.get()).toBeNull();
    expect($couponState.get().blocked).toBe(false);
  });

  it('invalidates a discount after stock refresh changes the product price', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(result(6.25));
    await applyCoupon('SAVE10');
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: 1, price: 20, track_stock: false });
    await refreshCartAvailability();
    expect($couponState.get().blocked).toBe(true);
    vi.mocked(apiFetch).mockResolvedValueOnce(result(10));
    await refreshCoupon();
    expect($total.get()).toBe(90);
  });

  it('shares an in-flight validation and returns a retryable error after timeout', async () => {
    vi.useFakeTimers();
    // Even a stalled CSRF bootstrap which ignores AbortSignal must time out.
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    const apply = applyCoupon('SAVE10');
    const duplicate = refreshCoupon();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15000);
    await Promise.all([apply, duplicate]);
    expect($couponState.get()).toMatchObject({ status: 'error', blocked: true });
    expect($coupon.get()?.code).toBe('SAVE10');
  });

  it('does not trust an old saved discount after a fresh module/page load', async () => {
    localStorage.setItem('midia_cart', JSON.stringify([{ id: 'fan', product_id: 1, name: 'Fan', image: '', price: 12.5, qty: 1 }]));
    localStorage.setItem('midia_coupon', JSON.stringify(result(6.25)));
    vi.resetModules();
    const restored = await import('./cart');
    expect(restored.$couponState.get()).toMatchObject({ status: 'pending', blocked: true, discount: 0 });
    vi.mocked(apiFetch).mockResolvedValueOnce(result(1.25));
    await restored.refreshCoupon();
    expect(restored.$total.get() + 6.5).toBe(17.75);
    restored.clearCart();
  });
});
