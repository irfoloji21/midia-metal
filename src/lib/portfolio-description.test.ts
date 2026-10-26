import { describe, expect, it } from 'vitest';
import { portfolioExcerpt } from './portfolio-description';

describe('portfolio card excerpts', () => {
  it('extracts readable text from protected layouts without HTML or image details', () => {
    const html = '<div class="content-section"><div class="layout-block layout-block--image-left"><div class="layout-media"><img src="/project.jpg" alt="Photo description"></div><div class="layout-copy"><h2>Kitchen &amp; ventilation</h2><p>Stain<strong>less</strong> steel.</p><p>Made&nbsp;to fit.</p></div></div></div>';
    expect(portfolioExcerpt(html)).toBe('Kitchen & ventilation Stainless steel. Made to fit.');
  });

  it('omits executable and invisible markup while separating table and list text', () => {
    const html = '<div class="content-section"><script>doNotShow()</script><style>.hidden{display:none}</style><template>Hidden template</template><ul><li>Design</li><li>Installation</li></ul><table><tr><th>Material</th><td>Steel</td></tr></table></div>';
    expect(portfolioExcerpt(html)).toBe('Design Installation Material Steel');
  });

  it('preserves literal legacy descriptions and their first paragraph', () => {
    expect(portfolioExcerpt('Measurements: 2 < 3 & 5 > 4.\nMade to fit.\n\nSecond paragraph.'))
      .toBe('Measurements: 2 < 3 & 5 > 4. Made to fit.');
    expect(portfolioExcerpt('Literal <strong>steel</strong> &amp; material.'))
      .toBe('Literal <strong>steel</strong> &amp; material.');
    const fake = '<div data-class="content-section">A literal example</div>';
    expect(portfolioExcerpt(fake)).toBe(fake);
    expect(portfolioExcerpt('<div class="content-section-other">A literal example</div>'))
      .toBe('<div class="content-section-other">A literal example</div>');
  });

  it('uses exact class tokens including quoted and entity-decoded class attributes', () => {
    expect(portfolioExcerpt("<div class='extra content-section'><p>Project scope</p><p>Installation</p></div>"))
      .toBe('Project scope Installation');
    expect(portfolioExcerpt('<div class="content&#45;section"><p>Recognised content</p></div>'))
      .toBe('Recognised content');
  });

  it('limits long cards at a sensible word boundary and does not split Unicode characters', () => {
    const value = portfolioExcerpt('<div class="content-section"><p>Commercial kitchen ventilation designed for busy professional kitchens and restaurants.</p></div>', 50);
    expect(value).toBe('Commercial kitchen ventilation designed for busy…');
    expect(Array.from(value).length).toBeLessThanOrEqual(50);
    expect(portfolioExcerpt('🛠'.repeat(15), 10)).toBe(`${'🛠'.repeat(9)}…`);
  });

  it('handles missing and image-only descriptions without placeholder markup', () => {
    expect(portfolioExcerpt(null)).toBe('');
    expect(portfolioExcerpt('   ')).toBe('');
    expect(portfolioExcerpt('<div class="content-section"><img src="/photo.webp"></div>')).toBe('');
  });
});
