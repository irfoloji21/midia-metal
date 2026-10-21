import { describe, expect, it } from 'vitest';
import { hasProductEditorial, insertProductSpecifications } from './product-editorial';

describe('editable product specifications', () => {
  it('renders the current admin values and escapes HTML in both columns', () => {
    const html = '<div class="product-section"><h2>Introduction</h2></div><div class="product-spec-slot"></div>';
    expect(hasProductEditorial(html)).toBe(true);
    const output = insertProductSpecifications(html, [['Model', 'New revision'], ['<script>x</script>', '<img onerror="bad()">']]);
    expect(output).toContain('<th scope="row">Model</th><td>New revision</td>');
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;img onerror=&quot;bad()&quot;&gt;');
    expect(output).not.toContain('product-spec-slot');
  });

  it('keeps specifications visible if the editor removes the insertion marker', () => {
    const output = insertProductSpecifications('<div class="product-section"><h2>Overview</h2></div>', [['Power', '200 W']]);
    expect(output).toContain('<h2>Overview</h2>');
    expect(output).toContain('<td>200 W</td>');
  });

  it('does not add an empty technical table or opt plain descriptions into the new layout', () => {
    expect(hasProductEditorial('<p>Existing description</p>')).toBe(false);
    expect(insertProductSpecifications('<p>Introduction</p><div class="product-spec-slot"></div>', [])).toBe('<p>Introduction</p>');
  });
});
