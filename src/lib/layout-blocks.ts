import DOMPurify from 'dompurify';

export type LayoutBlockType = 'image-left' | 'image-right' | 'images-2' | 'images-3' | 'text' | 'image';

export const LAYOUT_BLOCKS: ReadonlyArray<{ type: LayoutBlockType; title: string; description: string }> = [
  { type: 'image-left', title: 'Image left, text right', description: 'One picture beside an editable text area.' },
  { type: 'image-right', title: 'Text left, image right', description: 'An editable text area beside one picture.' },
  { type: 'images-2', title: 'Two images', description: 'Two pictures in equal columns.' },
  { type: 'images-3', title: 'Three images', description: 'Three pictures in equal columns.' },
  { type: 'text', title: 'Text', description: 'A full-width area for headings, paragraphs and lists.' },
  { type: 'image', title: 'Image', description: 'One full-width picture.' },
];

export type ProtectedTextField = { id: string; label: string; html: string; inline: boolean };
export type ProtectedImageField = { id: string; src: string; alt: string };
export type ProtectedSection = {
  layout: LayoutBlockType | null;
  textFields: ProtectedTextField[];
  imageFields: ProtectedImageField[];
};

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const inlineTags = ['b', 'strong', 'i', 'em', 'u', 'a', 'span', 'br'];
const richTags = [...inlineTags, 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote'];
const blockSelector = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,div,table,thead,tbody,tfoot,tr,td,th';
const forbiddenSelector = 'script,style,iframe,object,embed,svg,math,form,input,button,textarea,select,option,link,meta,noscript,template';
const textStyleValues: Record<string, RegExp> = {
  'font-weight': /^(?:normal|bold|[1-9]00)$/,
  'font-style': /^(?:normal|italic)$/,
  'text-decoration': /^(?:none|underline)$/,
};

function safeTextStyle(style: string): string {
  const values: Record<string, string> = {};
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim().toLowerCase();
    if (Object.hasOwn(textStyleValues, property) && textStyleValues[property].test(value)) values[property] = value;
  }
  return Object.keys(textStyleValues).filter(property => values[property]).map(property => `${property}:${values[property]};`).join(' ');
}

function safeUrl(value: string, image = false): string | null {
  const url = value.trim();
  if (!url || /[\u0000-\u0020\u007f\\]/.test(url)) return null;
  if (/^\/(?!\/)/.test(url)) return url;
  if (!image && /^(?:#[^\s]*|mailto:[^\s]+|tel:[^\s]+)$/i.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname && ['http:', 'https:'].includes(parsed.protocol) ? url : null;
  } catch { return null; }
}

/** Only a slot's text is cleaned. Existing section HTML is never rewritten by inspection. */
export function sanitizeLayoutText(html: string, inline = false): string {
  const document = parse(html);
  const body = document.body;
  body.querySelectorAll(forbiddenSelector).forEach(element => element.remove());
  body.querySelectorAll('img,video,audio,source,picture').forEach(element => element.remove());

  // Native editing uses explicit normal values to turn off inherited heading/bold styles.
  // Preserve those text-only overrides, never arbitrary layout or positioning CSS.
  for (const element of body.querySelectorAll('[style]')) {
    const style = safeTextStyle(element.getAttribute('style') || '');
    if (style) element.setAttribute('style', style);
    else element.removeAttribute('style');
  }

  // contentEditable uses div for Enter. Keep those line breaks without accepting layout divs.
  for (const element of Array.from(body.querySelectorAll(inline ? blockSelector : 'div,table,thead,tbody,tfoot,tr,td,th')).reverse()) {
    const fragment = document.createDocumentFragment();
    const simpleParagraph = !inline && element.tagName === 'DIV' && !element.querySelector(blockSelector);
    if (simpleParagraph) {
      const paragraph = document.createElement('p');
      while (element.firstChild) paragraph.appendChild(element.firstChild);
      fragment.appendChild(paragraph);
    } else {
      while (element.firstChild) fragment.appendChild(element.firstChild);
      fragment.appendChild(document.createElement('br'));
    }
    element.replaceWith(fragment);
  }
  const clean = DOMPurify.sanitize(body.innerHTML, {
    ALLOWED_TAGS: inline ? inlineTags : richTags,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'style'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    KEEP_CONTENT: true,
  });
  const result = parse(clean).body;
  for (const link of result.querySelectorAll('a')) {
    const href = safeUrl(link.getAttribute('href') || '');
    if (href) link.setAttribute('href', href);
    else link.removeAttribute('href');
    if (link.getAttribute('target') === '_blank') link.setAttribute('rel', 'noopener noreferrer');
    else { link.removeAttribute('target'); link.removeAttribute('rel'); }
  }
  return result.innerHTML;
}

export function createLayoutBlock(type: LayoutBlockType): string {
  if (!LAYOUT_BLOCKS.some(block => block.type === type)) throw new Error('Unknown layout block.');
  const media = '<div class="layout-media"></div>';
  const copy = '<div class="layout-copy"><p></p></div>';
  const content = type === 'text' ? copy : type === 'image' ? media
    : type === 'images-2' ? media.repeat(2) : type === 'images-3' ? media.repeat(3) : media + copy;
  return `<div class="layout-block layout-block--${type}">${content}</div>`;
}

type TextSlot = { kind: 'text'; node: Node; path: number[]; inline: boolean; label: string; id: string };
type ImageSlot = { kind: 'image'; node: Element; path: number[]; fixed: boolean; id: string };
type Slot = TextSlot | ImageSlot;
type Inspection = { body: HTMLElement; layout: LayoutBlockType | null; slots: Slot[] };
const textElementSelector = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,figcaption,caption,span,b,strong,i,em,u,a';
const nestedTextBlockSelector = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,td,th,figcaption,caption';
const structuralSelector = 'img,table,figure,picture,video,audio,iframe,div,section,article';

function labelFor(element: Element): string {
  if (/^H[1-6]$/.test(element.tagName)) return 'Heading';
  if (element.matches('td,th')) {
    const row = element.closest('tr');
    const rows = Array.from(element.closest('table')?.querySelectorAll('tr') || []);
    const column = Array.from(row?.children || []).indexOf(element) + 1;
    return `Table row ${row ? rows.indexOf(row) + 1 : 1}, column ${column}`;
  }
  if (element.tagName === 'LI') return 'List item';
  if (element.matches('figcaption,caption')) return 'Caption';
  return element.tagName === 'P' ? 'Paragraph' : 'Text';
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function inspect(html: string): Inspection {
  const body = parse(html).body;
  const slots: Slot[] = [];
  const layoutElement = body.children.length === 1 && body.firstElementChild?.classList.contains('layout-block') ? body.firstElementChild : null;
  const layout = LAYOUT_BLOCKS.find(block => layoutElement?.classList.contains(`layout-block--${block.type}`))?.type || null;
  const text = (node: Node, path: number[], inline: boolean, label: string) => slots.push({ kind: 'text', node, path, inline, label, id: '' });
  const walk = (node: Node, path: number[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) text(node, path, true, 'Text');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.matches(forbiddenSelector + ',.product-spec-slot')) return;
    if (element.classList.contains('layout-media')) {
      slots.push({ kind: 'image', node: element, path, fixed: true, id: '' });
      return;
    }
    if (element.tagName === 'IMG') {
      slots.push({ kind: 'image', node: element, path, fixed: false, id: '' });
      return;
    }
    if (element.classList.contains('layout-copy') && !element.querySelector(structuralSelector)) {
      text(element, path, false, 'Text');
      return;
    }
    if (element.matches(textElementSelector) && !element.querySelector(`${structuralSelector},${nestedTextBlockSelector}`)) {
      text(element, path, true, labelFor(element));
      return;
    }
    Array.from(node.childNodes).forEach((child, index) => walk(child, [...path, index]));
  };
  Array.from(body.childNodes).forEach((node, index) => walk(node, [index]));
  const targets = new Map(slots.map(slot => [slot.node, slot]));
  const shape = (node: Node): string => {
    const slot = targets.get(node);
    // Ignoring editable values keeps IDs stable across typing, replacements and uploads.
    if (slot) return slot.kind === 'image' ? 'IMAGE' : `TEXT:${slot.inline ? 'inline' : 'rich'}`;
    if (node.nodeType !== Node.ELEMENT_NODE) return node.nodeType === Node.TEXT_NODE ? 'SPACE' : 'COMMENT';
    const element = node as Element;
    return `${element.tagName}[${element.className}](${Array.from(node.childNodes).map(shape).join(',')})`;
  };
  const version = fingerprint(Array.from(body.childNodes).map(shape).join(','));
  for (const slot of slots) slot.id = `protected-${slot.kind}-${slot.path.join('.')}-${version}`;
  return { body, layout, slots };
}

export function readProtectedSection(html: string): ProtectedSection {
  const inspection = inspect(html);
  return {
    layout: inspection.layout,
    textFields: inspection.slots.filter((slot): slot is TextSlot => slot.kind === 'text').map(slot => ({
      id: slot.id, label: slot.label, inline: slot.inline,
      html: slot.node.nodeType === Node.TEXT_NODE ? escapeText(slot.node.textContent || '') : (slot.node as Element).innerHTML,
    })),
    imageFields: inspection.slots.filter((slot): slot is ImageSlot => slot.kind === 'image').map(slot => {
      const image = slot.fixed ? slot.node.querySelector('img') : slot.node;
      return { id: slot.id, src: image?.getAttribute('src') || '', alt: image?.getAttribute('alt') || '' };
    }),
  };
}

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

function staleField(): never { throw new Error('This content field has changed. Reopen the section and try again.'); }

export function updateSectionText(html: string, id: string, value: string): string {
  const { body, slots } = inspect(html);
  const slot = slots.find((candidate): candidate is TextSlot => candidate.kind === 'text' && candidate.id === id);
  if (!slot) return staleField();
  let clean = sanitizeLayoutText(value, slot.inline);
  const enclosingLink = slot.node.nodeType === Node.ELEMENT_NODE
    ? (slot.node as Element).closest('a') : slot.node.parentElement?.closest('a');
  if (enclosingLink) {
    const fragment = parse(clean).body;
    for (const link of fragment.querySelectorAll('a')) link.replaceWith(...Array.from(link.childNodes));
    clean = fragment.innerHTML;
  }
  const current = slot.node.nodeType === Node.TEXT_NODE ? escapeText(slot.node.textContent || '') : (slot.node as Element).innerHTML;
  if (clean === current) return html;
  if (slot.node.nodeType === Node.TEXT_NODE) {
    // A persistent span retains a bare legacy text slot even after its value is cleared.
    const span = body.ownerDocument.createElement('span');
    span.innerHTML = clean;
    slot.node.parentNode!.replaceChild(span, slot.node);
  } else (slot.node as Element).innerHTML = clean;
  return body.innerHTML;
}

export function updateSectionImage(html: string, id: string, value: { src: string; alt: string }): string {
  const { body, slots } = inspect(html);
  const slot = slots.find((candidate): candidate is ImageSlot => candidate.kind === 'image' && candidate.id === id);
  if (!slot) return staleField();
  const supplied = value.src.trim();
  const src = supplied ? safeUrl(supplied, true) : '';
  if (supplied && !src) throw new Error('Choose an uploaded image or a valid HTTP image address.');
  let image = slot.fixed ? slot.node.querySelector('img') : slot.node;
  if (!src) {
    if (!slot.fixed) return html; // A legacy image has no independent empty wrapper to preserve its position.
    image?.remove();
    return body.innerHTML;
  }
  if (!image) {
    image = body.ownerDocument.createElement('img');
    image.setAttribute('style', 'max-width:100%;height:auto;');
    slot.node.appendChild(image);
  }
  const previousSrc = image.getAttribute('src');
  const link = image.closest('a');
  if (previousSrc && link?.getAttribute('href') === previousSrc) link.setAttribute('href', src);
  image.setAttribute('src', src);
  image.setAttribute('alt', value.alt);
  // A previous responsive source must not override the newly selected image.
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  return body.innerHTML;
}
