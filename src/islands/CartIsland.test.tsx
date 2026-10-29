import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $cart, $coupon, $total, clearCart } from '@/stores/cart';
import { apiFetch } from '@/lib/api';
import CartIsland from './CartIsland';

vi.mock('@/hooks/use-cart-availability', () => ({
    useCartAvailability: () => ({ blocked: false, checking: false, error: '', issues: [], refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));

let root: Root | undefined;
let container: HTMLDivElement;

describe('persisted basket hydration', () => {
    beforeEach(() => {
        clearCart();
        vi.resetAllMocks();
        container = document.createElement('div');
        document.body.append(container);
        // The server cannot read the browser's saved basket or coupon.
        container.innerHTML = renderToString(<CartIsland />);
    });
    afterEach(async () => {
        if (root) await act(async () => root?.unmount());
        root = undefined;
        container.remove();
        clearCart();
    });

    it('hydrates a saved coupon without replacing the server tree and keeps removal interactive', async () => {
        $cart.set([{ id: '1', product_id: 1, name: 'Test fan', price: 12.5, qty: 1, image: '/fan.png' }]);
        $coupon.set({ code: 'QA10', type: 'percentage', value: 10, discount: 1.25, message: '10% off' });
        vi.mocked(apiFetch).mockResolvedValue({ code: 'QA10', type: 'percentage', value: 10, discount: 1.25, message: '10% off' });
        const onRecoverableError = vi.fn();
        await act(async () => { root = hydrateRoot(container, <CartIsland />, { onRecoverableError }); });
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(screen.getByText('QA10 — 10% off')).toBeInTheDocument();
        expect(screen.getByText('£11.25')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        await waitFor(() => expect(screen.getByPlaceholderText('Coupon Code')).toBeInTheDocument());
        expect($coupon.get()).toBeNull();
        expect(localStorage.getItem('midia_coupon')).toBeNull();
        expect($total.get()).toBe(12.5);
        expect(screen.queryByText('Discount (QA10)')).not.toBeInTheDocument();
    });

    it('hydrates saved items without a coupon and keeps quantity controls interactive', async () => {
        $cart.set([{ id: '1', product_id: 1, name: 'Test fan', price: 12.5, qty: 1, image: '/fan.png', available_stock: 3 }]);
        const onRecoverableError = vi.fn();
        await act(async () => { root = hydrateRoot(container, <CartIsland />, { onRecoverableError }); });
        expect(onRecoverableError).not.toHaveBeenCalled();
        fireEvent.click(screen.getAllByRole('button', { name: 'Increase quantity of Test fan' })[0]);
        expect($cart.get()[0].qty).toBe(2);
        expect($total.get()).toBe(25);
        expect(screen.getByPlaceholderText('Coupon Code')).toBeInTheDocument();
    });
});
