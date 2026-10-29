import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import AdminDashboard from './AdminDashboard';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const dashboard = {
    period: { label: 'October 2026' },
    payments: { net_collected: 125, pending_payments: 25, completed_refunds: 10, unreconciled_orders: 0 },
    stats: { total_products: 64, pending_orders: 2, unread_messages: 0 },
    recent_orders: [],
    recent_messages: [],
};
const products = [{ product_name: 'Test fan', total_sold: 3, total_revenue: 100 }];

describe('dashboard independent data recovery', () => {
    beforeEach(() => { fetchMock.mockReset(); });
    afterEach(cleanup);

    it('shows the main dashboard even while optional product statistics are still loading', async () => {
        let finishProducts!: (value: unknown) => void;
        fetchMock.mockImplementation(url => url === '/admin/dashboard'
            ? Promise.resolve(dashboard)
            : new Promise(resolve => { finishProducts = resolve; }));
        render(<AdminDashboard />);
        await screen.findByText('Net Collected');
        expect(screen.getByText('£125.00')).toBeInTheDocument();
        expect(screen.getByText('Loading top selling products...')).toBeInTheDocument();
        expect(screen.queryByText('No sales data available yet.')).not.toBeInTheDocument();
        await act(async () => finishProducts(products));
        expect(screen.getByText('Test fan')).toBeInTheDocument();
    });

    it('preserves successful dashboard data after a product-statistics failure and retries only that section', async () => {
        let topAttempts = 0;
        fetchMock.mockImplementation(url => {
            if (url === '/admin/dashboard') return Promise.resolve(dashboard);
            return ++topAttempts === 1 ? Promise.reject(new Error('Bad gateway')) : Promise.resolve(products);
        });
        render(<AdminDashboard />);
        await screen.findByText('Unable to load top selling products.');
        expect(screen.getByText('£125.00')).toBeInTheDocument();
        expect(screen.getByText('Recent Orders')).toBeInTheDocument();
        expect(screen.queryByText('No sales data available yet.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry top selling products' }));
        await screen.findByText('Test fan');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([url]) => url === '/admin/dashboard')).toHaveLength(1);
        expect(topAttempts).toBe(2);
    });

    it('allows the primary dashboard request to be retried without discarding already loaded products', async () => {
        let dashAttempts = 0;
        fetchMock.mockImplementation(url => {
            if (url !== '/admin/dashboard') return Promise.resolve(products);
            return ++dashAttempts === 1 ? Promise.reject(new Error('Offline')) : Promise.resolve(dashboard);
        });
        render(<AdminDashboard />);
        await screen.findByText('Unable to load the dashboard. Please try again.');
        fireEvent.click(screen.getByRole('button', { name: 'Retry dashboard' }));
        await screen.findByText('Net Collected');
        expect(screen.getByText('Test fan')).toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([url]) => url === '/admin/stats/top-products')).toHaveLength(1);
        expect(dashAttempts).toBe(2);
    });

    it('distinguishes a successful empty result from a failed statistics request', async () => {
        fetchMock.mockImplementation(url => Promise.resolve(url === '/admin/dashboard' ? dashboard : []));
        render(<AdminDashboard />);
        await screen.findByText('No sales data available yet.');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('aborts both pending requests when leaving the dashboard', async () => {
        const finish: ((value: unknown) => void)[] = [];
        fetchMock.mockImplementation(() => new Promise(resolve => { finish.push(resolve); }));
        const view = render(<AdminDashboard />);
        const signals = fetchMock.mock.calls.map(([, options]) => options?.signal);
        expect(signals).toHaveLength(2);
        view.unmount();
        expect(signals.every(signal => signal?.aborted)).toBe(true);
        await act(async () => { finish[0](dashboard); finish[1](products); });
        expect(screen.queryByText('Net Collected')).not.toBeInTheDocument();
    });
});
