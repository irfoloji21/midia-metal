import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetailIsland from './ProductDetailIsland';
import CustomerSessionIsland from './CustomerSessionIsland';
import { $customer, $isAuthLoading, logoutCustomer, type Customer } from '@/stores/auth';

const customer = { id: 2, name: 'Test Customer', email: 'test@example.com' } as Customer;
const product = { id: 58, slug: 'baffle-filters-zm0Y', name: 'Stainless Steel Baffle Filters', price: '£1.00', description: 'Product description', image: '/filter.jpg', gallery: [], reviews: [], variants: [] };
const reply = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data }) as Response;
let sessionReply: () => Promise<Response>;
let eligibilityReply: () => Promise<Response>;
let submitReply: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  logoutCustomer();
  $isAuthLoading.set(true);
  sessionReply = async () => reply(customer);
  eligibilityReply = async () => reply({ can_review: true });
  submitReply = async () => reply({ id: 1, rating: 5, comment: 'Well made.', customer: { name: customer.name }, created_at: '2026-10-18T12:00:00Z' }, 201);
  fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/customer/me')) return sessionReply();
    if (url.endsWith('/can-review')) return eligibilityReply();
    if (url.endsWith('/reviews') && options?.method === 'POST') return submitReply();
    if (url.endsWith('/sanctum/csrf-cookie')) return reply({});
    if (url.endsWith('/related')) return reply([]);
    if (url.includes('/v1/products/')) return reply(product);
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); logoutCustomer(); vi.unstubAllGlobals(); });

async function showReviews() {
  await screen.findByRole('button', { name: 'Reviews (0)' });
  fireEvent.click(screen.getByRole('button', { name: 'Reviews (0)' }));
}
function renderPage() {
  return render(<><CustomerSessionIsland /><ProductDetailIsland id={product.slug} initialProduct={product} /></>);
}

it('keeps selected combination specifications when a static label collides', async () => {
  const fixture = {
    ...product, specifications: { 'QA finish': 'Brushed' }, variant_mode: 'combination', variant_options: ['Material'],
    variant_table_columns: { combination: [{ key: 'custom:finish', label: 'QA Finish', visible: true, frontendVisible: true }] },
    variants: [
      { attributes: { Material: 'Steel' }, price: 12.5, stock: 5, custom_fields: { finish: 'QA Brushed' } },
      { attributes: { Material: 'Aluminium' }, price: 24.75, stock: 5, custom_fields: { finish: 'QA Polished' } },
    ],
  };
  fetchMock.mockImplementation(async (url: string) => reply(url.endsWith('/related') ? [] : fixture));
  render(<ProductDetailIsland id={product.slug} initialProduct={fixture} />);
  await act(async () => {});
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Steel' } });
  expect(await screen.findByText('QA Brushed')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Aluminium' } });
  expect(screen.getByText('QA Polished')).toBeInTheDocument();
  expect(screen.queryByText('QA Brushed')).not.toBeInTheDocument();
  expect(screen.getByText('Brushed')).toBeInTheDocument();
});

describe('review form with the shared page session', () => {
  it('opens on a direct load only after the session and purchase checks complete', async () => {
    let resolveSession!: (response: Response) => void;
    sessionReply = () => new Promise<Response>(resolve => { resolveSession = resolve; });
    renderPage();
    await showReviews();
    expect(screen.getByText('Checking eligibility...')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'logged in' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/can-review'))).toBe(false);
    await act(async () => resolveSession(reply(customer)));
    expect(await screen.findByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/customer/me'))).toHaveLength(1);
  });

  it('rechecks after Astro navigation and works again after a full page reload', async () => {
    let view = renderPage();
    await showReviews();
    await screen.findByRole('button', { name: 'Submit Review' });
    eligibilityReply = async () => reply({ can_review: false, reason: 'not_paid' });
    await act(async () => { document.dispatchEvent(new Event('astro:after-swap')); });
    expect(await screen.findByText(/A paid order is required/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
    view.unmount();
    act(() => { logoutCustomer(); $isAuthLoading.set(true); });
    eligibilityReply = async () => reply({ can_review: true });
    view = renderPage();
    await showReviews();
    expect(await screen.findByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
    view.unmount();
  });

  it('shows a retry instead of a login message when the session request fails', async () => {
    sessionReply = async () => reply({ message: 'Unavailable' }, 500);
    renderPage();
    await showReviews();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not check your review eligibility');
    expect(screen.queryByRole('link', { name: 'logged in' })).not.toBeInTheDocument();
    sessionReply = async () => reply(customer);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
  });

  it('shows a retry for an eligibility server error, then recovers', async () => {
    eligibilityReply = async () => reply({ message: 'Unavailable' }, 500);
    renderPage();
    await showReviews();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'logged in' })).not.toBeInTheDocument();
    eligibilityReply = async () => reply({ can_review: true });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
  });

  it('shows login only for a confirmed guest or expired session', async () => {
    eligibilityReply = async () => reply({ message: 'Unauthenticated.' }, 401);
    renderPage();
    await showReviews();
    expect(await screen.findByRole('link', { name: 'logged in' })).toBeInTheDocument();
    expect($customer.get()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
  });

  it.each(['not_paid', 'not_delivered', 'order_cancelled', 'not_purchased', 'already_reviewed', 'unexpected_reason'])('does not expose a form for %s', async reason => {
    eligibilityReply = async () => reply({ can_review: false, reason });
    renderPage();
    await showReviews();
    await waitFor(() => expect(screen.queryByText('Checking eligibility...')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'logged in' })).not.toBeInTheDocument();
    if (reason === 'unexpected_reason') expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('closes the form after posting and displays the returned review', async () => {
    renderPage();
    await showReviews();
    await screen.findByRole('button', { name: 'Submit Review' });
    fireEvent.change(screen.getByLabelText('Your Review (Optional)'), { target: { value: 'Well made.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));
    expect(await screen.findByText('You have already reviewed this product. Thank you for your feedback!')).toBeInTheDocument();
    expect(screen.getByText('Well made.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/reviews'))).toHaveLength(1);
  });

  it('does not let an old eligibility response reopen the form after logout', async () => {
    let resolveEligibility!: (response: Response) => void;
    eligibilityReply = () => new Promise<Response>(resolve => { resolveEligibility = resolve; });
    renderPage();
    await showReviews();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/can-review'))).toBe(true));
    act(() => logoutCustomer());
    await act(async () => resolveEligibility(reply({ can_review: true })));
    expect(screen.getByRole('link', { name: 'logged in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
  });
});
