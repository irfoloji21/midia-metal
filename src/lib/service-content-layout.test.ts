import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentSection, writeContentSections } from './content-sections';
import { getContentTemplates } from './content-templates';
import { createLayoutBlock, LAYOUT_BLOCKS } from './layout-blocks';
import { serviceContentLayout } from './service-content-layout';

afterEach(() => vi.unstubAllGlobals());

describe('Service detail content layout', () => {
  it.each(LAYOUT_BLOCKS)('gives the $type block a full content canvas before and after editor serialization', ({ type }) => {
    const block = createLayoutBlock(type);
    expect(serviceContentLayout(block)).toBe('sections');
    expect(serviceContentLayout(writeContentSections([createContentSection(block)]))).toBe('sections');
  });

  it('keeps text-only and table sections out of the legacy cover-image column', () => {
    const sections = [
      createContentSection('<h2>Installation requirements</h2><p>Leave access for maintenance.</p>'),
      createContentSection('<table><tbody><tr><th>Material</th><td>Stainless steel</td></tr></tbody></table>'),
    ];
    expect(serviceContentLayout(writeContentSections(sections))).toBe('sections');
    expect(serviceContentLayout('<div class="content-section"></div>')).toBe('sections');
  });

  it('preserves the two-column fallback for plain legacy content, including inline images', () => {
    for (const content of [undefined, null, '', 'Existing service notes', '<h2>Our work</h2><p>Made to measure.</p><img src="/images/hero-kitchen.jpg" alt="Kitchen">']) {
      expect(serviceContentLayout(content)).toBe('legacy');
    }
  });

  it('keeps the existing Ventilation Systems editorial bands after the editor wraps them', () => {
    const source = getContentTemplates('service')[0];
    expect(source.sections.length).toBeGreaterThan(0);
    const raw = source.sections.map(section => section.html).join('\n');
    const wrapped = writeContentSections(source.sections.map(section => createContentSection(section.html)));
    expect(serviceContentLayout(raw)).toBe('editorial');
    expect(serviceContentLayout(wrapped)).toBe('editorial');
  });

  it.each([
    '<div class="other service-section service-section--image-left"><p>Existing copy</p></div>',
    "<div class = 'service-section service-section--image-left'><p>Existing copy</p></div>",
    '<div class="other\tservice-section\nservice-section--image-left"><p>Existing copy</p></div>',
  ])('recognizes real legacy class tokens regardless of attribute formatting', content => {
    expect(serviceContentLayout(content)).toBe('editorial');
  });

  it('gives protected layouts priority in mixed documents regardless of section order', () => {
    const editorial = '<div class="service-section"><div class="service-copy"><h2>Existing service</h2></div></div>';
    const block = createLayoutBlock('image-right');
    for (const sections of [[editorial, block], [block, editorial]]) {
      expect(serviceContentLayout(sections.join('\n'))).toBe('sections');
      expect(serviceContentLayout(writeContentSections(sections.map(createContentSection)))).toBe('sections');
    }
  });

  it.each([
    '<div data-class="layout-block"><p>Notes</p></div>',
    '<div title=\'class="service-section"\'><p>Notes</p></div>',
    '<div class="layout-block-other content-section-other service-section-other"><p>Notes</p></div>',
    '<p>service-section layout-block content-section</p>',
    '<pre>&lt;div class="layout-block"&gt;Example&lt;/div&gt;</pre>',
    '<!-- <div class="layout-block"></div> --><p>Notes</p>',
    '<script type="application/json">{"example":"<div class="layout-block">"}</script><p>Notes</p>',
  ])('does not change layout because of marker text or unrelated attributes', content => {
    expect(serviceContentLayout(content)).toBe('legacy');
  });

  it('can load and classify saved blocks without browser DOM globals during SSR', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('DOMParser', undefined);
    vi.resetModules();
    const serverModule = await import('./service-content-layout');
    expect(serverModule.serviceContentLayout('<div class="content-section"><div class="layout-block layout-block--text"><div class="layout-copy"><p>Service</p></div></div></div>')).toBe('sections');
    expect(serverModule.serviceContentLayout('<div class="service-section"><p>Existing service</p></div>')).toBe('editorial');
    expect(serverModule.serviceContentLayout('<p>Legacy service</p>')).toBe('legacy');
  });
});
