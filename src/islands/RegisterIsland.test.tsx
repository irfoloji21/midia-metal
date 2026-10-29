import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { loginCustomer } from '@/stores/auth';
import RegisterIsland from './RegisterIsland';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/stores/auth', () => ({ loginCustomer: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const registration = {
    name: 'QA Test Customer',
    email: 'qa-register@example.invalid',
    phone: '01234567890',
    password: 'Test-only-password-24!',
    password_confirmation: 'Test-only-password-24!',
};
const fillForm = (confirmation = registration.password_confirmation) => {
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: registration.name } });
    fireEvent.change(screen.getByLabelText('Email address *'), { target: { value: registration.email } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: registration.phone } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: registration.password } });
    fireEvent.change(screen.getByLabelText('Confirm *'), { target: { value: confirmation } });
};

describe('customer registration interaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('location', { href: '/register' });
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it('submits the filled form, prevents duplicate clicks and enters the new account', async () => {
        let complete!: (value: unknown) => void;
        vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
        render(<RegisterIsland />);
        fillForm();
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        const pending = screen.getByRole('button', { name: 'Registering...' });
        expect(pending).toBeDisabled();
        fireEvent.click(pending);
        expect(apiFetch).toHaveBeenCalledTimes(1);
        const [endpoint, options] = vi.mocked(apiFetch).mock.calls[0];
        expect(endpoint).toBe('/v1/customer/register');
        expect(options?.method).toBe('POST');
        expect(JSON.parse(options?.body as string)).toEqual(registration);
        const customer = { id: 321, name: registration.name, email: registration.email };
        await act(async () => complete({ customer }));
        expect(loginCustomer).toHaveBeenCalledWith(customer);
        expect(toast.success).toHaveBeenCalledWith('Account created successfully!');
        expect(window.location.href).toBe('/account');
    });

    it('shows a password mismatch without sending the form and can recover after correction', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new Error('The email has already been taken.'));
        render(<RegisterIsland />);
        fillForm('Different-test-password!');
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        expect(toast.error).toHaveBeenCalledWith('Passwords do not match');
        expect(apiFetch).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Confirm *'), { target: { value: registration.password } });
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The email has already been taken.'));
        expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
        expect(loginCustomer).not.toHaveBeenCalled();
        expect(window.location.href).toBe('/register');
    });

    it('keeps entered values and allows retry after a server failure', async () => {
        vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Bad gateway'))
            .mockResolvedValueOnce({ customer: { id: 322, name: registration.name, email: registration.email } });
        render(<RegisterIsland />);
        fillForm();
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bad gateway'));
        expect(screen.getByLabelText('Email address *')).toHaveValue(registration.email);
        expect(screen.getByLabelText('Password *')).toHaveValue(registration.password);
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        await waitFor(() => expect(window.location.href).toBe('/account'));
        expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('blocks native invalid required fields before the submit handler runs', () => {
        render(<RegisterIsland />);
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));
        expect(screen.getByLabelText('Full Name *')).toBeInvalid();
        expect(apiFetch).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });
});
