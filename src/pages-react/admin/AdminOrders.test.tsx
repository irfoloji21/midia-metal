import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import AdminOrders from './AdminOrders';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), API_URL: '/api' }));
const fetchMock = vi.mocked(apiFetch);
const order = (id: number, name: string) => ({ id, order_number: `ORDER-${id}`, customer_name: name, customer_email: 'qa@example.com', created_at: '2026-10-22', total: '10.00', status: 'pending', payment_status: 'pending' });

describe('admin order access beyond the first page', () => {
  beforeEach(() => fetchMock.mockReset());
  afterEach(cleanup);

  it('loads the next page and searches all orders from page one', async () => {
    fetchMock.mockResolvedValueOnce({ data: [order(16, 'Recent buyer')], total: 16, last_page: 2 })
      .mockResolvedValueOnce({ data: [order(1, 'Older buyer')], total: 16, last_page: 2 })
      .mockResolvedValueOnce({ data: [order(1, 'Older buyer')], total: 1, last_page: 1 });
    render(<AdminOrders />);
    await screen.findByText('Recent buyer');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Older buyer');
    expect(fetchMock).toHaveBeenLastCalledWith('/admin/orders?page=2');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search orders' }), { target: { value: 'Older' } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/admin/orders?page=1&search=Older'));
    await screen.findByText('Page 1 of 1 · 1 orders');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('sends the status with the search and allows retry after a failure', async () => {
    fetchMock.mockResolvedValueOnce({ data: [], total: 0, last_page: 1 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: [], total: 0, last_page: 1 });
    render(<AdminOrders />);
    await screen.findByText('No orders found.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search orders' }), { target: { value: 'buyer' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Order status' }), { target: { value: 'shipped' } });
    await screen.findByRole('alert');
    expect(fetchMock).toHaveBeenLastCalledWith('/admin/orders?page=1&search=buyer&status=shipped');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('No orders found.');
  });
});
