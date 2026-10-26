import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentSection, writeContentSections } from './content-sections';
import { createLayoutBlock, LAYOUT_BLOCKS } from './layout-blocks';
import { hasProductSections } from './product-editorial';

afterEach(() => vi.unstubAllGlobals());

describe('product description section detection', () => {
  it.each(LAYOUT_BLOCKS)('recognizes the $type layout before and after editor serialization', ({ type }) => {
    const html = createLayoutBlock(type);
    expect(hasProductSections(html)).toBe(true);
    expect(hasProductSections(writeContentSections([createContentSection(html)]))).toBe(true);
  });

  it('recognizes text, table and empty section wrappers', () => {
    const sections = [
      createContentSection('<h2>Installation</h2><p>Allow access for maintenance.</p>'),
      createContentSection('<table><tbody><tr><th>Material</th><td>Steel</td></tr></tbody></table>'),
    ];
    for (const section of sections) expect(hasProductSections(writeContentSections([section]))).toBe(true);
    expect(hasProductSections('<div class="content-section"></div>')).toBe(true);
  });

  it.each([
    '<div class="other content-section"><p>Saved copy</p></div>',
    "<div class = 'other layout-block layout-block--text'><div class='layout-copy'>Copy</div></div>",
    '<div class="other\tcontent-section\nmore"><p>Saved copy</p></div>',
    '<div data-class="unrelated" class="content-section"><p>Saved copy</p></div>',
    '<main><article><div class="layout-block layout-block--image"></div></article></main>',
  ])('uses actual class tokens regardless of attribute formatting or nesting', html => {
    expect(hasProductSections(html)).toBe(true);
  });

  it.each([
    undefined,
    null,
    '',
    'Existing product notes',
    '<h2>Product details</h2><p>Made to measure.</p><img src="/product.jpg" alt="Product">',
    '<div class="product-section"><p>Existing DD7 editorial content</p></div>',
    '<div class="product-spec-slot"></div>',
    '<div data-class="content-section"><p>Existing copy</p></div>',
    '<div title=\'class="layout-block"\'><p>Existing copy</p></div>',
    '<div class="content-section-other layout-block-other"><p>Existing copy</p></div>',
    '<p>layout-block content-section</p>',
    '<pre>&lt;div class="layout-block"&gt;Example&lt;/div&gt;</pre>',
    '<!-- <div class="content-section"></div> --><p>Existing copy</p>',
    '<script type="application/json">{"example":"<div class=\"content-section\">"}</script>',
    '<style>.content-section { color: red; }</style>',
    '<template><div class="content-section"><p>Hidden template</p></div></template>',
    '<noscript><div class="layout-block"><p>Fallback content</p></div></noscript>',
    '<script class="content-section"></script>',
    '<style class="layout-block"></style>',
    '<template class="layout-block"></template>',
    '<noscript class="content-section"></noscript>',
  ])('preserves legacy layout for plain content, marker text and non-rendered nodes', html => {
    expect(hasProductSections(html)).toBe(false);
  });

  it('continues looking for visible sections after a non-rendered subtree', () => {
    expect(hasProductSections('<div class="content-section"><p>Visible</p></div><template><div class="layout-block">Hidden</div></template>')).toBe(true);
  });

  it('runs without browser DOM globals during server rendering', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('DOMParser', undefined);
    vi.resetModules();
    const serverModule = await import('./product-editorial');
    expect(serverModule.hasProductSections('<div class="content-section"><div class="layout-block layout-block--text"><div class="layout-copy"><p>Product</p></div></div></div>')).toBe(true);
    expect(serverModule.hasProductSections('<p>Existing product notes</p>')).toBe(false);
    expect(serverModule.hasProductSections('<template><div class="content-section"></div></template>')).toBe(false);
  });
});
