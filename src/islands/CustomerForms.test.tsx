import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { loginCustomer, logoutCustomer, $customer, type Customer } from '@/stores/auth';
import { toast } from 'sonner';
import ContactForm from './ContactForm';
import QuoteForm from './QuoteForm';
import LoginIsland from './LoginIsland';

vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => { vi.resetAllMocks(); logoutCustomer(); vi.stubGlobal('location', { href: '/contact', search: '' }); });
afterEach(() => { cleanup(); logoutCustomer(); vi.unstubAllGlobals(); });
const input = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('requires contact privacy consent, preserves a failed enquiry and permits a successful retry', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ message: 'Received' });
  render(<ContactForm />);
  input('Full Name', 'Test Contact');
  input('Email Address', 'test@example.test');
  input('Enter your message.', 'Please advise about a ventilation unit.');
  fireEvent.click(screen.getByRole('button', { name: 'Send Enquiry' }));
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent('privacy policy');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Send Enquiry' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be sent');
  expect(screen.getByLabelText('Enter your message.')).toHaveValue('Please advise about a ventilation unit.');
  expect(screen.getByRole('checkbox')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Send Enquiry' }));
  expect(await screen.findByRole('status')).toHaveTextContent('has been received');
  expect(screen.getByLabelText('Full Name')).toHaveValue('');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

it('blocks duplicate contact submissions while the request is pending', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(apiFetch).mockReturnValue(new Promise(yes => { resolve = yes; }));
  render(<ContactForm />);
  input('Full Name', 'Test Contact');
  input('Email Address', 'test@example.test');
  input('Enter your message.', 'Quotation enquiry');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Send Enquiry' }));
  const pending = screen.getByRole('button', { name: 'Sending...' });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(apiFetch).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ message: 'Received' }); });
});

it('keeps manually entered quotation details when customer session loading completes later', async () => {
  window.location.search = '?product=DD7%20Fan&product_id=7&options=Size%3A%20150';
  render(<QuoteForm />);
  expect(screen.getByLabelText('Your Requirements *')).toHaveValue('Quotation request: DD7 Fan (Product reference: 7).\nSelected options: Size: 150\n\nRequirements: ');
  input('Full Name *', 'Different project contact');
  input('Your Requirements *', 'Please quote for two units.');
  await act(async () => { loginCustomer({ id: 2, name: 'Account customer', email: 'account@example.test', phone: '02012345678' } as Customer); });
  expect(screen.getByLabelText('Full Name *')).toHaveValue('Different project contact');
  expect(screen.getByLabelText('Your Requirements *')).toHaveValue('Please quote for two units.');
  expect(screen.getByLabelText('Email Address *')).toHaveValue('account@example.test');
});

it('filters unsupported quote attachments and preserves valid files across a failed request', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValueOnce({ message: 'Received' });
  render(<QuoteForm />);
  input('Full Name *', 'Test Quote');
  input('Email Address *', 'quote@example.test');
  input('Your Requirements *', 'Please quote for a canopy.');
  const valid = new File(['drawing'], 'drawing.pdf', { type: 'application/pdf' });
  const invalid = new File(['not allowed'], 'script.exe', { type: 'application/octet-stream' });
  fireEvent.change(screen.getByLabelText('Drawings and Photographs (optional)'), { target: { files: [valid, invalid] } });
  expect(screen.getByText('drawing.pdf')).toBeInTheDocument();
  expect(screen.queryByText('script.exe')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send Quotation Request' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Temporary failure'));
  expect(screen.getByLabelText('Your Requirements *')).toHaveValue('Please quote for a canopy.');
  expect(screen.getByText('drawing.pdf')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send Quotation Request' }));
  expect(await screen.findByText('Quotation request received.')).toBeInTheDocument();
  const body = vi.mocked(apiFetch).mock.calls[1][1]?.body as FormData;
  expect(body.get('name')).toBe('Test Quote');
  expect(body.getAll('files[]')).toEqual([valid]);
});

it('keeps a failed login editable, then updates the shared customer session after retry', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Invalid credentials')).mockResolvedValueOnce({ customer: { id: 3, name: 'Buyer', email: 'buyer@example.test' } });
  render(<LoginIsland />);
  input('Email address *', 'buyer@example.test');
  input('Password *', 'Test-only-password');
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials'));
  expect($customer.get()).toBeNull();
  expect(screen.getByLabelText('Email address *')).toHaveValue('buyer@example.test');
  expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(window.location.href).toBe('/account'));
  expect($customer.get()?.id).toBe(3);
});
