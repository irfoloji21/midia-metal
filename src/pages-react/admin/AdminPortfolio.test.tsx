import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPortfolio from './AdminPortfolio';
import { apiFetch } from '@/lib/api';

const state = vi.hoisted(() => ({ projects: [] as any[], reload: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-paginated-admin-list', () => ({
  usePaginatedAdminList: () => ({ items: state.projects, setItems: vi.fn(), reload: state.reload, setPage: vi.fn(), loading: false, page: 1, total: state.projects.length, lastPage: 1 }),
}));
vi.mock('@/components/admin/ListPagination', () => ({ default: () => null }));
vi.mock('@/components/admin/ImageUpload', () => ({
  default: ({ label, value, onChange }: any) => label ? <label>{label}<input value={value} onChange={event => onChange(event.target.value)} /></label> : null,
}));
vi.mock('@/components/admin/SectionTemplateEditor', () => ({
  default: ({ label, value, onChange, templateKind }: any) => <div data-testid="section-editor" data-template-kind={templateKind}>
    <label>{label}<textarea value={value} onChange={event => onChange(event.target.value)} /></label>
    <button type="button" onClick={() => onChange('<div class="content-section"><h2>Project scope</h2><p>Installation</p></div>')}>Choose project section</button>
  </div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.projects = [];
  vi.mocked(apiFetch).mockResolvedValue([] as never);
});
afterEach(cleanup);

describe('Portfolio section template integration', () => {
  it('creates an unpublished project and saves the selected section content', async () => {
    render(<AdminPortfolio />);
    fireEvent.click(screen.getByRole('button', { name: 'Create from template' }));
    expect(screen.getByTestId('section-editor')).toHaveAttribute('data-template-kind', 'portfolio');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Active' })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New project' } });
    fireEvent.change(screen.getByLabelText('Main Project Image (required)'), { target: { value: '/images/project.webp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose project section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Project' }));
    await waitFor(() => expect(state.reload).toHaveBeenCalledOnce());
    const write = vi.mocked(apiFetch).mock.calls.find(([, options]) => options?.method === 'POST');
    expect(write?.[0]).toBe('/admin/portfolio');
    expect(JSON.parse(write![1]!.body as string)).toMatchObject({
      title: 'New project', active: false, image: '/images/project.webp',
      description: '<div class="content-section"><h2>Project scope</h2><p>Installation</p></div>',
    });
  });

  it('preserves existing plain text and other project data when editing its title', async () => {
    const description = 'Measurements: 2 < 3.\nSecond line.';
    state.projects = [{ id: 7, title: 'Existing project', image: '/images/main.webp', description, active: true, gallery: ['/images/gallery.webp'], client: 'Original client' }];
    render(<AdminPortfolio />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Existing project' }));
    expect(screen.getByLabelText('Description')).toHaveValue(description);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Project' }));
    await waitFor(() => expect(state.reload).toHaveBeenCalledOnce());
    const write = vi.mocked(apiFetch).mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(write?.[0]).toBe('/admin/portfolio/7');
    expect(JSON.parse(write![1]!.body as string)).toMatchObject({ description, active: true, gallery: ['/images/gallery.webp'], client: 'Original client' });
  });

  it('does not create a project when a template draft is cancelled', async () => {
    render(<AdminPortfolio />);
    fireEvent.click(screen.getByRole('button', { name: 'Create from template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose project section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/admin/portfolio-categories'));
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(vi.mocked(apiFetch).mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PUT')).toBe(false);
    expect(state.reload).not.toHaveBeenCalled();
  });
});
