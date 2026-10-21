import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import { initialiseOrderConfirmation } from './order-confirmation';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));
const fixture = {
  order_number: 'ORD-TEST', created_at: '2026-10-16T00:00:00Z', payment_method: 'bank_transfer',
  payment_status: 'pending', total: 100, items: [{ name: 'Metal sheet', quantity: 1 }],
  bank_transfer_details: { account_name: 'Test Business', sort_code: '108800', account_number: '00012345', reference: 'STRIPE-REF', amount_remaining: 4000, hosted_instructions_url: 'https://payments.stripe.com/test/instructions' },
};
const mount = () => {
  document.body.innerHTML = `<span id="order-payment-status"></span><button id="refresh-payment-status"></button>
    <span id="order-number"></span><span id="order-date"></span><span id="payment-method"></span>
    <span id="order-total"></span><div id="order-items"></div><section id="stripe-transfer-details"></section>
    <dl id="transfer-fields"></dl><a id="stripe-transfer-link"></a>`;
  initialiseOrderConfirmation();
};
describe('order confirmation', () => {
  beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); window.history.replaceState(null, '', '/thank-you?order=ORD-TEST&token=signed-test'); });
  it('shows the remaining amount and Stripe reference and recovers after a refresh', async () => {
    vi.mocked(apiFetch).mockResolvedValue(fixture);
    mount();
    await vi.waitFor(() => expect(document.getElementById('transfer-fields')?.textContent).toContain('£40.00'));
    expect(document.getElementById('transfer-fields')?.textContent).toContain('STRIPE-REF');
    expect(window.location.search).toBe('');
    mount();
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(document.getElementById('order-number')?.textContent).toBe('ORD-TEST');
  });
  it('replaces pending instructions with paid status after server confirmation', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(fixture).mockResolvedValueOnce({ ...fixture, payment_status: 'paid', bank_transfer_details: null });
    mount();
    await vi.waitFor(() => expect(document.getElementById('order-payment-status')?.textContent).toBe('Awaiting payment'));
    document.getElementById('refresh-payment-status')?.click();
    await vi.waitFor(() => expect(document.getElementById('order-payment-status')?.textContent).toBe('Payment received'));
    expect(document.getElementById('stripe-transfer-details')?.classList.contains('hidden')).toBe(true);
  });
  it('does not fetch or invent order data without a confirmation token', () => {
    window.history.replaceState(null, '', '/thank-you');
    mount();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(document.getElementById('order-payment-status')?.textContent).toContain('unavailable');
  });
});
