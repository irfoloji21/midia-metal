import DOMPurify from "dompurify";

type Marks = { bold: boolean; italic: boolean; underline: boolean };

// Word Online copies rendered spans (and SVG wrappers around photographs),
// whereas desktop Word usually supplies Mso classes and ordinary image tags.
export function isWordHtml(html: string): boolean {
  return /\b(?:Mso\w+|SCXW\d+|data-ccp-|urn:schemas-microsoft-com:office:word|Word\.Document|Microsoft Word)\b/i.test(html);
}

export function normalizeWordHtml(html: string): { html: string; missingImages: number } {
  const source = new DOMParser().parseFromString(html, "text/html");
  const output = document.implementation.createHTMLDocument("");
  let missingImages = 0;
  const blocks = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "br", "a"]);
  const ignored = new Set(["script", "style", "meta", "link", "iframe", "object", "embed", "input", "button", "textarea", "noscript"]);

  const headingTag = (element: HTMLElement): string | undefined => {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return tag;
    if (tag !== "p" && !(tag === "div" && (element.getAttribute("role") === "heading" || /\bMso(?:Heading|Title)/i.test(element.className)))) return undefined;
    const styleName = element.querySelector("[data-ccp-parastyle]")?.getAttribute("data-ccp-parastyle") || "";
    const level = element.getAttribute("role") === "heading"
      ? element.getAttribute("aria-level")
      : /(?:heading|MsoHeading)\s*([1-6])/i.exec(`${element.className} ${styleName}`)?.[1];
    if (level && /^[1-6]$/.test(level)) return `h${level}`;
    if (/^(?:Title|MsoTitle)$/i.test(styleName) || element.classList.contains("MsoTitle")) return "h1";
    return undefined;
  };

  const image = (element: Element, src: string, alt: string): Node => {
    // Local file/blob URLs cannot survive a save or be read by another admin.
    if (!/^(?:https?:\/\/|\/(?!\/)|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(src)) {
      missingImages += 1;
      return output.createDocumentFragment();
    }
    const img = output.createElement("img");
    img.src = src;
    img.alt = alt;
    const width = parseFloat((element as HTMLElement).style?.width || element.getAttribute("width") || "");
    img.style.cssText = `max-width:100%;height:auto;${width > 0 ? `width:${Math.min(width, 2400)}px;` : ""}`;
    return img;
  };

  const convert = (node: Node, inherited: Marks): Node => {
    if (node.nodeType === Node.TEXT_NODE) {
      let result: Node = output.createTextNode((node.textContent || "").replace(/\u200b/g, ""));
      if (!result.textContent?.trim()) return result;
      for (const [enabled, tag] of [[inherited.bold, "strong"], [inherited.italic, "em"], [inherited.underline, "u"]] as const) {
        if (enabled) {
          const mark = output.createElement(tag);
          mark.append(result);
          result = mark;
        }
      }
      return result;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return output.createDocumentFragment();
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (ignored.has(tag) || element.classList.contains("EOP") || element.getAttribute("aria-hidden") === "true") return output.createDocumentFragment();
    if (tag === "img") return image(element, element.getAttribute("src") || "", element.getAttribute("alt") || "");
    if (tag === "svg") {
      const pictures = element.querySelectorAll("image");
      // Do not insert executable SVG; recover the embedded raster photograph.
      if (pictures.length === 1) {
        return image(element, pictures[0].getAttribute("href") || pictures[0].getAttribute("xlink:href") || "", element.querySelector("desc")?.textContent || "");
      }
      missingImages += 1;
      return output.createDocumentFragment();
    }
    const weight = element.style.fontWeight;
    const marks: Marks = {
      bold: weight ? weight === "bold" || Number(weight) >= 600 : ["b", "strong"].includes(tag) || inherited.bold,
      italic: element.style.fontStyle ? element.style.fontStyle === "italic" : ["i", "em"].includes(tag) || inherited.italic,
      underline: /underline/.test(element.style.textDecoration) || tag === "u" || inherited.underline,
    };
    const heading = headingTag(element);
    const headingLevel = heading ? Number(heading.slice(1)) : 0;
    const result = heading || blocks.has(tag) ? output.createElement(heading ? `h${Math.min(6, headingLevel + 1)}` : tag) : output.createDocumentFragment();
    for (const child of Array.from(element.childNodes)) result.appendChild(convert(child, marks));
    if (result.nodeType !== Node.ELEMENT_NODE) return result;
    const formatted = result as HTMLElement;
    if (heading) formatted.className = `word-heading-${headingLevel}`;
    if (/^(?:p|h[1-6]|td|th)$/.test(formatted.tagName.toLowerCase()) && /^(left|center|right|justify)$/.test(element.style.textAlign)) {
      formatted.style.textAlign = element.style.textAlign;
    }
    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href)) formatted.setAttribute("href", href);
    }
    if (tag === "td" || tag === "th") {
      for (const attr of ["colspan", "rowspan"]) {
        const value = element.getAttribute(attr) || "";
        if (/^\d{1,3}$/.test(value) && Number(value) > 0) formatted.setAttribute(attr, value);
      }
      const cells = Array.from(element.parentElement?.children || []) as HTMLElement[];
      const widths = cells.map(cell => parseFloat(cell.style.width || cell.getAttribute("width") || ""));
      const total = widths.reduce((sum, width) => sum + width, 0);
      const width = widths[cells.indexOf(element)];
      if (total > 0 && width > 0) formatted.style.width = `${(width / total * 100).toFixed(3)}%`;
    }
    if (tag === "table") {
      formatted.style.cssText = "width:100%;border-collapse:collapse;border-spacing:0;";
      const wrapper = output.createElement("div");
      const bordered = Number(element.getAttribute("border")) > 0 || Array.from(element.querySelectorAll("td,th")).some(cell => {
        const style = (cell as HTMLElement).style;
        return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some(width => parseFloat(width) > 0);
      });
      const rows = formatted.querySelectorAll(":scope > tbody > tr, :scope > tr");
      const layout = !bordered && rows.length === 1 && !formatted.querySelector("th,thead") && !!formatted.querySelector("img");
      wrapper.className = `word-table${bordered ? " word-table--bordered" : layout ? " word-table--layout" : ""}`;
      if (layout) {
        rows[0].querySelectorAll(":scope > td").forEach(cell => {
          if (!cell.textContent?.trim() && !cell.querySelector("img")) cell.className = "word-spacer";
        });
      }
      wrapper.append(formatted);
      return wrapper;
    }
    return formatted;
  };

  const wrapper = output.createElement("div");
  wrapper.className = "word-paste";
  for (const child of Array.from(source.body.childNodes)) wrapper.append(convert(child, { bold: false, italic: false, underline: false }));
  return {
    html: DOMPurify.sanitize(wrapper.outerHTML, {
      ALLOWED_TAGS: [...blocks, "div", "strong", "em", "u", "img"],
      ALLOWED_ATTR: ["class", "style", "href", "src", "alt", "colspan", "rowspan"],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
    }),
    missingImages,
  };
}
