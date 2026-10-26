import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SectionTemplateEditor from './SectionTemplateEditor';
import { apiFetch } from '@/lib/api';
import { LAYOUT_BLOCKS } from '@/lib/layout-blocks';
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/content-templates', () => ({ getContentTemplates: () => [{ id: 'dd7', title: 'DD7 fan', sourceLabel: 'Existing DD7 product', sections: [
  { id: 'intro', title: 'Introduction', html: '<h2>Fan introduction</h2><p>Original intro</p><img src="/old.webp" alt="Fan photo">' },
  { id: 'data', title: 'Performance table', html: '<h2>Performance</h2><table><tbody><tr><th>Flow</th><td>1400</td></tr></tbody></table>' },
] }] }));
const changed = vi.fn();
function Editor({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <><SectionTemplateEditor label="Description" value={value} onChange={html => { setValue(html); changed(html); }} templateKind="product" /><output data-testid="value">{value}</output><button onClick={() => setValue('<p>Another record</p>')}>Load another record</button></>;
}
const saved = () => screen.getByTestId('value').textContent!;
const doc = () => new DOMParser().parseFromString(saved(), 'text/html');
const layoutButton = (type: string) => screen.getByRole('button', { name: LAYOUT_BLOCKS.find(layout => layout.type === type)!.title });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Protected section layout editing', () => {
  it.each(['image-left','image-right','images-2','images-3','text','image'])('offers fixed photo/text slots for %s without editable scaffold', type => {
    const { container } = render(<Editor />); fireEvent.click(layoutButton(type));
    expect(doc().querySelector(`.layout-block--${type}`)).not.toBeNull();
    const photos = type === 'images-3' ? 3 : type === 'images-2' ? 2 : type === 'text' ? 0 : 1;
    expect(container.querySelectorAll('[data-protected-image-slot]')).toHaveLength(photos);
    expect(container.querySelectorAll('input[type=file]')).toHaveLength(photos);
    expect(container.querySelector('[contenteditable] .layout-block,[contenteditable] .layout-media,[contenteditable] img')).toBeNull();
  });
  it('clearing all text leaves fixed media/copy slots and section boundaries intact', () => {
    const { container } = render(<Editor />); fireEvent.click(layoutButton('image-left'));
    const editor = container.querySelector('[contenteditable=true]')!; editor.innerHTML = ''; fireEvent.input(editor);
    expect(doc().querySelectorAll('.layout-media')).toHaveLength(1);
    expect(doc().querySelectorAll('.layout-copy')).toHaveLength(1);
    expect(doc().querySelectorAll('.content-section')).toHaveLength(1);
    expect(container.querySelector('[data-protected-image-slot]')).toHaveTextContent('Your photo goes here');
  });
  it('opens old content without writing and appends only the selected example', () => {
    render(<Editor initial='<h2>Existing work</h2><p>Keep this text</p>' />);
    expect(changed).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Use example content' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Performance table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add selected sections (1)' }));
    expect(doc().querySelectorAll('.content-section')).toHaveLength(2);
    expect(doc().body.textContent).toContain('Keep this text'); expect(doc().body.textContent).toContain('1400'); expect(doc().body.textContent).not.toContain('Original intro');
  });
  it('requires explicit removal, supports cancel/undo, and retains edits on duplicate/reorder', () => {
    const { container } = render(<Editor />); fireEvent.click(layoutButton('text'));
    const editor = container.querySelector('[contenteditable=true]')!; editor.innerHTML = '<h2>My heading</h2><p>My copy</p>'; fireEvent.input(editor);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate section 1' })); fireEvent.click(screen.getByRole('button', { name: 'Move section 2 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove section 1' })); expect(doc().querySelectorAll('.content-section')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Keep section' })); expect(doc().querySelectorAll('.content-section')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove section 1' })); fireEvent.click(screen.getByRole('button', { name: 'Yes, remove section' }));
    expect(doc().querySelectorAll('.content-section')).toHaveLength(1); fireEvent.click(screen.getByRole('button', { name: 'Undo remove' }));
    expect(doc().querySelectorAll('.content-section')).toHaveLength(2); expect(doc().querySelectorAll('h2')).toHaveLength(2); expect(doc().body.textContent).toContain('My copy');
  });
  it('uploads into the selected photo slot and preserves the empty neighbour after reopening', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: '/second.webp' }); const { container, unmount } = render(<Editor />); fireEvent.click(layoutButton('images-2'));
    fireEvent.change(container.querySelectorAll('input[type=file]')[1], { target: { files: [new File(['photo'], 'second.webp', { type: 'image/webp' })] } });
    await waitFor(() => expect(doc().querySelectorAll('.layout-media')[1].querySelector('img')?.getAttribute('src')).toBe('/second.webp'));
    expect(doc().querySelectorAll('.layout-media')[0].querySelector('img')).toBeNull(); const html = saved(); unmount(); const next = render(<Editor initial={html} />);
    fireEvent.click(screen.getByRole('button', { name: `1. ${LAYOUT_BLOCKS.find(x => x.type === 'images-2')!.title}` }));
    expect(next.container.querySelectorAll('[data-protected-image-slot]')).toHaveLength(2); expect(doc().querySelectorAll('.layout-media')[1].querySelector('img')?.getAttribute('src')).toBe('/second.webp');
  });
  it('opens only the chosen gallery picker without submitting and leaves a cancelled choice unchanged', () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { container } = render(<form onSubmit={submit}><Editor /><button type="submit">Save form</button></form>);
    fireEvent.click(layoutButton('images-3'));
    const original = saved();
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type=file]'));
    const pickers = inputs.map(input => vi.spyOn(input, 'click'));
    const chooser = screen.getByRole('button', { name: 'Choose Description section 1 photo 2' });
    expect(chooser).toHaveAttribute('type', 'button');
    fireEvent.click(chooser);
    expect(pickers[0]).not.toHaveBeenCalled();
    expect(pickers[1]).toHaveBeenCalledTimes(1);
    expect(pickers[2]).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(inputs[1], { target: { files: [] } });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(saved()).toBe(original);
    expect(chooser).toBeEnabled();
    fireEvent.click(chooser);
    expect(pickers[1]).toHaveBeenCalledTimes(2);
  });
  it('keeps an existing photo and copy after invalid replacement and allows choosing again', () => {
    const original = '<div class="content-section"><div class="layout-block layout-block--image-left"><div class="layout-media"><img src="/existing.webp" alt="Existing photo"></div><div class="layout-copy"><h2>Keep this heading</h2><p>Existing copy</p></div></div></div>';
    const { container } = render(<Editor initial={original} />);
    fireEvent.click(screen.getByRole('button', { name: `1. ${LAYOUT_BLOCKS.find(layout => layout.type === 'image-left')!.title}` }));
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    const picker = vi.spyOn(input, 'click');
    const chooser = screen.getByRole('button', { name: 'Replace Description section 1 photo 1' });
    fireEvent.click(chooser);
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG');
    expect(apiFetch).not.toHaveBeenCalled();
    expect(saved()).toBe(original);
    expect(chooser).toBeEnabled();
    fireEvent.click(chooser);
    expect(picker).toHaveBeenCalledTimes(2);
  });
  it('retains existing content after a failed replacement and accepts a retry from the same chooser', async () => {
    const original = '<div class="content-section"><div class="layout-block layout-block--image-left"><div class="layout-media"><img src="/existing.webp" alt="Existing photo"></div><div class="layout-copy"><h2>Keep this heading</h2><p>Existing copy</p></div></div></div>';
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Upload connection failed')).mockResolvedValueOnce({ url: '/replacement.webp' });
    const { container } = render(<Editor initial={original} />);
    fireEvent.click(screen.getByRole('button', { name: `1. ${LAYOUT_BLOCKS.find(layout => layout.type === 'image-left')!.title}` }));
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    const picker = vi.spyOn(input, 'click');
    const chooser = screen.getByRole('button', { name: 'Replace Description section 1 photo 1' });
    const file = new File(['photo'], 'replacement.webp', { type: 'image/webp' });
    fireEvent.click(chooser);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Upload connection failed'));
    expect(saved()).toBe(original);
    expect(chooser).toBeEnabled();
    fireEvent.click(chooser);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(doc().querySelector('.layout-media img')?.getAttribute('src')).toBe('/replacement.webp'));
    expect(doc().querySelector('.layout-media img')?.getAttribute('alt')).toBe('Existing photo');
    expect(doc().querySelector('.layout-copy')?.textContent).toBe('Keep this headingExisting copy');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(picker).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
  it('merges a finished photo upload with text edited while it was uploading', async () => {
    let finish!: (value: {url:string}) => void; vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }) as any);
    const { container } = render(<Editor />); fireEvent.click(layoutButton('image-left'));
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['photo'], 'photo.webp', { type: 'image/webp' })] } });
    const editor = container.querySelector('[contenteditable=true]')!; editor.innerHTML = '<p>Edited while uploading</p>'; fireEvent.input(editor); finish({url:'/latest.webp'});
    await waitFor(() => expect(doc().querySelector('img')?.getAttribute('src')).toBe('/latest.webp')); expect(doc().body.textContent).toContain('Edited while uploading');
  });
  it('keeps both gallery photos when two uploads finish in the same React batch', async () => {
    const finish: Array<(value:{url:string}) => void> = [];
    vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => { finish.push(resolve); }) as any);
    const { container } = render(<Editor />); fireEvent.click(layoutButton('images-2'));
    const inputs = container.querySelectorAll('input[type=file]');
    fireEvent.change(inputs[0], { target: { files: [new File(['a'], 'a.webp', {type:'image/webp'})] } });
    fireEvent.change(inputs[1], { target: { files: [new File(['b'], 'b.webp', {type:'image/webp'})] } });
    await act(async () => { finish[0]({url:'/first.webp'}); finish[1]({url:'/second.webp'}); });
    expect(Array.from(doc().querySelectorAll('.layout-media img')).map(image => image.getAttribute('src'))).toEqual(['/first.webp','/second.webp']);
  });
  it('discards an upload after another saved record is loaded', async () => {
    let finish!: (value:{url:string}) => void; vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }) as any);
    const { container } = render(<Editor />); fireEvent.click(layoutButton('image'));
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'photo.webp', {type:'image/webp'})] } });
    fireEvent.click(screen.getByRole('button',{name:'Load another record'})); finish({url:'/stale.webp'});
    await waitFor(() => expect(saved()).toBe('<p>Another record</p>')); expect(screen.queryByRole('button',{name:'Undo remove'})).not.toBeInTheDocument();
  });
  it('prevents saving or switching sections until the selected photo finishes uploading', async () => {
    let finish!: (value:{url:string}) => void; vi.mocked(apiFetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }) as any);
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { container } = render(<form onSubmit={submit}><Editor /><button type="submit">Save form</button></form>);
    fireEvent.click(layoutButton('image'));
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'photo.webp', {type:'image/webp'})] } });
    expect(screen.getByRole('button', {name:'Remove section 1'})).toBeDisabled();
    expect(screen.getByRole('button', {name:'Add layout'})).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Please wait for the photo upload');
    finish({url:'/finished.webp'});
    await waitFor(() => expect(doc().querySelector('img')?.getAttribute('src')).toBe('/finished.webp'));
    await waitFor(() => expect(screen.getByRole('button', {name:'Remove section 1'})).toBeEnabled());
    fireEvent.submit(container.querySelector('form')!); expect(submit).toHaveBeenCalledTimes(1);
  });
  it('rejects non-photo files without deleting the photo area', () => {
    const { container } = render(<Editor />); fireEvent.click(layoutButton('image'));
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['bad'], 'bad.svg', {type:'image/svg+xml'})] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG'); expect(apiFetch).not.toHaveBeenCalled(); expect(doc().querySelectorAll('.layout-media')).toHaveLength(1);
  });
  it('sanitizes preview without changing the saved original', () => {
    render(<Editor initial='<h2>Sample</h2><img src="/fan.webp" onerror="bad()"><script>bad()</script>' />); fireEvent.click(screen.getByRole('button',{name:'Preview'}));
    expect(screen.getByRole('region',{name:'Description preview'}).querySelector('script,[onerror]')).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
});
