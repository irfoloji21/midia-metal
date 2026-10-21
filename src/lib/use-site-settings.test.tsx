import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';
import { useSiteSettings } from './use-site-settings';

vi.mock('./api', () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function LayoutPart({ label }: { label: string }) {
  const settings = useSiteSettings();
  return <span>{label}: {settings.contact_email}</span>;
}

describe('shared public settings refresh', () => {
  it('shares a fetch between layout islands and refreshes them after Astro navigation', async () => {
    vi.mocked(apiFetch).mockResolvedValue([{ key: 'contact_email', value: 'first@example.com' }]);
    render(<><LayoutPart label="Header" /><LayoutPart label="Footer" /></>);
    await screen.findByText('Header: first@example.com');
    expect(screen.getByText('Footer: first@example.com')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    vi.mocked(apiFetch).mockResolvedValue([{ key: 'contact_email', value: 'updated@example.com' }]);
    await act(async () => { document.dispatchEvent(new Event('astro:after-swap')); });
    await waitFor(() => expect(screen.getByText('Footer: updated@example.com')).toBeInTheDocument());
    expect(screen.getByText('Header: updated@example.com')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
