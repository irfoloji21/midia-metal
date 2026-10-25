/** Section boundaries are plain HTML so existing APIs and public pages can render them. */
export type ContentSection = { id: string; html: string };
let sectionSequence = 0;
export const createContentSection = (html: string): ContentSection => ({ id: `content-section-${++sectionSequence}`, html });

export function escapeContentText(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

export function plainTextContent(text: string): string {
  return text.split(/\n\s*\n/).map(paragraph => `<p>${escapeContentText(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}

/** Reading a document never emits a change. Unstructured legacy content stays together. */
export function readContentSections(value: string, plainText = false): ContentSection[] {
  if (!value.trim()) return [];
  const document = new DOMParser().parseFromString(value, 'text/html');
  if (plainText && !document.querySelector('div.content-section')) {
    return [createContentSection(plainTextContent(value))];
  }
  const children = Array.from(document.body.childNodes);
  const containsSections = children.some(node => node instanceof Element && node.classList.contains('content-section'));
  if (containsSections) {
    const sections: ContentSection[] = [];
    let legacy = '';
    const flushLegacy = () => { if (legacy.trim()) sections.push(createContentSection(legacy)); legacy = ''; };
    for (const node of children) {
      if (node instanceof Element && node.classList.contains('content-section')) {
        flushLegacy();
        sections.push(createContentSection(node.innerHTML));
      } else {
        legacy += node instanceof Element ? node.outerHTML : escapeContentText(node.textContent || '');
      }
    }
    flushLegacy();
    return sections;
  }
  // Existing product/service blocks can be edited independently without unwrapping their layout.
  const blocks = children.filter(node => node instanceof Element || node.textContent?.trim());
  if (blocks.length > 1 && blocks.every(node => node instanceof Element && node.matches('.product-section,.service-section,.product-spec-slot'))) {
    return blocks.map(node => createContentSection((node as Element).outerHTML));
  }
  return [createContentSection(value)];
}

export function writeContentSections(sections: ContentSection[]): string {
  return sections.map(section => `<div class="content-section">${section.html}</div>`).join('\n');
}

export function sectionTitle(html: string, fallback = 'Content section'): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  if (body.querySelector('.product-spec-slot')) return 'Technical specifications';
  const heading = body.querySelector('h1,h2,h3,h4,h5,h6');
  const title = (heading?.textContent || body.textContent || '').replace(/\s+/g, ' ').trim();
  return title ? title.slice(0, 80) + (title.length > 80 ? '…' : '') : fallback;
}

export function moveContentSection(sections: ContentSection[], id: string, direction: -1 | 1): ContentSection[] {
  const index = sections.findIndex(section => section.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const blankTextSection = '<h2>Section heading</h2><p>Add your text here.</p>';
export const blankTableSection = '<h2>Technical details</h2><table><thead><tr><th>Property</th><th>Value</th></tr></thead><tbody><tr><td>Property name</td><td>Enter value</td></tr><tr><td>Property name</td><td>Enter value</td></tr></tbody></table>';
