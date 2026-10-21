import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { apiFetch, ApiError } from '@/lib/api';
import { $customer, $isAuthLoading, $authError, fetchCurrentCustomer, logoutCustomer } from '@/stores/auth';

const reasons = ['not_purchased', 'not_delivered', 'not_paid', 'order_cancelled', 'already_reviewed'] as const;
export type ReviewStatus = typeof reasons[number] | 'loading' | 'allowed' | 'unauthenticated' | 'error';

export function useReviewEligibility(productId: string) {
  const customer = useStore($customer);
  const authLoading = useStore($isAuthLoading);
  const authError = useStore($authError);
  const [attempt, setAttempt] = useState(0);
  const key = `${productId}:${customer?.id}:${attempt}`;
  const [result, setResult] = useState<{ key: string; status: ReviewStatus } | null>(null);

  useEffect(() => {
    if (authLoading || authError || !customer || !productId) return undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let cancelled = false;
    setResult({ key, status: 'loading' });
    apiFetch<{ can_review: boolean; reason?: string }>(`/v1/customer/products/${productId}/can-review`, { signal: controller.signal })
      .then(data => {
        if (cancelled) return;
        const status: ReviewStatus = data.can_review === true ? 'allowed'
          : reasons.includes(data.reason as typeof reasons[number]) ? data.reason as typeof reasons[number] : 'error';
        setResult({ key, status });
      })
      .catch(error => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          logoutCustomer();
        } else {
          setResult({ key, status: 'error' });
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [productId, customer?.id, authLoading, authError, key]);

  const status: ReviewStatus = authLoading ? 'loading' : authError ? 'error'
    : !customer ? 'unauthenticated' : result?.key === key ? result.status : 'loading';

  return {
    status,
    retry: () => {
      if (authError) void fetchCurrentCustomer();
      else setAttempt(value => value + 1);
    },
    markReviewed: () => setResult({ key, status: 'already_reviewed' }),
  };
}
