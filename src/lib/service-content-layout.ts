import { parseHtmlFragment } from './public-html';
import type { RootContent } from 'hast';

export type ServiceContentLayout = 'sections' | 'editorial' | 'legacy';

/** Layout markers belong to real HTML elements, not text or attribute substrings. */
export function serviceContentLayout(content: string | null | undefined): ServiceContentLayout {
  const nodes: RootContent[] = [...parseHtmlFragment(content || '').children];
  let hasSection = false;
  let hasEditorial = false;
  let hasLayoutBlock = false;
  while (nodes.length) {
    const node = nodes.pop()!;
    if (node.type !== 'element') continue;
    const classes = Array.isArray(node.properties.className) ? node.properties.className : [];
    hasSection ||= classes.includes('content-section');
    hasEditorial ||= classes.includes('service-section');
    hasLayoutBlock ||= classes.includes('layout-block');
    nodes.push(...node.children);
  }
  // Mixed documents use the bounded section canvas; old editorial-only pages
  // keep their edge-to-edge alternating bands and existing responsive padding.
  if (hasLayoutBlock) return 'sections';
  if (hasEditorial) return 'editorial';
  return hasSection ? 'sections' : 'legacy';
}
