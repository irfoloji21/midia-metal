import { describe, expect, it } from 'vitest';
import { getContentTemplates } from './content-templates';
import { createLayoutBlock, LAYOUT_BLOCKS, readProtectedSection, sanitizeLayoutText, updateSectionImage, updateSectionText, type LayoutBlockType } from './layout-blocks';

const body = (html: string) => new DOMParser().parseFromString(html, 'text/html').body;

describe('protected layout blocks', () => {
  it('creates all six fixed layouts with independent empty image and text slots', () => {
    const counts: Record<LayoutBlockType, [number, number]> = {
      'image-left': [1, 1], 'image-right': [1, 1], 'images-2': [2, 0], 'images-3': [3, 0], text: [0, 1], image: [1, 0],
    };
    expect(LAYOUT_BLOCKS).toHaveLength(6);
    for (const block of LAYOUT_BLOCKS) {
      const html = createLayoutBlock(block.type);
      const section = readProtectedSection(html);
      expect(section.layout).toBe(block.type);
      expect(section.imageFields).toHaveLength(counts[block.type][0]);
      expect(section.textFields).toHaveLength(counts[block.type][1]);
      expect(section.imageFields.every(image => image.src === '')).toBe(true);
      expect(body(html).querySelectorAll('img')).toHaveLength(0);
      expect(section.textFields.every(field => !field.inline)).toBe(true);
    }
    expect(() => createLayoutBlock('unknown' as LayoutBlockType)).toThrow('Unknown layout');
  });

  it('keeps fixed slots and their IDs after text edits, image upload, clearing and reloading', () => {
    let html = createLayoutBlock('image-right');
    const original = readProtectedSection(html);
    html = updateSectionText(html, original.textFields[0].id, '<h2>Fan heading</h2><p><strong>Bold</strong> detail</p>');
    html = updateSectionImage(html, original.imageFields[0].id, { src: 'https://api-test.midiawork.com/storage/uploads/fan.png', alt: 'Fan "front" & motor' });
    let loaded = readProtectedSection(html);
    expect(loaded.textFields.map(field => field.id)).toEqual(original.textFields.map(field => field.id));
    expect(loaded.imageFields.map(field => field.id)).toEqual(original.imageFields.map(field => field.id));
    expect(loaded.imageFields[0].alt).toBe('Fan "front" & motor');
    expect(body(html).querySelector('.layout-copy h2')?.textContent).toBe('Fan heading');
    html = updateSectionText(html, original.textFields[0].id, '');
    html = updateSectionImage(html, original.imageFields[0].id, { src: '', alt: '' });
    loaded = readProtectedSection(html);
    expect(loaded.textFields[0].html).toBe('');
    expect(loaded.textFields[0].id).toBe(original.textFields[0].id);
    expect(loaded.imageFields[0]).toEqual(original.imageFields[0]);
    expect(body(html).querySelector('.layout-block')?.children).toHaveLength(2);
    expect(body(html).querySelectorAll('img')).toHaveLength(0);
  });

  it('keeps each image in its selected column after independent uploads and reload', () => {
    let html = createLayoutBlock('images-3');
    const fields = readProtectedSection(html).imageFields;
    html = updateSectionImage(html, fields[2].id, { src: '/images/third.webp', alt: 'Third' });
    html = updateSectionImage(html, fields[0].id, { src: '/images/first.webp', alt: 'First' });
    const loaded = readProtectedSection(html);
    expect(loaded.imageFields.map(field => field.id)).toEqual(fields.map(field => field.id));
    expect(loaded.imageFields.map(field => field.src)).toEqual(['/images/first.webp', '', '/images/third.webp']);
    const columns = body(html).querySelectorAll('.layout-media');
    expect(columns[0].querySelector('img')?.getAttribute('src')).toBe('/images/first.webp');
    expect(columns[1].children).toHaveLength(0);
    expect(columns[2].querySelector('img')?.getAttribute('src')).toBe('/images/third.webp');
  });

  it('accepts useful rich text while excluding pasted layouts, images, tables and executable content', () => {
    const html = createLayoutBlock('image-left');
    const field = readProtectedSection(html).textFields[0];
    const hostile = '<div class="layout-block"><h2 onclick="alert(1)">Heading</h2><p style="position:fixed"><strong>Bold</strong></p><img src="/bad.png" onerror="alert(1)"><table><tr><td>Cell text</td></tr></table></div><script>alert(1)</script><svg onload="alert(1)"></svg><a href="jav&#x61;script:alert(1)">Bad</a><a href="/contact" target="_blank">Contact</a><a href="//other.test">Other</a>';
    const changed = body(updateSectionText(html, field.id, hostile));
    const copy = changed.querySelector('.layout-copy')!;
    expect(changed.querySelectorAll('.layout-block')).toHaveLength(1);
    expect(changed.querySelectorAll('.layout-media')).toHaveLength(1);
    expect(copy.querySelector('div,img,table,script,svg')).toBeNull();
    expect(copy.querySelector('h2')?.textContent).toBe('Heading');
    expect(copy.querySelector('strong')?.textContent).toBe('Bold');
    expect(copy.textContent).toContain('Cell text');
    expect(copy.textContent).not.toContain('alert(1)');
    for (const element of copy.querySelectorAll('*')) {
      for (const attribute of element.attributes) expect(attribute.name).not.toMatch(/^(?:on|class$|style$|data-)/);
    }
    const links = copy.querySelectorAll('a');
    expect(links[0].hasAttribute('href')).toBe(false);
    expect(links[1].getAttribute('href')).toBe('/contact');
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[2].hasAttribute('href')).toBe(false);
    expect(sanitizeLayoutText('<div>First line</div><div>Second line</div>')).toBe('<p>First line</p><p>Second line</p>');
  });

  it('rejects unsafe image URLs, unknown IDs and stale DOM positions', () => {
    const html = createLayoutBlock('image-left');
    const fields = readProtectedSection(html);
    for (const src of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//other.test/a.png', '/\\other.test/a.png', 'https://good.test/\nimage.png']) {
      expect(() => updateSectionImage(html, fields.imageFields[0].id, { src, alt: '' })).toThrow('valid HTTP');
    }
    expect(() => updateSectionText(html, 'missing', 'wrong')).toThrow('field has changed');
    expect(() => updateSectionImage(html, fields.textFields[0].id, { src: '/image.png', alt: '' })).toThrow('field has changed');
    const legacy = '<div><p>First</p><p>Second</p></div>';
    const first = readProtectedSection(legacy).textFields[0];
    expect(() => updateSectionText('<div><p>Second</p></div>', first.id, 'wrong')).toThrow('field has changed');
  });

  it('preserves native normal overrides inside headings and inherited bold/italic across saves', () => {
    const markup = '<h2><strong><em><span style="font-weight: normal; font-style: normal; text-decoration: none;">Normal inside a heading</span></em></strong></h2>';
    const expected = '<h2><strong><em><span style="font-weight:normal; font-style:normal; text-decoration:none;">Normal inside a heading</span></em></strong></h2>';
    const cleaned = sanitizeLayoutText(markup);
    expect(cleaned).toBe(expected);
    expect(sanitizeLayoutText(cleaned)).toBe(expected);
    const layout = createLayoutBlock('image-left');
    const fields = readProtectedSection(layout);
    const saved = updateSectionText(layout, fields.textFields[0].id, cleaned);
    const reopened = readProtectedSection(saved);
    expect(reopened.textFields[0].html).toBe(expected);
    expect(updateSectionText(saved, reopened.textFields[0].id, expected)).toBe(saved);
    expect(reopened.imageFields).toEqual(fields.imageFields);
  });

  it('allows only enumerated text styles and never positioning, sizing, colors or CSS functions', () => {
    for (const value of ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']) {
      expect(sanitizeLayoutText(`<span style="font-weight:${value}">Text</span>`)).toBe(`<span style="font-weight:${value};">Text</span>`);
    }
    for (const value of ['inherit', 'bolder', '550', 'var(--weight)', 'bold!important', 'expression(alert(1))', 'url(https://example.test)']) {
      expect(sanitizeLayoutText(`<span style="font-weight:${value};font-style:oblique;text-decoration:line-through">Text</span>`)).toBe('<span>Text</span>');
    }
    expect(sanitizeLayoutText('<p style="position:fixed;display:none;width:999px;color:red;font-size:100px;FONT-WEIGHT:700;font-style:italic;text-decoration:underline" onclick="bad()">Text</p>'))
      .toBe('<p style="font-weight:700; font-style:italic; text-decoration:underline;">Text</p>');
    expect(sanitizeLayoutText('<span data-style="font-weight:bold" title="style=\'font-style:italic\'">Text</span>'))
      .toBe('<span title="style=\'font-style:italic\'">Text</span>');
  });

  it('keeps the same safe overrides in inline text without allowing layout markup', () => {
    const cleaned = sanitizeLayoutText('<span class="layout-copy" style="font-weight:bold; font-weight:normal; font-style:italic; position:fixed">Text</span><img src="/bad.png">', true);
    expect(cleaned).toBe('<span style="font-weight:normal; font-style:italic;">Text</span>');
    expect(sanitizeLayoutText(cleaned, true)).toBe(cleaned);
  });

  it('preserves real DD7 tables, image positions and visual wrappers when editing leaf fields', () => {
    const [template] = getContentTemplates('product');
    const original = template.sections.map(section => section.html).join('');
    const before = body(original);
    const fields = readProtectedSection(original);
    expect(fields.layout).toBeNull();
    expect(fields.imageFields).toHaveLength(10);
    expect(fields.textFields.length).toBeGreaterThan(30);
    expect(fields.textFields.every(field => field.inline)).toBe(true);
    const inspectedAgain = readProtectedSection(original);
    expect(inspectedAgain).toEqual(fields);
    let changed = updateSectionText(original, fields.textFields[0].id, '<strong>Updated heading</strong>');
    changed = updateSectionImage(changed, fields.imageFields[0].id, { src: '/images/replacement.png', alt: 'Replacement' });
    const after = body(changed);
    const tableStructure = (element: Element) => Array.from(element.querySelectorAll('table,tr,td,th')).map(node => ({
      tag: node.tagName, attributes: Array.from(node.attributes).map(attribute => [attribute.name, attribute.value]),
    }));
    expect(tableStructure(after)).toEqual(tableStructure(before));
    expect(Array.from(after.querySelectorAll('table')).slice(1).map(table => table.outerHTML)).toEqual(Array.from(before.querySelectorAll('table')).slice(1).map(table => table.outerHTML));
    expect(Array.from(after.querySelectorAll('img')).slice(1).map(image => image.outerHTML)).toEqual(Array.from(before.querySelectorAll('img')).slice(1).map(image => image.outerHTML));
    expect(after.querySelector('img')?.getAttribute('style')).toBe(before.querySelector('img')?.getAttribute('style'));
    expect(after.querySelectorAll('.word-paste')).toHaveLength(14);
    expect(readProtectedSection(changed).imageFields.map(field => field.id)).toEqual(fields.imageFields.map(field => field.id));
  });

  it('keeps existing service, portfolio and blog scaffolds when inspecting and editing their text', () => {
    for (const kind of ['service', 'portfolio', 'blog'] as const) {
      const [template] = getContentTemplates(kind);
      const html = template.sections.map(section => section.html).join('');
      const fields = readProtectedSection(html);
      expect(fields.textFields.length).toBeGreaterThan(0);
      const changed = updateSectionText(html, fields.textFields[0].id, fields.textFields[0].html);
      expect(body(changed).innerHTML).toBe(body(html).innerHTML);
      expect(readProtectedSection(changed).imageFields).toEqual(fields.imageFields);
    }
  });

  it('edits table-cell text without removing cell structure, dimensions or adjacent content', () => {
    const original = '<div class="word-table"><table style="width:100%"><tbody><tr><th>Size</th><td colspan="2" style="width:70%">Original <strong>value</strong></td></tr><tr><td><img src="/images/keep.png" alt="Keep"></td><td>Other cell</td></tr></tbody></table></div>';
    const fields = readProtectedSection(original);
    const cell = fields.textFields.find(field => field.html.includes('Original'))!;
    const changed = body(updateSectionText(original, cell.id, '<div>Changed</div><table><tr><td>Pasted</td></tr></table><img src="/images/wrong.png">'));
    expect(changed.querySelectorAll('table')).toHaveLength(1);
    expect(changed.querySelectorAll('tr')).toHaveLength(2);
    expect(changed.querySelectorAll('td,th')).toHaveLength(4);
    expect(changed.querySelector('td[colspan]')?.getAttribute('colspan')).toBe('2');
    expect(changed.querySelector('td[colspan]')?.getAttribute('style')).toBe('width:70%');
    expect(changed.querySelectorAll('img')).toHaveLength(1);
    expect(changed.querySelector('img')?.getAttribute('src')).toBe('/images/keep.png');
    expect(changed.textContent).toContain('Other cell');
  });

  it('retains bare legacy text slots after clearing and updates image links without shifting their position', () => {
    const original = '<div>Before<a href="/images/original.png"><img src="/images/original.png" alt="Old" style="width:50%" width="300"></a>After</div>';
    const fields = readProtectedSection(original);
    let changed = updateSectionText(original, fields.textFields[0].id, '');
    expect(readProtectedSection(changed).textFields.map(field => field.id)).toEqual(fields.textFields.map(field => field.id));
    changed = updateSectionText(changed, fields.textFields[0].id, '<strong>Restored</strong>');
    changed = updateSectionImage(changed, fields.imageFields[0].id, { src: 'https://api-test.midiawork.com/storage/new.png', alt: '<not markup>' });
    const parsed = body(changed);
    expect(parsed.querySelector('a')?.getAttribute('href')).toBe('https://api-test.midiawork.com/storage/new.png');
    expect(parsed.querySelector('img')?.getAttribute('style')).toBe('width:50%');
    expect(parsed.querySelector('img')?.getAttribute('width')).toBe('300');
    expect(parsed.querySelector('img')?.getAttribute('alt')).toBe('<not markup>');
    expect(parsed.querySelector('div')?.children[1].tagName).toBe('A');
    expect(readProtectedSection(changed).imageFields[0].id).toBe(fields.imageFields[0].id);
    expect(updateSectionImage(changed, fields.imageFields[0].id, { src: '', alt: '' })).toBe(changed);
  });

  it('keeps an existing link scaffold when another link is pasted into its text', () => {
    const html = '<div><a href="/contact">Contact</a><img src="/images/next.png" alt="Next"></div>';
    const fields = readProtectedSection(html);
    const changed = updateSectionText(html, fields.textFields[0].id, '<a href="https://example.test"><strong>Get in touch</strong></a>');
    const parsed = body(changed);
    expect(parsed.querySelectorAll('a')).toHaveLength(1);
    expect(parsed.querySelector('a')?.getAttribute('href')).toBe('/contact');
    expect(parsed.querySelector('a strong')?.textContent).toBe('Get in touch');
    expect(readProtectedSection(changed).textFields[0].id).toBe(fields.textFields[0].id);
    expect(readProtectedSection(changed).imageFields).toEqual(fields.imageFields);
  });
});
