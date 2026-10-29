import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminSettings from './AdminSettings';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/admin/ImageUpload', () => ({ default: () => <button type="button">Upload image</button> }));
vi.mock('@/components/admin/RichTextEditor', () => ({ default: () => <div>Rich text editor</div> }));

const rows = [
  ['site_name', 'Midia M Metal', 'header'], ['site_logo', '', 'header'],
  ['company_email', 'old@example.com', 'general'], ['contact_email', 'info@midia-metal.com', 'footer'],
  ['contact_phone', '07545888522', 'footer'], ['contact_address', 'London factory address', 'footer'],
  ['contact_map_url', 'https://www.google.com/maps/embed?pb=custom', 'contact'],
  ['social_instagram', 'https://www.instagram.com/', 'footer'], ['footer_working_hours', 'Mon–Fri 9–6', 'footer'],
  ['header_nav_home', 'Home', 'header'], ['footer_nav_home', 'Home', 'footer'],
  ['footer_text', '© {{site_name}}', 'footer'], ['footer_info_cookies', 'Cookie Policy', 'footer'],
  ['contact_page_title', 'Contact', 'contact'], ['services_hero_phone', 'old number', 'services'],
  ['vat_rate', '20', 'shipping-tax'], ['tax_rate', '15', 'shipping-tax'],
  ['vat_enabled', '1', 'shipping-tax'], ['tax_enabled', '1', 'shipping-tax'],
].map(([key, value, group], id) => ({ id, key, value, group, type: key === 'site_logo' ? 'image' : 'text' }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return { updated: Object.keys(JSON.parse(options.body as string).settings) } as never;
    return (path === '/admin/settings' ? rows.map(s => ({ ...s })) : []) as never;
  });
});
afterEach(cleanup);
const open = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('General settings management', () => {
  it('replaces the old tabs with collapsed groups, preserving edits when switching groups', async () => {
    render(<AdminSettings />);
    await screen.findByRole('button', { name: 'Company & contact details' });
    expect(screen.queryByRole('button', { name: /^header$|^footer$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'shipping tax' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^(vat|tax) (rate|enabled)$/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(7);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    open('Company & contact details');
    expect(screen.getByLabelText('Contact email')).toHaveValue('info@midia-metal.com');
    expect(screen.getByLabelText('Location map URL')).toBeVisible();
    expect(screen.queryByDisplayValue('old@example.com')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'changed@example.com' } });
    open('Social media');
    expect(screen.getByRole('button', { name: 'Company & contact details' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Contact email')).not.toBeVisible();
    expect(screen.getByLabelText('Instagram profile URL')).toHaveValue('https://www.instagram.com/');
    open('Company & contact details');
    expect(screen.getByLabelText('Contact email')).toHaveValue('changed@example.com');
    open('Company & contact details');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('saves only changes in the selected tab, including fields in collapsed groups', async () => {
    render(<AdminSettings />);
    await screen.findByRole('button', { name: 'Company & contact details' });
    open('Company & contact details');
    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'new@example.com' } });
    open('Navigation labels');
    fireEvent.change(screen.getByLabelText('Main menu — Home'), { target: { value: 'Welcome' } });
    open('contact');
    fireEvent.change(screen.getByLabelText('page title'), { target: { value: 'Unsaved page title' } });
    open('general');
    open('Save General Settings');
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const puts = vi.mocked(apiFetch).mock.calls.filter(([, options]) => options?.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0][1]!.body as string)).toEqual({ settings: { contact_email: 'new@example.com', header_nav_home: 'Welcome' } });
    open('Save General Settings');
    expect(toast.info).toHaveBeenCalledWith('No changes to save');
    open('contact');
    expect(screen.getByLabelText('page title')).toHaveValue('Unsaved page title');
  });

  it('keeps edits available for retry when a save fails', async () => {
    render(<AdminSettings />);
    await screen.findByRole('button', { name: 'Company & contact details' });
    open('Company & contact details');
    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'retry@example.com' } });
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Connection failed'));
    open('Save General Settings');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Connection failed'));
    expect(screen.getByLabelText('Contact email')).toHaveValue('retry@example.com');
    open('Save General Settings');
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
