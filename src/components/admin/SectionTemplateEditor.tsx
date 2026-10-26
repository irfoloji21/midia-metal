import { useEffect, useId, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Eye, LayoutTemplate, Plus, RotateCcw, Trash2 } from 'lucide-react';
import ProtectedSectionFields from './ProtectedSectionFields';
import { createLayoutBlock, LAYOUT_BLOCKS, readProtectedSection, type LayoutBlockType } from '@/lib/layout-blocks';
import { getContentTemplates, type ContentTemplateKind } from '@/lib/content-templates';
import { blankTableSection, createContentSection, moveContentSection, readContentSections, sectionTitle, writeContentSections, type ContentSection } from '@/lib/content-sections';
import '@/content-sections.css';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  templateKind: ContentTemplateKind;
  layoutOnly?: boolean;
  settingKey?: string;
  helperText?: string;
  serviceLayout?: boolean;
  wordPaste?: boolean;
};

const control = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#10275c] hover:border-orange disabled:cursor-not-allowed disabled:opacity-40';

function LayoutDiagram({ type }: { type: LayoutBlockType }) {
  const photo = <span className="flex h-12 flex-1 items-center justify-center rounded bg-slate-200 text-lg text-slate-500">▧</span>;
  const copy = <span className="flex h-12 flex-1 flex-col justify-center gap-1.5 px-1"><span className="h-1.5 w-3/4 rounded bg-slate-400" /><span className="h-1 rounded bg-slate-300" /><span className="h-1 rounded bg-slate-300" /><span className="h-1 w-2/3 rounded bg-slate-300" /></span>;
  return <span aria-hidden="true" className="mb-3 flex w-full gap-2 rounded border border-slate-200 bg-white p-2">{type === 'image-left' ? <>{photo}{copy}</> : type === 'image-right' ? <>{copy}{photo}</> : type === 'images-2' ? <>{photo}{photo}</> : type === 'images-3' ? <>{photo}{photo}{photo}</> : type === 'image' ? photo : copy}</span>;
}

export default function SectionTemplateEditor({ label, value, onChange, templateKind, settingKey, layoutOnly = false }: Props) {
  const instanceId = useId();
  const [sections, setSections] = useState(() => readContentSections(value || '', templateKind === 'portfolio'));
  const sectionsRef = useRef(sections);
  const lastValue = useRef(value || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLayouts, setShowLayouts] = useState(!value?.trim());
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [removed, setRemoved] = useState<{ section: ContentSection; index: number } | null>(null);
  const [notice, setNotice] = useState('');
  const templates = getContentTemplates(templateKind, settingKey);
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const template = templates.find(item => item.id === templateId) || templates[0];

  useEffect(() => {
    if ((value || '') === lastValue.current) return;
    const next = readContentSections(value || '', templateKind === 'portfolio');
    sectionsRef.current = next;
    setSections(next);
    setEditingId(null);
    setRemoved(null);
    setSelected([]);
    setShowPreview(false);
    setShowLayouts(!value?.trim());
    setShowTemplates(false);
    setPendingRemove(null);
    setIsUploading(false);
    setNotice('');
    lastValue.current = value || '';
  }, [value, templateKind]);

  const commit = (next: ContentSection[]) => {
    sectionsRef.current = next;
    setSections(next);
    const html = writeContentSections(next);
    lastValue.current = html;
    onChange(html);
  };
  const append = (html: string[], message: string) => {
    const additions = html.map(createContentSection);
    if (!additions.length) return;
    commit([...sectionsRef.current, ...additions]);
    setEditingId(additions[0].id);
    setSelected([]);
    setShowTemplates(false);
    setShowLayouts(false);
    setPendingRemove(null);
    setShowPreview(false);
    setNotice(message);
  };
  const remove = (id: string) => {
    const index = sectionsRef.current.findIndex(section => section.id === id);
    if (index < 0) return;
    setPendingRemove(null);
    setRemoved({ section: sectionsRef.current[index], index });
    commit(sectionsRef.current.filter(section => section.id !== id));
    if (editingId === id) setEditingId(null);
    setNotice('Section removed. You can undo this below before leaving the form.');
  };
  const restore = () => {
    if (!removed) return;
    const next = [...sectionsRef.current];
    next.splice(Math.min(removed.index, next.length), 0, removed.section);
    commit(next);
    setEditingId(removed.section.id);
    setRemoved(null);
    setNotice('Section restored.');
  };

  return <div className="section-editor space-y-3" role="group" aria-label={label || 'Page content sections'}>
    {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
    <fieldset disabled={isUploading} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold text-[#10275c]">Build with protected layouts</p><p className="mt-1 text-sm text-gray-600">Choose a layout, then fill its photo and text areas. The layout stays in place.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${control} !bg-[#10275c] !text-white`} aria-expanded={showLayouts} aria-controls={`${instanceId}-layouts`} onClick={() => { setShowLayouts(!showLayouts); setShowTemplates(false); }}><Plus className="h-4 w-4" />Add layout</button>
          {!layoutOnly && <>
            {templates.length > 0 && <button type="button" className={control} aria-expanded={showTemplates} aria-controls={`${instanceId}-templates`} onClick={() => { setShowTemplates(!showTemplates); setShowLayouts(false); }}><LayoutTemplate className="h-4 w-4" />Use example content</button>}
            <button type="button" className={control} onClick={() => append([blankTableSection], 'Table section added.')}><Plus className="h-4 w-4" />Table section</button>
            <button type="button" className={control} aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}><Eye className="h-4 w-4" />{showPreview ? 'Back to editing' : 'Preview'}</button>
          </>}
        </div>
      </div>
      {showLayouts && <div id={`${instanceId}-layouts`} className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">{LAYOUT_BLOCKS.map(layout => <button key={layout.type} type="button" aria-label={layout.title} className="rounded-lg border border-slate-300 bg-white p-3 text-left hover:border-orange focus:outline-none focus:ring-2 focus:ring-orange" onClick={() => append([createLayoutBlock(layout.type)], `${layout.title} added. Fill the photo and text areas below.`)}><LayoutDiagram type={layout.type} /><span className="block text-sm font-semibold text-[#10275c]">{layout.title}</span><span className="mt-1 block text-xs text-slate-500">{layout.description}</span></button>)}</div>}
      {showTemplates && <div id={`${instanceId}-templates`} className="mt-4 border-t border-slate-200 pt-4">
        {template ? <>
          {templates.length > 1 && <label className="mb-3 block text-sm font-medium">Choose a template<select className="ml-2 rounded border border-gray-300 bg-white p-2" value={template.id} onChange={event => { setTemplateId(event.target.value); setSelected([]); }}>{templates.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}
          <p className="font-semibold">{template.title}</p><p className="mt-1 text-xs text-gray-600">Based on {template.sourceLabel}. Review the example text, details and pictures for your new content.</p>
          <div className="my-3 grid gap-2 sm:grid-cols-2">{template.sections.map(section => <label key={section.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 bg-white p-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={selected.includes(section.id)} onChange={event => setSelected(current => event.target.checked ? [...current, section.id] : current.filter(id => id !== section.id))} />
            <span><span className="block text-sm font-semibold">{section.title}</span>{section.description && <span className="mt-1 block text-xs text-gray-500">{section.description}</span>}</span>
          </label>)}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!selected.length} className={`${control} !border-[#10275c] !bg-[#10275c] !text-white`} onClick={() => append(template.sections.filter(section => selected.includes(section.id)).map(section => section.html), `${selected.length} template section${selected.length === 1 ? '' : 's'} added.`)}><Check className="h-4 w-4" />Add selected sections ({selected.length})</button>
            <button type="button" className={control} onClick={() => append(template.sections.map(section => section.html), 'Full template added. Remove any sections you do not need.')}>Add full template</button>
          </div>
          {sections.length > 0 && <p className="mt-2 text-xs text-gray-600">Sections are added below your existing content.</p>}
        </> : <p className="text-sm text-gray-600">Start with a text or table section, or edit your existing content below.</p>}
      </div>}
    </fieldset>
    <div aria-live="polite" className="text-sm text-gray-600">{isUploading ? 'Photo upload in progress. Please wait before switching sections or saving.' : notice}{removed && <button type="button" disabled={isUploading} onClick={restore} className="ml-3 inline-flex items-center gap-1 font-semibold text-[#a63c09]"><RotateCcw className="h-4 w-4" />Undo remove</button>}</div>
    {showPreview ? <div className="section-content service-rich-content section-editor-preview rounded-lg border border-slate-200 bg-white" role="region" aria-label={`${label || 'Content'} preview`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(writeContentSections(sections)) }} /> : <>
      {!sections.length && <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Choose one of the layouts above to start.</p>}
      {sections.map((section, index) => {
        const layout = readProtectedSection(section.html).layout;
        const title = LAYOUT_BLOCKS.find(item => item.type === layout)?.title || sectionTitle(section.html, `Section ${index + 1}`);
        const editing = editingId === section.id;
        return <div key={section.id} className="overflow-hidden rounded-lg border border-gray-300 bg-white" data-content-section-card="">
          <fieldset disabled={isUploading} className="flex min-w-0 flex-wrap items-center justify-between gap-2 bg-slate-50 p-3">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-[#10275c]" aria-expanded={editing} aria-controls={`${instanceId}-${section.id}`} onClick={() => setEditingId(editing ? null : section.id)}>{editing ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}<span>{index + 1}. {title}</span></button>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={control} aria-label={`Move section ${index + 1} up`} disabled={index === 0} onClick={() => commit(moveContentSection(sectionsRef.current, section.id, -1))}><ArrowUp className="h-4 w-4" /></button>
              <button type="button" className={control} aria-label={`Move section ${index + 1} down`} disabled={index === sections.length - 1} onClick={() => commit(moveContentSection(sectionsRef.current, section.id, 1))}><ArrowDown className="h-4 w-4" /></button>
              <button type="button" className={control} aria-label={`Duplicate section ${index + 1}`} onClick={() => { const current = sectionsRef.current; const position = current.findIndex(item => item.id === section.id); const copy = createContentSection(current[position].html); commit([...current.slice(0, position + 1), copy, ...current.slice(position + 1)]); setEditingId(copy.id); setNotice('Section duplicated.'); }}><Copy className="h-4 w-4" /></button>
              <button type="button" className={`${control} !text-red-600`} aria-label={`Remove section ${index + 1}`} onClick={() => setPendingRemove(section.id)}><Trash2 className="h-4 w-4" /><span>Remove</span></button>
            </div>
          </fieldset>
          {pendingRemove === section.id && <fieldset disabled={isUploading} aria-label={`Confirm removing section ${index + 1}`} className="flex min-w-0 flex-wrap items-center gap-3 border-t border-red-100 bg-red-50 p-3"><p className="flex-1 text-sm text-red-900">Remove this entire section and its content?</p><button type="button" className={control} onClick={() => setPendingRemove(null)}>Keep section</button><button type="button" className={`${control} !border-red-700 !bg-red-700 !text-white`} onClick={() => remove(section.id)}>Yes, remove section</button></fieldset>}
          <div id={`${instanceId}-${section.id}`} hidden={!editing} className="p-3">
            {editing && <ProtectedSectionFields label={`${label || 'Content'} section ${index + 1}`} value={section.html} onUploadingChange={setIsUploading} onChange={html => { if (sectionsRef.current.find(item => item.id === section.id)?.html !== html) commit(sectionsRef.current.map(item => item.id === section.id ? { ...item, html } : item)); }} />}
          </div>
        </div>;
      })}
    </>}
  </div>;
}
