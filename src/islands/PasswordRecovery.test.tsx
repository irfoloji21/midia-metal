import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import ForgotPasswordIsland from './ForgotPasswordIsland';
import ResetPasswordIsland from './ResetPasswordIsland';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, '', '/'); });
afterEach(cleanup);

it('sends a reset-link request to the versioned customer route and shows confirmation', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ message: 'Sent' });
  render(<ForgotPasswordIsland />);
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'customer@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email Password Reset Link' }));
  expect(await screen.findByText(/We have emailed your password reset link/)).toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledWith('/v1/customer/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'customer@example.com' }) });
});

it('submits the link credentials and matching passwords to the versioned reset route', async () => {
  window.history.replaceState({}, '', '/reset-password?token=reset-token&email=customer%2Btest%40example.com');
  vi.mocked(apiFetch).mockRejectedValue({ status: 422 });
  render(<ResetPasswordIsland />);
  fireEvent.change(screen.getByLabelText('New Password', { exact: true }), { target: { value: 'NewPassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPassword123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/v1/customer/reset-password', { method: 'POST', body: JSON.stringify({ email: 'customer+test@example.com', password: 'NewPassword123!', password_confirmation: 'NewPassword123!', token: 'reset-token' }) }));
});
