import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $cart, $cartIssues, refreshCartAvailability } from '@/stores/cart';

export function useCartAvailability() {
  const cart = useStore($cart);
  const issues = useStore($cartIssues);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const productIds = [...new Set(cart.map(item => String(item.product_id)))].sort().join(',');
  const refresh = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      await refreshCartAvailability();
      return $cartIssues.get().length === 0;
    } catch {
      setError('We could not check current stock and prices. Please try again before continuing.');
      return false;
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [productIds, refresh]);
  return { checking, error, issues, refresh, blocked: checking || Boolean(error) || issues.length > 0 };
}
