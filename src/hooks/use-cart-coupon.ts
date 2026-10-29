import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $coupon, $couponState, $subtotal, refreshCoupon } from '@/stores/cart';

export function useCartCoupon() {
  const coupon = useStore($coupon);
  const subtotal = useStore($subtotal);
  const state = useStore($couponState);
  useEffect(() => { void refreshCoupon(); }, [coupon?.code, subtotal]);
  return { ...state, retry: () => refreshCoupon(true) };
}
