import { parseHtmlFragment } from './public-html';
import type { RootContent } from 'hast';

/** Only rendered section elements opt a description into the section canvas. */
export function hasProductSections(html: string | null | undefined): boolean {
  const nodes: RootContent[] = [...parseHtmlFragment(html || '').children];
  const nonRenderedTags = new Set(['script', 'style', 'template', 'noscript']);
  while (nodes.length) {
    const node = nodes.pop()!;
    if (node.type !== 'element' || nonRenderedTags.has(node.tagName)) continue;
    const classes = Array.isArray(node.properties.className) ? node.properties.className : [];
    if (classes.includes('content-section') || classes.includes('layout-block')) return true;
    nodes.push(...node.children);
  }
  return false;
}

export const hasProductEditorial = (html: string) => /class=["']product-section(?:\s|["'])/.test(html);

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

/** Keep the specification table tied to the existing admin Specifications fields. */
export function insertProductSpecifications(html: string, entries: Array<[string, string]>): string {
  const slot = /<div class=["']product-spec-slot["']>\s*<\/div>/;
  if (!entries.length) return html.replace(slot, "");
  const rows = entries.map(([key, value]) =>
    `<tr><th scope="row">${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`
  ).join("");
  const table = `<div class="product-section"><div class="product-eyebrow">Technical reference</div><h2>Technical specifications</h2><div class="product-table-wrap"><table><caption>Product specifications and dimensional reference</caption><tbody>${rows}</tbody></table></div></div>`;
  return slot.test(html) ? html.replace(slot, table) : html + table;
}
