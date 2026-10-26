import { fromHtml } from 'hast-util-from-html';
import type { RootContent } from 'hast';

const omittedTags = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object', 'svg']);
const separatedTags = new Set(['div', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'section', 'article']);

/** Cards receive plain text only. Match the backend's explicit rich-description marker. */
export function portfolioExcerpt(description: string | null | undefined, maxLength = 180): string {
  if (!description?.trim() || maxLength < 1) return '';
  const tree = fromHtml(description, { fragment: true });
  const pending: RootContent[] = [...tree.children];
  let structured = false;
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type !== 'element' || omittedTags.has(node.tagName)) continue;
    const classes = Array.isArray(node.properties.className) ? node.properties.className : [];
    if (node.tagName === 'div' && classes.includes('content-section')) structured = true;
    pending.push(...node.children);
  }
  const text = (node: RootContent): string => {
    if (node.type === 'text') return node.value;
    if (node.type !== 'element' || omittedTags.has(node.tagName)) return '';
    const content = node.children.map(text).join('');
    return separatedTags.has(node.tagName) ? ` ${content} ` : content;
  };
  // Legacy descriptions are literal text, including comparison signs and entity-like text.
  const raw = structured ? tree.children.map(text).join('') : description.split(/\n\s*\n/)[0];
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const characters = Array.from(normalized);
  if (characters.length <= maxLength) return normalized;
  const prefix = characters.slice(0, Math.max(0, maxLength - 1)).join('');
  const boundary = prefix.lastIndexOf(' ');
  const shortened = boundary >= prefix.length * 0.6 ? prefix.slice(0, boundary) : prefix;
  return `${shortened.trimEnd()}…`;
}
