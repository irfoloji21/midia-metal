import { apiFetch } from './api';

interface Confirmation {
  order_number: string;
  created_at: string;
  payment_method: string;
  payment_status: string;
  total: number;
  items: { name: string; quantity: number }[];
  bank_transfer_details?: {
    account_name: string;
    sort_code: string;
    account_number: string;
    reference: string;
    amount_remaining: number;
    hosted_instructions_url?: string;
  } | null;
}

export function initialiseOrderConfirmation() {
  const status = document.getElementById('order-payment-status');
  if (!status || status.dataset.initialised) return;
  status.dataset.initialised = 'true';
  const refresh = document.getElementById('refresh-payment-status') as HTMLButtonElement;
  const money = (amount: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  const setText = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  let credentials: { order: string; token: string } | null = null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('order') && params.get('token')) {
    credentials = { order: params.get('order')!, token: params.get('token')! };
    sessionStorage.setItem('orderConfirmation', JSON.stringify(credentials));
    window.history.replaceState(null, '', window.location.pathname);
  } else {
    try { credentials = JSON.parse(sessionStorage.getItem('orderConfirmation') || 'null'); } catch { /* Show recovery message below. */ }
  }

  const load = async () => {
    if (!credentials) { status.textContent = 'Order details are unavailable. Please use your confirmation email or sign in to your account.'; return; }
    refresh.disabled = true;
    try {
      const data = await apiFetch<Confirmation>(`/v1/orders/confirmation?${new URLSearchParams(credentials)}`);
      setText('order-number', data.order_number);
      setText('order-date', new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
      setText('payment-method', ({ card: 'Credit / Debit Card', bank_transfer: 'Bank Transfer via Stripe' } as Record<string, string>)[data.payment_method] || data.payment_method);
      setText('order-total', money(data.total));
      const items = document.getElementById('order-items');
      items?.replaceChildren(...data.items.map(item => { const row = document.createElement('span'); row.textContent = `${item.name} × ${item.quantity}`; return row; }));
      const pending = data.payment_status === 'pending';
      status.textContent = data.payment_status === 'paid' ? 'Payment received' : pending ? 'Awaiting payment' : `Payment status: ${data.payment_status.replaceAll('_', ' ')}`;
      refresh.classList.toggle('hidden', !pending);
      const bank = pending ? data.bank_transfer_details : null;
      document.getElementById('stripe-transfer-details')?.classList.toggle('hidden', !bank);
      if (bank) {
        const fields = [
          ['Account name', bank.account_name], ['Sort code', bank.sort_code],
          ['Account number', bank.account_number], ['Payment reference', bank.reference],
          ['Amount remaining', money(bank.amount_remaining / 100)],
        ];
        document.getElementById('transfer-fields')?.replaceChildren(...fields.flatMap(([label, value]) => {
          const term = document.createElement('dt'); term.textContent = label;
          const detail = document.createElement('dd'); detail.textContent = value; detail.className = 'font-semibold break-words';
          return [term, detail];
        }));
        const link = document.getElementById('stripe-transfer-link') as HTMLAnchorElement;
        link.classList.add('hidden');
        if (bank.hosted_instructions_url) {
          const url = new URL(bank.hosted_instructions_url);
          if (url.protocol === 'https:' && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'))) {
            link.href = url.href; link.classList.remove('hidden');
          }
        }
      }
    } catch {
      status.textContent = 'We could not load your order details. Please try again or refer to your confirmation email.';
      refresh.classList.remove('hidden');
    } finally { refresh.disabled = false; }
  };
  refresh.addEventListener('click', load);
  void load();
}
