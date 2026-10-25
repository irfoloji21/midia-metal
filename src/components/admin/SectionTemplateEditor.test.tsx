import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SectionTemplateEditor from './SectionTemplateEditor';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/content-templates', () => ({ getContentTemplates: () => [{ id: 'dd7', title: 'DD7 fan', sourceLabel: 'Existing DD7 product', sections: [
  { id: 'intro', title: 'Introduction', html: '<h2>Fan introduction</h2><p>Original intro</p><img src="/old.webp" alt="Fan photo">' },
  { id: 'data', title: 'Performance table', html: '<h2>Performance</h2><table><tbody><tr><th>Flow</th><td>1400</td></tr></tbody></table>' },
] }] }));
const changed = vi.fn();
function Editor({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <><SectionTemplateEditor label="Description" value={value} onChange={html => { setValue(html); changed(html); }} templateKind="product" wordPaste /><output data-testid="value">{value}</output><button onClick={() => setValue('<p>Another record</p>')}>Load another record</button></>;
}
const saved = () => screen.getByTestId('value').textContent!;
const doc = () => new DOMParser().parseFromString(saved(), 'text/html');
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Section template editing', () => {
  it('opens existing content without writing, and appends only the chosen template section', () => {
    const initial = '<h2>Existing work</h2><p>Keep this text</p>';
    render(<Editor initial={initial} />);
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add from template' }));
    expect(screen.getByRole('button', { name: 'Add selected sections (0)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Performance table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected sections (1)' }));
    expect(doc().querySelectorAll('.content-section')).toHaveLength(2);
    expect(doc().body.textContent).toContain('Keep this text');
    expect(doc().body.textContent).toContain('1400');
    expect(doc().body.textContent).not.toContain('Original intro');
  });
  it('adds a full template and preserves edits, images and tables when reordered and reopened', () => {
    const { unmount } = render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add full template' }));
    const editor = screen.getByRole('textbox', { name: 'Description section 1' });
    editor.querySelector('p')!.textContent = 'Edited fan overview';
    fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: 'Move section 1 down' }));
    expect(screen.getByRole('textbox', { name: 'Description section 2' })).toBe(editor);
    const html = saved();
    unmount(); render(<Editor initial={html} />);
    fireEvent.click(screen.getByRole('button', { name: '2. Fan introduction' }));
    expect(screen.getByRole('textbox')).toHaveTextContent('Edited fan overview');
    expect(screen.getByAltText('Fan photo')).toHaveAttribute('src', '/old.webp');
    expect(doc().querySelector('.content-section')?.textContent).toContain('1400');
  });
  it('duplicates independently and removes/undoes without losing edits to another section', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add full template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate section 1' }));
    const copy = screen.getByRole('textbox', { name: 'Description section 2' });
    copy.querySelector('p')!.textContent = 'Copy only';fireEvent.input(copy);
    fireEvent.click(screen.getByRole('button', { name: 'Remove section 1' }));
    expect(doc().querySelectorAll('.content-section')).toHaveLength(2);
    expect(doc().body.textContent).not.toContain('Original intro');
    fireEvent.click(screen.getByRole('button', { name: 'Undo remove' }));
    expect(doc().querySelectorAll('.content-section')).toHaveLength(3);
    expect(doc().body.textContent).toContain('Original intro');
    expect(doc().body.textContent).toContain('Copy only');
  });
  it('replaces a section picture through upload and keeps it after reopening', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: '/replacement.webp' });
    const { container, unmount } = render(<Editor />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Introduction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected sections (1)' }));
    fireEvent.click(screen.getByAltText('Fan photo'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace photo' }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['photo'], 'new.webp', { type: 'image/webp' })] } });
    await waitFor(() => expect(doc().querySelector('img')?.getAttribute('src')).toBe('/replacement.webp'));
    const html = saved();unmount();render(<Editor initial={html} />);
    fireEvent.click(screen.getByRole('button', { name: '1. Fan introduction' }));
    expect(screen.getByAltText('Fan photo')).toHaveAttribute('src', '/replacement.webp');
    expect(doc().querySelectorAll('img')).toHaveLength(1);
  });
  it('offers a safe preview without writing or executing pasted active content', () => {
    render(<Editor initial='<h2>Sample</h2><p>Hello</p><img src="/fan.webp" onerror="bad()"><script>bad()</script>' />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const preview = screen.getByRole('region', { name: 'Description preview' });
    expect(preview.querySelector('script,[onerror]')).toBeNull();
    expect(preview).toHaveTextContent('Hello');
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to editing' }));
    expect(screen.getByRole('button', { name: '1. Sample' })).toBeVisible();
  });
  it('drops old undo/selection state when another saved record is loaded', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Add full template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove section 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load another record' }));
    expect(screen.queryByRole('button', { name: 'Undo remove' })).not.toBeInTheDocument();
    expect(saved()).toBe('<p>Another record</p>');
    expect(screen.getByRole('button', { name: '1. Another record' })).toBeVisible();
  });
  it('can delete the last section then start again with an editable text section', () => {
    render(<Editor initial='<p>Remove me</p>' />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove section 1' }));
    expect(saved()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Text section' }));
    expect(screen.getByRole('textbox')).toHaveTextContent('Add your text here.');
    expect(doc().querySelectorAll('.content-section')).toHaveLength(1);
  });
});
