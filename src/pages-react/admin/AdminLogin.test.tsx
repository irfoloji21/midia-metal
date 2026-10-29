import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import AdminLogin from './AdminLogin';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.mocked(apiFetch);
const renderLogin = () => render(
    <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<h1>Admin dashboard</h1>} />
        </Routes>
    </MemoryRouter>,
);
const enterCredentials = () => {
    const email = screen.getByLabelText('Email Address');
    const password = screen.getByLabelText('Password', { exact: true });
    fireEvent.focus(email);
    fireEvent.change(email, { target: { value: 'administrator@example.test' } });
    fireEvent.blur(email);
    fireEvent.focus(password);
    fireEvent.change(password, { target: { value: '  audit password  ' } });
    fireEvent.blur(password);
};

describe('admin login starts with empty credentials', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(cleanup);

    it('starts empty, avoids automatic fill, and never sends a blank login request', () => {
        renderLogin();
        const email = screen.getByLabelText('Email Address');
        const password = screen.getByLabelText('Password', { exact: true });
        expect(email).toHaveValue('');
        expect(password).toHaveValue('');
        expect(email).toHaveAttribute('placeholder', 'Enter your email address');
        expect(password).toHaveAttribute('placeholder', 'Enter your password');
        expect(email).toHaveAttribute('readonly');
        expect(password).toHaveAttribute('readonly');
        expect(email).toHaveAttribute('autocomplete', 'off');
        expect(password).toHaveAttribute('autocomplete', 'off');
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
        fireEvent.submit(email.closest('form')!);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('unlocks each input on focus and keeps login disabled with missing credentials', () => {
        renderLogin();
        const email = screen.getByLabelText('Email Address');
        const password = screen.getByLabelText('Password', { exact: true });
        fireEvent.focus(email);
        expect(email).not.toHaveAttribute('readonly');
        expect(password).toHaveAttribute('readonly');
        fireEvent.change(email, { target: { value: 'administrator@example.test' } });
        fireEvent.blur(email);
        expect(email).not.toHaveAttribute('readonly');
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
        fireEvent.submit(email.closest('form')!);
        expect(fetchMock).not.toHaveBeenCalled();
        fireEvent.focus(password);
        expect(password).not.toHaveAttribute('readonly');
    });

    it('does not submit credentials filled before the user enters both fields', () => {
        renderLogin();
        const email = screen.getByLabelText('Email Address');
        const password = screen.getByLabelText('Password', { exact: true });
        fireEvent.change(email, { target: { value: 'administrator@example.test' } });
        fireEvent.change(password, { target: { value: 'saved audit password' } });
        fireEvent.submit(email.closest('form')!);
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
        expect(fetchMock).not.toHaveBeenCalled();
        fireEvent.focus(email);
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
        fireEvent.submit(email.closest('form')!);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('authenticates explicitly entered credentials without changing the password', async () => {
        fetchMock.mockResolvedValueOnce({});
        renderLogin();
        enterCredentials();
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
        await screen.findByRole('heading', { name: 'Admin dashboard' });
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'administrator@example.test', password: '  audit password  ' }),
        });
    });

    it('keeps failed login feedback and entered fields available for correction', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Invalid credentials.'));
        renderLogin();
        enterCredentials();
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials.'));
        expect(screen.queryByRole('heading', { name: 'Admin dashboard' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('Email Address')).toHaveValue('administrator@example.test');
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
        fireEvent.focus(screen.getByLabelText('Password', { exact: true }));
        expect(screen.getByLabelText('Password', { exact: true })).not.toHaveAttribute('readonly');
    });
});
