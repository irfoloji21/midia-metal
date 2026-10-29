import type { useCartCoupon } from '@/hooks/use-cart-coupon';
import { removeCoupon } from '@/stores/cart';

export default function CartCouponNotice({ state }: { state: ReturnType<typeof useCartCoupon> }) {
  if (state.status === 'pending') return <p role="status" className="mb-4 text-sm text-primary">Checking your coupon and updating the total…</p>;
  if (!state.message) return null;
  return <div role="alert" className="mb-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <p>{state.message}</p>
    {state.status === 'error' && <div className="mt-2 flex gap-4">
      <button type="button" onClick={() => void state.retry()} className="underline">Retry coupon</button>
      <button type="button" onClick={removeCoupon} className="underline">Remove coupon</button>
    </div>}
  </div>;
}
