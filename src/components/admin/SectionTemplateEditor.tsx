import { useEffect, useId, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Copy, Eye, LayoutTemplate, Plus, RotateCcw, Trash2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import { getContentTemplates, type ContentTemplateKind } from '@/lib/content-templates';
import { blankTableSection, blankTextSection, createContentSection, moveContentSection, readContentSections, sectionTitle, writeContentSections, type ContentSection } from '@/lib/content-sections';
import '@/content-sections.css';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  templateKind: ContentTemplateKind;
  settingKey?: string;
  helperText?: string;
  serviceLayout?: boolean;
  wordPaste?: boolean;
};

const control = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#10275c] hover:border-orange disabled:cursor-not-allowed disabled:opacity-40';

export default function SectionTemplateEditor({ label, value, onChange, templateKind, settingKey, helperText, serviceLayout = false, wordPaste = false }: Props) {
  const instanceId = useId();
  const [sections, setSections] = useState(() => readContentSections(value || '', templateKind === 'portfolio'));
  const sectionsRef = useRef(sections);
  const lastValue = useRef(value || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(!value?.trim());
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
    setShowTemplates(!value?.trim());
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
    setShowPreview(false);
    setNotice(message);
  };
  const remove = (id: string) => {
    const index = sectionsRef.current.findIndex(section => section.id === id);
    if (index < 0) return;
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold text-[#10275c]">Build with sections</p><p className="mt-1 text-sm text-gray-600">Add the sections you need. Edit the text and pictures, then save this form.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={control} aria-expanded={showTemplates} aria-controls={`${instanceId}-templates`} onClick={() => setShowTemplates(!showTemplates)}><LayoutTemplate className="h-4 w-4" />Add from template</button>
          <button type="button" className={control} onClick={() => append([blankTextSection], 'Text section added.')}><Plus className="h-4 w-4" />Text section</button>
          <button type="button" className={control} onClick={() => append([blankTableSection], 'Table section added.')}><Plus className="h-4 w-4" />Table section</button>
          <button type="button" className={control} aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}><Eye className="h-4 w-4" />{showPreview ? 'Back to editing' : 'Preview'}</button>
        </div>
      </div>
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
    </div>
    <div aria-live="polite" className="text-sm text-gray-600">{notice}{removed && <button type="button" onClick={restore} className="ml-3 inline-flex items-center gap-1 font-semibold text-[#a63c09]"><RotateCcw className="h-4 w-4" />Undo remove</button>}</div>
    {showPreview ? <div className="section-content service-rich-content section-editor-preview rounded-lg border border-slate-200 bg-white" role="region" aria-label={`${label || 'Content'} preview`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(writeContentSections(sections)) }} /> : <>
      {!sections.length && <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No sections yet. Choose a template above, or add a text section.</p>}
      {sections.map((section, index) => {
        const title = sectionTitle(section.html, `Section ${index + 1}`);
        const editing = editingId === section.id;
        return <div key={section.id} className="overflow-hidden rounded-lg border border-gray-300 bg-white" data-content-section-card="">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-[#10275c]" aria-expanded={editing} aria-controls={`${instanceId}-${section.id}`} onClick={() => setEditingId(editing ? null : section.id)}>{editing ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}<span>{index + 1}. {title}</span></button>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={control} aria-label={`Move section ${index + 1} up`} disabled={index === 0} onClick={() => commit(moveContentSection(sectionsRef.current, section.id, -1))}><ArrowUp className="h-4 w-4" /></button>
              <button type="button" className={control} aria-label={`Move section ${index + 1} down`} disabled={index === sections.length - 1} onClick={() => commit(moveContentSection(sectionsRef.current, section.id, 1))}><ArrowDown className="h-4 w-4" /></button>
              <button type="button" className={control} aria-label={`Duplicate section ${index + 1}`} onClick={() => { const current = sectionsRef.current; const position = current.findIndex(item => item.id === section.id); const copy = createContentSection(current[position].html); commit([...current.slice(0, position + 1), copy, ...current.slice(position + 1)]); setEditingId(copy.id); setNotice('Section duplicated.'); }}><Copy className="h-4 w-4" /></button>
              <button type="button" className={`${control} !text-red-600`} aria-label={`Remove section ${index + 1}`} onClick={() => remove(section.id)}><Trash2 className="h-4 w-4" /><span>Remove</span></button>
            </div>
          </div>
          <div id={`${instanceId}-${section.id}`} hidden={!editing} className="p-3">
            {editing && <><p className="mb-2 text-xs text-gray-500">Click text to edit. Click a picture, then choose Replace photo. Table cells can be edited directly.</p><RichTextEditor label={`${label || 'Content'} section ${index + 1}`} value={section.html} onChange={html => { if (sectionsRef.current.find(item => item.id === section.id)?.html !== html) commit(sectionsRef.current.map(item => item.id === section.id ? { ...item, html } : item)); }} documentLayout serviceLayout={serviceLayout || templateKind === 'service'} wordPaste={wordPaste} helperText={helperText || 'Use the form’s Save button to save all sections.'} /></>}
          </div>
        </div>;
      })}
    </>}
  </div>;
}
