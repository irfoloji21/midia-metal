import {describe, expect, it} from 'vitest';
import {getContentTemplates, type ContentTemplate} from './content-templates';

const legalKeys = ['privacy_policy_content', 'terms_conditions_content', 'cookies_page_content', 'returns_refunds_content'];
const allTemplates = (): ContentTemplate[] => [
  ...getContentTemplates('product'),
  ...getContentTemplates('service'),
  ...getContentTemplates('portfolio'),
  ...getContentTemplates('blog'),
  ...legalKeys.flatMap(key => getContentTemplates('page', key)),
];
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html').body;

describe('existing-content section templates', () => {
  it('keeps DD7 technical data, images and tables in independently usable sections', () => {
    const [template] = getContentTemplates('product');
    expect(template.sourceLabel).toBe('LONGWELL DD7-5 EC Centrifugal Fan');
    expect(template.sections).toHaveLength(14);
    const combined = parse(template.sections.map(section => section.html).join(''));
    expect(combined.querySelectorAll('img')).toHaveLength(10);
    expect(combined.querySelectorAll('table')).toHaveLength(7);
    expect(combined.querySelector('.product-spec-slot')).toBeNull();
    expect(combined.textContent).toContain('0–10 V');
    expect(combined.textContent).toContain('1,400');
    const performance = template.sections.find(section => section.id === 'dd7-performance');
    expect(performance).toBeDefined();
    const performanceBody = parse(performance!.html);
    expect(performanceBody.querySelectorAll('table tr')).toHaveLength(10);
    expect(performanceBody.textContent).toContain('1,134');
    expect(performanceBody.textContent).toContain('160');
    expect(template.sections.every(section => parse(section.html).querySelector('.word-paste'))).toBe(true);
    expect(combined.textContent).not.toMatch(/paste.*editor|edit the Specifications fields|upload images to this row/i);
  });

  it('uses the real service, project and article examples without transferring business record fields', () => {
    const [service] = getContentTemplates('service');
    expect(service.sourceLabel).toBe('Ventilation Systems');
    expect(service.sections).toHaveLength(2);
    expect(service.sections.every(section => parse(section.html).querySelector('.service-section'))).toBe(true);
    const [project] = getContentTemplates('portfolio');
    expect(project.sourceLabel).toBe('Cooking-Line Canopy Installation');
    expect(project.sections).toHaveLength(3);
    const projectBody = parse(project.sections.map(section => section.html).join(''));
    expect(projectBody.textContent).toContain('Both photographs show the same installation');
    expect(projectBody.querySelectorAll('img')).toHaveLength(2);
    const [article] = getContentTemplates('blog');
    expect(article.sourceLabel).toBe('Preparing a Clear Brief for Stainless Steel Fabrication');
    expect(article.sections).toHaveLength(7);
    expect(article.sections[0].title).toBe('Article introduction');
    expect(article.sections.at(-1)?.title).toBe('Maintain a clear revision record');
    for (const template of [service, project, article]) {
      expect(template).not.toHaveProperty('price');
      expect(template).not.toHaveProperty('stock');
      expect(template).not.toHaveProperty('active');
    }
  });

  it('offers legal sections only for their matching page', () => {
    const [returns] = getContentTemplates('page', 'returns_refunds_content');
    expect(returns.sourceLabel).toBe('Existing Returns and Refunds page');
    expect(returns.sections[0].title).toContain('Standard Products');
    const [privacy] = getContentTemplates('page', 'privacy_policy_content');
    expect(privacy.sections[0].title).toContain('Who We Are');
    expect(getContentTemplates('page', 'unknown_setting')).toEqual([]);
    expect(getContentTemplates('page')).toEqual([]);
  });

  it('contains attributable nonempty sections and portable safe image references', () => {
    const templates = allTemplates();
    expect(templates).toHaveLength(8);
    expect(new Set(templates.map(template => template.id)).size).toBe(templates.length);
    for (const template of templates) {
      expect(template.sourceLabel.trim()).not.toBe('');
      expect(template.sections.length).toBeGreaterThan(0);
      expect(new Set(template.sections.map(section => section.id)).size).toBe(template.sections.length);
      for (const section of template.sections) {
        expect(section.title.trim()).not.toBe('');
        const body = parse(section.html);
        expect(body.textContent?.trim() || body.querySelector('img')).toBeTruthy();
        expect(body.querySelector('script, style, iframe, object, embed, input, button, textarea')).toBeNull();
        for (const element of body.querySelectorAll('*')) {
          for (const attribute of element.attributes) expect(attribute.name).not.toMatch(/^on/i);
        }
        for (const image of body.querySelectorAll('img')) {
          expect(image.getAttribute('src')).toMatch(/^\/(?:images\/|storage\/product-content\/)/);
          expect(image.getAttribute('alt')?.trim()).toBeTruthy();
        }
        for (const link of body.querySelectorAll('a')) {
          expect(link.getAttribute('href')).toMatch(/^(?:\/(?!\/)|https?:\/\/|mailto:|tel:|#)/);
        }
      }
    }
  });

  it('does not let one form change the source examples used by another form', () => {
    const [first] = getContentTemplates('product');
    const original = first.sections[0].html;
    first.sections[0].html = '<p>Changed in an editor</p>';
    first.sections.pop();
    const [second] = getContentTemplates('product');
    expect(second.sections[0].html).toBe(original);
    expect(second.sections).toHaveLength(14);
  });
});
