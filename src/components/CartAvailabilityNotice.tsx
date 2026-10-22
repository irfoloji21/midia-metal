import type { useCartAvailability } from '@/hooks/use-cart-availability';

export default function CartAvailabilityNotice({ state }: { state: ReturnType<typeof useCartAvailability> }) {
  if (state.checking) return <p role="status" className="mb-4 text-sm text-primary">Checking current stock and prices…</p>;
  if (!state.blocked) return null;
  return <div role="alert" className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    {state.error && <p>{state.error}</p>}
    {state.issues.map(issue => <p key={issue}>{issue}</p>)}
    <a href="/cart" className="mr-4 underline">Review basket</a>
    <button type="button" onClick={() => void state.refresh()} className="underline">Check again</button>
  </div>;
}
