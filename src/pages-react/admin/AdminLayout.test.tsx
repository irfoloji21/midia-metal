import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/lib/api';
import AdminLayout from './AdminLayout';

vi.mock('@/lib/api', async importOriginal => ({
    ...await importOriginal<typeof import('@/lib/api')>(),
    apiFetch: vi.fn(),
}));

const fetchMock = vi.mocked(apiFetch);
const renderLayout = () => render(
    <MemoryRouter initialEntries={['/admin']}>
        <Routes>
            <Route path="/admin/login" element={<h1>Admin login</h1>} />
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<h1>Dashboard content</h1>} />
                <Route path="settings" element={<h1>Settings content</h1>} />
            </Route>
        </Routes>
    </MemoryRouter>,
);

describe('admin session and navigation recovery', () => {
    beforeEach(() => { fetchMock.mockReset(); });
    afterEach(cleanup);

    it.each([
        ['network failure', new TypeError('Failed to fetch')],
        ['gateway failure', new ApiError('Bad gateway', 502)],
        ['rate limit', new ApiError('Too many requests', 429)],
    ])('keeps a %s separate from an expired session and recovers on retry', async (_, error) => {
        fetchMock.mockRejectedValueOnce(error).mockResolvedValueOnce({ id: 1 });
        renderLayout();
        await screen.findByRole('heading', { name: 'Unable to check your session' });
        expect(screen.queryByText('Admin login')).not.toBeInTheDocument();
        expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await screen.findByText('Dashboard content');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('redirects a confirmed unauthorized session to login', async () => {
        fetchMock.mockRejectedValueOnce(new ApiError('Unauthenticated', 401));
        renderLayout();
        await screen.findByText('Admin login');
        expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('cancels the pending session check when the layout is left', async () => {
        let reject!: (error: unknown) => void;
        fetchMock.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
        const view = renderLayout();
        const signal = fetchMock.mock.calls[0][1]?.signal;
        expect(signal?.aborted).toBe(false);
        view.unmount();
        expect(signal?.aborted).toBe(true);
        await act(async () => reject(new ApiError('Unauthenticated', 401)));
        expect(screen.queryByText('Admin login')).not.toBeInTheDocument();
    });

    it('navigates to Settings without checking or logging out of an already verified session', async () => {
        fetchMock.mockResolvedValue({ id: 1 });
        renderLayout();
        await screen.findByText('Dashboard content');
        fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
        await screen.findByText('Settings content');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    });

    it('retains the admin screen after a failed logout and leaves only after a successful retry', async () => {
        fetchMock.mockResolvedValueOnce({ id: 1 })
            .mockRejectedValueOnce(new ApiError('Bad gateway', 502))
            .mockResolvedValueOnce({ message: 'Logged out' });
        renderLayout();
        await screen.findByText('Dashboard content');
        fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
        await screen.findByText('Could not log out. Please try again.');
        expect(screen.getByText('Dashboard content')).toBeInTheDocument();
        expect(screen.queryByText('Admin login')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
        await screen.findByText('Admin login');
        expect(fetchMock.mock.calls.filter(([url]) => url === '/admin/logout')).toHaveLength(2);
    });

    it('opens a labelled mobile dialog and closes it with Escape, restoring focus', async () => {
        fetchMock.mockResolvedValue({ id: 1 });
        renderLayout();
        await screen.findByText('Dashboard content');
        const opener = screen.getByRole('button', { name: 'Open navigation menu' });
        opener.focus();
        fireEvent.click(opener);
        expect(screen.getByRole('dialog', { name: 'Midia Admin' })).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus();
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(opener).toHaveFocus();
        expect(opener).toHaveAttribute('aria-expanded', 'false');
        expect(document.body.style.overflow).toBe('');
    });
});
