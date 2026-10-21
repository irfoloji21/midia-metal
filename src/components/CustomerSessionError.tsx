import { fetchCurrentCustomer } from '@/stores/auth';

export default function CustomerSessionError() {
  return (
    <div role="alert" className="bg-[#f4f5f7] p-4 text-sm text-[#6e7a92]">
      <p>We could not verify your session. Please try again.</p>
      <button type="button" onClick={() => { void fetchCurrentCustomer(); }} className="mt-3 font-semibold text-primary underline">
        Try again
      </button>
    </div>
  );
}
