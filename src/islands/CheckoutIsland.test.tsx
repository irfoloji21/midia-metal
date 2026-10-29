import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CheckoutIsland from './CheckoutIsland';
import { $cart } from '@/stores/cart';
import { $customer, type Customer } from '@/stores/auth';

vi.mock('@/hooks/use-cart-availability', () => ({ useCartAvailability: () => ({ blocked: false, checking: false, error: '', issues: [], retry: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn().mockResolvedValue({ options: [] }), API_URL: '/api' }));
const customer = { id: 1, name: 'Account Name', email: 'account@example.com' } as Customer;

beforeEach(() => {
  sessionStorage.clear();
  $cart.set([{ id: 1, product_id: 1, name: 'QA product', price: '£12.50', qty: 2, image: '/placeholder.svg' }]);
});
afterEach(() => { cleanup(); $customer.set(null); $cart.set([]); sessionStorage.clear(); });

it('restores the payment draft ahead of an already loaded customer profile', async () => {
  $customer.set(customer);
  sessionStorage.setItem('checkoutForm', JSON.stringify({ firstName: 'Draft', lastName: 'Buyer', shipping_address: '12 Draft Street', shipping_city: 'London', shipping_postcode: 'SW1A 1AA', fulfillmentMethod: 'click_collect', isBusiness: true, company: 'Draft Ltd' }));
  render(<CheckoutIsland />);
  expect(await screen.findByLabelText(/First Name/i)).toHaveValue('Draft');
  expect(screen.getByLabelText(/Last Name/i)).toHaveValue('Buyer');
  expect(screen.queryByLabelText(/I am purchasing as a business/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Company/i)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Draft Ltd')).not.toBeInTheDocument();
  const restored = JSON.parse(sessionStorage.getItem('checkoutForm')!);
  expect(restored).not.toHaveProperty('isBusiness');
  expect(restored).not.toHaveProperty('company');
  expect(screen.getByDisplayValue('12 Draft Street')).toBeInTheDocument();
  expect(screen.getByDisplayValue('London')).toBeInTheDocument();
  expect(screen.getByDisplayValue('SW1A 1AA')).toBeInTheDocument();
  expect(screen.getByText('QA product x 2').nextElementSibling).toHaveTextContent('£25.00');
});

it('keeps user edits when customer loading completes later', async () => {
  $customer.set(null);
  render(<CheckoutIsland />);
  const firstName = await screen.findByLabelText(/First Name/i);
  fireEvent.change(firstName, { target: { value: 'Typed name' } });
  await act(async () => { $customer.set(customer); });
  expect(firstName).toHaveValue('Typed name');
});

it('prefills contact details without reviving business fields from an existing customer', async () => {
  const legacyCustomer = { ...customer, is_business: true, company_name: 'Existing Ltd', company_vat_number: 'GB123456789' };
  $customer.set(legacyCustomer);
  render(<CheckoutIsland />);
  expect(await screen.findByLabelText(/First Name/i)).toHaveValue('Account');
  expect(screen.getByLabelText(/Email Address/i)).toHaveValue(customer.email);
  expect(screen.queryByLabelText(/business|company/i)).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Existing Ltd')).not.toBeInTheDocument();
});
