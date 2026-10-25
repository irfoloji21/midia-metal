import catalog from '@/data/content-templates.json';

export type ContentTemplateKind = 'product' | 'service' | 'portfolio' | 'blog' | 'page';

export type ContentTemplateSection = {
  id: string;
  title: string;
  description?: string;
  html: string;
};

export type ContentTemplate = {
  id: string;
  title: string;
  sourceLabel: string;
  sections: ContentTemplateSection[];
};

type Catalog = {
  product: ContentTemplate[];
  service: ContentTemplate[];
  portfolio: ContentTemplate[];
  blog: ContentTemplate[];
  pages: Record<string, ContentTemplate[]>;
};

/** Examples come from existing published content, not from a new product's data. */
export function getContentTemplates(kind: ContentTemplateKind, settingKey?: string): ContentTemplate[] {
  const source = catalog as Catalog;
  const templates = kind === 'page'
    ? (settingKey ? source.pages[settingKey] || [] : [])
    : source[kind];

  // An editor may change its copy without altering the examples for another form.
  return templates.map(template => ({
    ...template,
    sections: template.sections.map(section => ({ ...section })),
  }));
}
