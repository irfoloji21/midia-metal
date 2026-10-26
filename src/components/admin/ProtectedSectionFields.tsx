import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, LockKeyhole } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { apiFetch } from '@/lib/api';
import { readProtectedSection, updateSectionImage, updateSectionText } from '@/lib/layout-blocks';

type Props = { value: string; onChange: (html: string) => void; label: string; onUploadingChange?: (uploading: boolean) => void };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export default function ProtectedSectionFields({ value, onChange, label, onUploadingChange }: Props) {
  const instance = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const photoInputs = useRef(new Map<string, HTMLInputElement>());
  const fields = useMemo(() => readProtectedSection(value), [value]);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const mounted = useRef(true);
  const requests = useRef(new Map<string, symbol>());
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { onUploadingChange?.(uploading.length > 0); return () => onUploadingChange?.(false); }, [uploading.length, onUploadingChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; requests.current.clear(); }; }, []);
  useEffect(() => {
    const form = wrapper.current?.closest('form');
    if (!form || !uploading.length) return undefined;
    const waitForUpload = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      setErrors(current => ({ ...current, section: 'Please wait for the photo upload to finish, then save.' }));
    };
    form.addEventListener('submit', waitForUpload, true);
    return () => form.removeEventListener('submit', waitForUpload, true);
  }, [uploading.length]);
  const publish = (html: string) => {
    // Concurrent gallery uploads can finish before React renders the first result.
    latest.current = { ...latest.current, value: html };
    latest.current.onChange(html);
  };
  const edit = (change: (html: string) => string) => {
    try { publish(change(latest.current.value)); setErrors(current => ({ ...current, section: '' })); }
    catch { setErrors(current => ({ ...current, section: 'This area changed while editing. Close this section and open it again.' })); }
  };

  const upload = async (id: string, files: File[]) => {
    if (requests.current.has(id)) return;
    const file = files[0];
    const fail = (message: string) => setErrors(current => ({ ...current, [id]: message }));
    if (!file) return;
    if (files.length !== 1) return fail('Choose one photo for this area.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return fail('Choose a JPG, PNG, WebP or GIF image.');
    if (file.size > MAX_IMAGE_BYTES) return fail('This photo is too large. Choose a photo smaller than 2MB.');
    const original = readProtectedSection(latest.current.value).imageFields.find(field => field.id === id);
    if (!original) return;
    const token = Symbol(id);
    requests.current.set(id, token);
    setUploading(current => [...current, id]);
    setErrors(current => ({ ...current, [id]: '' }));
    try {
      const data = new FormData();
      data.append('image', file);
      const response = await apiFetch<{ url: string }>('/admin/upload', { method: 'POST', body: data });
      if (!mounted.current || requests.current.get(id) !== token) return;
      if (typeof response?.url !== 'string' || !/^(https?:\/\/|\/(?!\/))/i.test(response.url)) throw new Error('The image upload did not return a usable address.');
      const current = readProtectedSection(latest.current.value).imageFields.find(field => field.id === id);
      if (!current || current.src !== original.src) return;
      publish(updateSectionImage(latest.current.value, id, { src: response.url, alt: current.alt }));
    } catch (error) {
      if (mounted.current && requests.current.get(id) === token) fail(error instanceof Error ? error.message : 'The photo could not be uploaded. Try again.');
    } finally {
      if (mounted.current && requests.current.get(id) === token) {
        requests.current.delete(id);
        setUploading(current => current.filter(item => item !== id));
        setErrors(current => current.section?.startsWith('Please wait for the photo upload') ? { ...current, section: '' } : current);
      }
    }
  };

  const images = fields.imageFields.map((field, index) => {
    const busy = uploading.includes(field.id);
    const inputId = `${instance}-photo-${index}`;
    return <div key={field.id} className="min-w-0 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3" data-protected-image-slot="" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); void upload(field.id, Array.from(event.dataTransfer.files)); }}>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#10275c]"><span>Photo {index + 1}</span><LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" /></div>
      <button type="button" aria-label={`${field.src ? 'Replace' : 'Choose'} ${label} photo ${index + 1}`} disabled={busy} onClick={() => photoInputs.current.get(field.id)?.click()} className={`flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-slate-200 bg-white p-3 text-center hover:border-orange ${busy ? 'cursor-wait opacity-60' : ''}`}>
        {field.src ? <img src={field.src} alt={field.alt || `Photo ${index + 1}`} className="h-44 w-full object-contain" draggable={false} /> : <><ImagePlus className="h-10 w-10 text-slate-400" aria-hidden="true" /><span className="text-sm text-slate-600">Your photo goes here</span></>}
        <span className="inline-flex items-center gap-2 rounded-md bg-[#10275c] px-4 py-2 text-sm font-semibold text-white">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</> : field.src ? 'Replace photo' : 'Choose photo'}</span>
      </button>
      {/* A focusable off-screen file input can scroll the outer modal away from its panel. */}
      <input ref={node => { if (node) photoInputs.current.set(field.id, node); else photoInputs.current.delete(field.id); }} id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label={`${label} photo ${index + 1}`} disabled={busy} onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ''; void upload(field.id, files); }} />
      <p className="mt-2 text-xs text-slate-500">Choose a file or drop it here. JPG, PNG, WebP, GIF · max 2MB.</p>
      {errors[field.id] && <p role="alert" className="mt-2 text-sm text-red-700">{errors[field.id]}</p>}
      <label className="mt-3 block text-xs font-medium text-slate-600">Photo description<input aria-label={`${label} photo ${index + 1} description`} type="text" value={field.alt} disabled={!field.src} placeholder={field.src ? 'Describe the photo' : 'Choose a photo first'} className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-slate-100" onChange={event => { const alt = event.target.value; edit(html => updateSectionImage(html, field.id, { src: field.src, alt })); }} /></label>
    </div>;
  });
  const text = fields.textFields.length > 0 && <div className="min-w-0 space-y-3" data-protected-text-slots="">{fields.textFields.map((field, index) => <div key={field.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"><RichTextEditor label={`${label} ${field.label || `text ${index + 1}`}`} value={field.html} textOnly documentLayout onChange={textHtml => edit(html => updateSectionText(html, field.id, textHtml))} helperText="Only this text area changes. Photo areas and layout stay in place." /></div>)}</div>;
  const sideBySide = fields.layout === 'image-left' || fields.layout === 'image-right';
  const galleryClass = fields.layout === 'images-3' ? 'grid gap-3 md:grid-cols-3' : fields.layout === 'images-2' ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3';

  return <div ref={wrapper} className="space-y-3" data-protected-section-fields="" aria-busy={uploading.length > 0}>
    <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />Layout protected. Change the photos and text in the areas below.</p>
    {errors.section && <p role="alert" className="text-sm text-red-700">{errors.section}</p>}
    {sideBySide ? <div className="grid items-start gap-4 lg:grid-cols-2">{fields.layout === 'image-right' ? <>{text}{images}</> : <>{images}{text}</>}</div> : <>{images.length > 0 && <div className={galleryClass}>{images}</div>}{text}</>}
    {!images.length && !text && <p className="rounded border border-slate-200 p-4 text-sm text-slate-600">This section has no editable text or photo fields. Its existing content is preserved.</p>}
  </div>;
}
