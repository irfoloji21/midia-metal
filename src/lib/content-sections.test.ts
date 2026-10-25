import { describe, expect, it } from 'vitest';
import { createContentSection, moveContentSection, readContentSections, sectionTitle, writeContentSections } from './content-sections';

describe('Content section round trips', () => {
  it('preserves text, links, images and tables when sections are reordered and reopened', () => {
    const photo = '<div class="product-section"><h2>Fan</h2><p><strong>EC</strong> motor</p><a href="/images/fan.webp"><img src="/images/fan.webp" alt="Fan"></a></div>';
    const table = '<table><tbody><tr><th>Power</th><td>180 W</td></tr></tbody></table>';
    const sections = [createContentSection(photo), createContentSection(table)];
    const moved = moveContentSection(sections, sections[1].id, -1);
    const reopened = readContentSections(writeContentSections(moved));
    expect(reopened.map(section => section.html)).toEqual([table, photo]);
    expect(sections.map(section => section.html)).toEqual([photo, table]);
    expect(new Set(reopened.map(section => section.id)).size).toBe(2);
  });
  it('keeps mixed legacy text before, between and after saved sections', () => {
    const mixed = '<p>Before</p><div class="content-section"><h2>Main</h2></div>Between<div class="content-section"><p>Other</p></div><p>After</p>';
    const sections = readContentSections(mixed);
    expect(sections.map(section => section.html)).toEqual(['<p>Before</p>', '<h2>Main</h2>', 'Between', '<p>Other</p>', '<p>After</p>']);
    expect(readContentSections(writeContentSections(sections)).map(section => section.html)).toEqual(sections.map(section => section.html));
  });
  it('does not interpret legacy portfolio text as markup but recognizes saved sections', () => {
    const raw = 'Project <img src=x onerror=bad()> & workmanship\nSecond line\n\nAnother paragraph';
    const sections = readContentSections(raw, true);
    const doc = new DOMParser().parseFromString(writeContentSections(sections), 'text/html');
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.body.textContent).toContain('<img src=x onerror=bad()> & workmanship');
    expect(doc.querySelectorAll('p')).toHaveLength(2);
    expect(readContentSections(writeContentSections(sections), true)[0].html).toBe(sections[0].html);
  });
  it('splits existing designed blocks without breaking nested columns and leaves unstructured HTML whole', () => {
    const value = '<div class="product-section"><div class="product-split"><div><h2>Intro</h2></div><div><img src="/fan.png"></div></div></div><div class="product-section"><h2>Details</h2></div>';
    expect(readContentSections(value)).toHaveLength(2);
    expect(readContentSections('<div class="word-paste"><h2>Keep</h2><table><tbody><tr><td>whole</td></tr></tbody></table></div>')).toHaveLength(1);
    expect(sectionTitle(readContentSections(value)[0].html)).toBe('Intro');
    expect(readContentSections(' \n ')).toEqual([]);
  });
  it('recognizes only the exact portfolio section class token and accepts spacing around class attributes', () => {
    const legacy = '<div class="content-section-other"><b>Literal project notes</b></div>';
    const parsed = new DOMParser().parseFromString(readContentSections(legacy, true)[0].html, 'text/html');
    expect(parsed.querySelector('b')).toBeNull();
    expect(parsed.body.textContent).toBe(legacy);
    expect(readContentSections('<div class = "content-section"><h2>Project</h2></div>', true)[0].html).toBe('<h2>Project</h2>');
  });
  it('keeps section identity and ignores moves outside the document', () => {
    const sections = [createContentSection('<p>A</p>'), createContentSection('<p>B</p>')];
    expect(moveContentSection(sections, sections[0].id, -1)).toBe(sections);
    expect(moveContentSection(sections, 'missing', 1)).toBe(sections);
    expect(moveContentSection(sections, sections[0].id, 1)[1]).toBe(sections[0]);
  });
});
