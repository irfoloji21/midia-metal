import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RichTextEditor from "./RichTextEditor";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const initial = '<div class="service-section"><div class="service-copy"><h2>Made to fit</h2><p>Original text</p></div><div class="service-media"><img src="/old.webp" alt="Original description"></div></div>';
function Editor({ value = initial, serviceLayout = true, wordPaste = false, documentLayout = false, textOnly = false }: { value?: string; serviceLayout?: boolean; wordPaste?: boolean; documentLayout?: boolean; textOnly?: boolean }) {
  const [content, setContent] = useState(value);
  return <><RichTextEditor label="Content" serviceLayout={serviceLayout} wordPaste={wordPaste} documentLayout={documentLayout} textOnly={textOnly} value={content} onChange={setContent} /><output data-testid="saved-content">{content}</output></>;
}
function selectInside(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent.mouseUp(screen.getByRole("textbox"));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

describe("Product Word paste", () => {
  const clipboard = { getData: (type: string) => type === "text/html" ? '<p class="MsoHeading1">Pasted heading</p><p><span style="font-weight:bold">Bold text</span></p><img src="/fan.webp" alt="Fan">' : "Pasted heading Bold text" };

  it("replaces the live selection and retains formatting when reopened", () => {
    const { unmount } = render(<Editor value="<p>Old description</p>" wordPaste />);
    const editor = screen.getByRole("textbox");
    selectInside(editor.querySelector("p")!);
    const range = document.createRange();
    range.selectNodeContents(editor);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.paste(editor, { clipboardData: clipboard });
    expect(editor).not.toHaveTextContent("Old description");
    expect(editor.querySelector("h2.word-heading-1")).toHaveTextContent("Pasted heading");
    expect(editor.querySelector("strong")).toHaveTextContent("Bold text");
    const saved = screen.getByTestId("saved-content").textContent!;
    unmount();
    render(<Editor value={saved} wordPaste />);
    expect(screen.getByRole("heading", { name: "Pasted heading" })).toBeInTheDocument();
    expect(screen.getByAltText("Fan")).toHaveAttribute("src", "/fan.webp");
  });

  it("leaves other editors and non-Word clipboard content to native paste", () => {
    const { unmount } = render(<Editor />);
    expect(fireEvent.paste(screen.getByRole("textbox"), { clipboardData: clipboard })).toBe(true);
    unmount();
    render(<Editor wordPaste />);
    expect(fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { getData: () => "<p>Ordinary HTML</p>" } })).toBe(true);
  });

  it("does not replace the current description when Word omits image data", () => {
    render(<Editor value="<p>Keep this description</p>" wordPaste />);
    fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { getData: () => '<p class="MsoNormal">Text</p><img src="file:///C:/photo.png">' } });
    expect(screen.getByTestId("saved-content")).toHaveTextContent("<p>Keep this description</p>");
  });
});

describe("Description image rows", () => {
  it.each([2, 3] as const)("keeps a %i-column row and its replacement image when reopened", async (columns) => {
    vi.mocked(apiFetch).mockImplementation(async () => ({ url: "/uploaded.webp" }));
    const { container, unmount } = render(<Editor value="<p>Product description</p>" serviceLayout={false} />);
    selectInside(screen.getByRole("textbox").querySelector("p")!);
    fireEvent.click(screen.getByRole("button", { name: `${columns} images side by side` }));
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: Array.from({ length: columns }, (_, i) => new File(["photo"], `angle-${i}.webp`, { type: "image/webp" })) },
    });
    await waitFor(() => expect(screen.getByRole("textbox").querySelectorAll(`.img-row--${columns} img`)).toHaveLength(columns));

    fireEvent.click(screen.getByAltText("angle-0"));
    expect(screen.queryByRole("button", { name: "Add image + text" })).not.toBeInTheDocument();
    vi.spyOn(window, "prompt").mockReturnValue("Updated fan angle");
    fireEvent.click(screen.getByRole("button", { name: "Image description" }));
    vi.mocked(apiFetch).mockResolvedValue({ url: "/replacement.webp" });
    fireEvent.click(screen.getByRole("button", { name: "Replace photo" }));
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["photo"], "replacement.webp", { type: "image/webp" })] },
    });
    await waitFor(() => expect(screen.getByAltText("Updated fan angle")).toHaveAttribute("src", "/replacement.webp"));

    const saved = screen.getByTestId("saved-content").textContent!;
    unmount();
    render(<Editor value={saved} serviceLayout={false} />);
    expect(screen.getByRole("textbox").querySelectorAll(`.img-row--${columns} img`)).toHaveLength(columns);
    expect(screen.getByAltText("Updated fan angle")).toHaveAttribute("src", "/replacement.webp");
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Service layout editing", () => {
  it("keeps text edits and side changes when the saved HTML is reopened", () => {
    const { unmount } = render(<Editor />);
    const editor = screen.getByRole("textbox");
    editor.querySelector("p")!.textContent = "Updated description";
    fireEvent.input(editor);
    selectInside(editor.querySelector("h2")!);
    fireEvent.click(screen.getByRole("button", { name: "Swap sides" }));
    const saved = screen.getByTestId("saved-content").textContent!;
    expect(saved).toContain("Updated description");
    expect(saved).toContain("service-section--image-left");
    unmount();
    render(<Editor value={saved} />);
    expect(screen.getByRole("textbox").querySelector(".service-section--image-left img")).toHaveAttribute("src", "/old.webp");
  });

  it("adds a complete section and puts the uploaded image in its media column", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: "/uploaded.webp" });
    const { container } = render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Add image + text" }));
    expect(screen.getByRole("textbox").querySelectorAll(".service-section")).toHaveLength(2);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["photo"], "kitchen.webp", { type: "image/webp" })] },
    });
    await waitFor(() => expect(screen.getByRole("textbox").querySelectorAll(".service-media img")).toHaveLength(2));
    expect(screen.getByTestId("saved-content").textContent).toContain('/uploaded.webp');
  });

  it("replaces a selected photo without adding a second image or losing its alt text", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: "/replacement.webp" });
    const { container } = render(<Editor />);
    fireEvent.click(screen.getByAltText("Original description"));
    fireEvent.click(screen.getByRole("button", { name: "Replace photo" }));
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["photo"], "new.webp", { type: "image/webp" })] },
    });
    await waitFor(() => expect(screen.getByAltText("Original description")).toHaveAttribute("src", "/replacement.webp"));
    expect(screen.getByRole("textbox").querySelectorAll("img")).toHaveLength(1);
  });
});

describe('Template table editing', () => {
  const table = '<h2>Details</h2><table><thead><tr><th>Property</th><th>Value</th></tr></thead><tbody><tr><td>Power</td><td>180 W</td></tr></tbody></table>';
  it('adds and removes rows/columns without losing existing values and persists after reopening', () => {
    const { unmount } = render(<Editor value={table} serviceLayout={false} />);
    fireEvent.click(screen.getByText('Power'));
    fireEvent.click(screen.getByRole('button', { name: 'Add row below' }));
    const editor = screen.getByRole('textbox');
    expect(editor.querySelectorAll('tr')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Add column right' }));
    expect(Array.from(editor.querySelectorAll('tr')).every(row => row.cells.length === 3)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove row' }));
    expect(editor.querySelectorAll('tr')).toHaveLength(2);
    const saved = screen.getByTestId('saved-content').textContent!;
    unmount();render(<Editor value={saved} serviceLayout={false} />);
    expect(screen.getByRole('textbox')).toHaveTextContent('Power180 W');
    expect(screen.getByRole('textbox').querySelectorAll('td')).toHaveLength(2);
  });
  it('protects merged tables and the last row/column from destructive structural changes', () => {
    const { unmount } = render(<Editor value='<table><tbody><tr><td colspan="2">Merged</td></tr><tr><td>A</td><td>B</td></tr></tbody></table>' serviceLayout={false} />);
    fireEvent.click(screen.getByText('Merged'));
    expect(screen.getByRole('button', { name: 'Add row below' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove column' })).toBeDisabled();
    unmount();render(<Editor value='<table><tbody><tr><td>Last</td></tr></tbody></table>' serviceLayout={false} />);
    fireEvent.click(screen.getByText('Last'));
    expect(screen.getByRole('button', { name: 'Remove row' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove column' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add row below' })).toBeEnabled();
  });
  it('removes the column reached with the keyboard instead of the previously clicked column', () => {
    render(<Editor value={table} serviceLayout={false} />);
    const editor = screen.getByRole('textbox');
    fireEvent.click(screen.getByText('Power'));
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('180 W'));
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.keyUp(editor, { key: 'Tab' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove column' }));
    expect(editor).toHaveTextContent('PropertyPower');
    expect(editor).not.toHaveTextContent('180 W');
    expect(editor.querySelectorAll('td')).toHaveLength(1);
  });
  it('resolves the current caret again before removing a row', () => {
    render(<Editor value={table.replace('</tbody>', '<tr><td>Speed</td><td>1400 rpm</td></tr></tbody>')} serviceLayout={false} />);
    const editor = screen.getByRole('textbox');
    fireEvent.click(screen.getByText('Power'));
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('Speed'));
    range.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // Selection can change before a queued keyup reaches React.
    fireEvent.click(screen.getByRole('button', { name: 'Remove row' }));
    expect(editor).toHaveTextContent('Power180 W');
    expect(editor).not.toHaveTextContent('1400 rpm');
    expect(editor.querySelectorAll('tr')).toHaveLength(2);
  });
  it('clears table controls when keyboard navigation moves into ordinary text', () => {
    render(<Editor value={table} serviceLayout={false} />);
    const editor = screen.getByRole('textbox');
    fireEvent.click(screen.getByText('Power'));
    expect(screen.getByRole('toolbar', { name: 'Table editing' })).toBeVisible();
    const range = document.createRange();
    range.selectNodeContents(screen.getByRole('heading', { name: 'Details' }));
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.keyUp(editor, { key: 'ArrowUp' });
    expect(screen.queryByRole('toolbar', { name: 'Table editing' })).not.toBeInTheDocument();
    expect(screen.getByTestId('saved-content').textContent).toBe(table);
  });
  it('keeps document styling on the editing surface without storing editor attributes', () => {
    render(<Editor value={table} serviceLayout={false} documentLayout />);
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveClass('section-document');
    editor.querySelector('td')!.textContent = 'Voltage';
    fireEvent.input(editor);
    expect(screen.getByTestId('saved-content').textContent).toContain('<td>Voltage</td>');
    expect(screen.getByTestId('saved-content').textContent).not.toContain('section-document');
    expect(screen.getByTestId('saved-content').textContent).not.toContain('contenteditable');
  });
});

describe('Image upload boundaries and replacement links', () => {
  const chooseReplacement = (container: HTMLElement, alt = 'Original description') => {
    const image = screen.getByAltText(alt);
    // Browsers edit links inside contenteditable; jsdom otherwise navigates them.
    image.closest('a')?.addEventListener('click', event => event.preventDefault(), { once: true });
    fireEvent.click(image);
    fireEvent.click(screen.getByRole('button', { name: 'Replace photo' }));
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['photo'], 'replacement.webp', { type: 'image/webp' })] },
    });
  };

  it('ignores a pending upload after its editor closes and another section opens', async () => {
    let resolveUpload!: (value: { url: string }) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { resolveUpload = resolve; }));
    const oldChange = vi.fn();
    const newChange = vi.fn();
    const { container, unmount } = render(<RichTextEditor label="Old section" value={initial} onChange={oldChange} />);
    chooseReplacement(container);
    expect(apiFetch).toHaveBeenCalledOnce();
    unmount();
    render(<RichTextEditor label="New section" value="<p>Keep the other section</p>" onChange={newChange} />);
    await act(async () => { resolveUpload({ url: '/late-upload.webp' }); });
    expect(oldChange).not.toHaveBeenCalled();
    expect(newChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveTextContent('Keep the other section');
    expect(screen.getByRole('textbox').querySelector('img')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('ignores an upload if a different saved record replaces the same editor contents', async () => {
    let resolveUpload!: (value: { url: string }) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { resolveUpload = resolve; }));
    const onChange = vi.fn();
    const { container, rerender } = render(<RichTextEditor label="Content" value={initial} onChange={onChange} />);
    chooseReplacement(container);
    const originalEditor = screen.getByRole('textbox');
    rerender(<RichTextEditor label="Content" value="<p>Other saved record</p>" onChange={onChange} />);
    expect(screen.getByRole('textbox')).toBe(originalEditor);
    await act(async () => { resolveUpload({ url: '/late-upload.webp' }); });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox').innerHTML).toBe('<p>Other saved record</p>');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps text edits made in the same section while its image is uploading', async () => {
    let resolveUpload!: (value: { url: string }) => void;
    vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(resolve => { resolveUpload = resolve; }));
    const { container } = render(<Editor />);
    chooseReplacement(container);
    const editor = screen.getByRole('textbox');
    editor.querySelector('p')!.textContent = 'Text edited during upload';
    fireEvent.input(editor);
    await act(async () => { resolveUpload({ url: '/replacement.webp' }); });
    expect(screen.getByTestId('saved-content').textContent).toContain('Text edited during upload');
    expect(screen.getByAltText('Original description')).toHaveAttribute('src', '/replacement.webp');
    expect(toast.success).toHaveBeenCalledWith('Image uploaded');
  });

  it('updates a link to the replaced picture while preserving its layout and alt text', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: '/replacement.webp' });
    const value = '<p><a href="/old.webp" target="_blank"><img src="/old.webp" alt="Linked photo" width="240" style="width:40%;max-width:240px;float:left;margin:0 16px 12px 0;height:auto"></a>Product details</p>';
    const { container, unmount } = render(<Editor value={value} serviceLayout={false} />);
    const image = screen.getByAltText('Linked photo');
    const originalStyle = image.getAttribute('style');
    chooseReplacement(container, 'Linked photo');
    await waitFor(() => expect(image).toHaveAttribute('src', '/replacement.webp'));
    expect(image.closest('a')).toHaveAttribute('href', '/replacement.webp');
    expect(image.closest('a')).toHaveAttribute('target', '_blank');
    expect(image).toHaveAttribute('style', originalStyle);
    expect(image).toHaveAttribute('width', '240');
    const saved = screen.getByTestId('saved-content').textContent!;
    unmount();
    render(<Editor value={saved} serviceLayout={false} />);
    expect(screen.getByAltText('Linked photo').closest('a')).toHaveAttribute('href', '/replacement.webp');
    expect(screen.getByAltText('Linked photo')).toHaveAttribute('style', originalStyle);
  });

  it('preserves a picture link that deliberately opens a different page', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: '/replacement.webp' });
    const { container } = render(<Editor value='<a href="/contact"><img src="/old.webp" alt="Contact photo"></a>' serviceLayout={false} />);
    chooseReplacement(container, 'Contact photo');
    await waitFor(() => expect(screen.getByAltText('Contact photo')).toHaveAttribute('src', '/replacement.webp'));
    expect(screen.getByAltText('Contact photo').closest('a')).toHaveAttribute('href', '/contact');
  });
});

describe('Protected layout text slots', () => {
  const clipboard = (html: string, text = '') => ({ getData: (type: string) => type === 'text/html' ? html : type === 'text/plain' ? text : '' });

  it('offers formatting tools without image, layout or table controls', () => {
    const { container } = render(<Editor value='<p>Text slot</p>' textOnly serviceLayout />);
    for (const name of ['Bold', 'Italic', 'Underline', 'Heading 2', 'Bullet List', 'Link']) {
      expect(screen.getByRole('button', { name })).toBeVisible();
    }
    for (const name of ['Upload Image', 'Image Row (Side-by-Side)', '2 images side by side', '3 images side by side', 'Add image + text', 'Swap sides', 'Replace photo', 'Text Color', 'Add row below']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/Drag and drop images/)).not.toBeInTheDocument();
  });

  it('keeps safe pasted formatting while removing layout, images, tables and active attributes', () => {
    render(<Editor value='' textOnly serviceLayout={false} />);
    const editor = screen.getByRole('textbox');
    const html = '<div class="layout-block layout-block--images-2"><div class="layout-media"><img src="/unwanted.webp"></div><div class="layout-copy"><h2 onclick="bad()">Heading</h2><p><strong>Bold</strong> <em>italic</em> <u>underlined</u></p><ul><li>First</li></ul><a href="javascript:bad()">Unsafe link</a><a href="https://example.com/details">Safe link</a><span style="position:fixed" class="danger">Span text</span></div></div><table><tr><td>Table words</td></tr></table><script>bad()</script>';
    expect(fireEvent.paste(editor, { clipboardData: clipboard(html) })).toBe(false);
    expect(editor.querySelector('h2')).toHaveTextContent('Heading');
    expect(editor.querySelector('strong')).toHaveTextContent('Bold');
    expect(editor.querySelector('em')).toHaveTextContent('italic');
    expect(editor.querySelector('u')).toHaveTextContent('underlined');
    expect(editor.querySelector('li')).toHaveTextContent('First');
    expect(editor.querySelector('a[href="https://example.com/details"]')).toHaveTextContent('Safe link');
    expect(editor.querySelector('img,table,div,script,[onclick],[class],[style],a[href^="javascript:"]')).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('preserves Word headings and bold text without importing its pictures', () => {
    render(<Editor value='' textOnly wordPaste />);
    const editor = screen.getByRole('textbox');
    fireEvent.paste(editor, { clipboardData: clipboard('<p class="MsoHeading1">Word heading</p><p><span style="font-weight:bold">Bold text</span></p><img src="/fan.webp">') });
    expect(editor.querySelector('h2')).toHaveTextContent('Word heading');
    expect(editor.querySelector('strong')).toHaveTextContent('Bold text');
    expect(editor.querySelector('img,div,table')).toBeNull();
  });

  it('blocks dropped files and image-only paste without deleting selected text', () => {
    render(<Editor value='<p>Keep selected text</p>' textOnly />);
    const editor = screen.getByRole('textbox');
    const range = document.createRange();
    range.selectNodeContents(editor.querySelector('p')!);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const transfer = { files: [new File(['photo'], 'photo.webp', { type: 'image/webp' })], getData: () => '' };
    expect(fireEvent.drop(editor, { dataTransfer: transfer })).toBe(false);
    expect(fireEvent.paste(editor, { clipboardData: clipboard('<img src="/photo.webp">') })).toBe(false);
    expect(fireEvent.paste(editor, { clipboardData: { ...clipboard(''), files: transfer.files } })).toBe(false);
    expect(editor).toHaveTextContent('Keep selected text');
    expect(editor.querySelector('img')).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('saved-content').textContent).toBe('<p>Keep selected text</p>');
  });

  it('treats plain clipboard markup as literal text', () => {
    render(<Editor value='' textOnly />);
    const editor = screen.getByRole('textbox');
    fireEvent.paste(editor, { clipboardData: clipboard('', '<img src="not-an-image">\nSecond line') });
    expect(editor).toHaveTextContent('<img src="not-an-image">');
    expect(editor).toHaveTextContent('Second line');
    expect(editor.querySelector('img')).toBeNull();
  });

  it('does not rewrite untouched legacy text on focus and blur', () => {
    const original = '<span class="legacy-copy" style="color:#10275c">Keep <strong>existing formatting</strong>.</span>';
    render(<Editor value={original} textOnly />);
    const editor = screen.getByRole('textbox');
    fireEvent.focus(editor);
    fireEvent.blur(editor);
    expect(screen.getByTestId('saved-content').textContent).toBe(original);
    editor.innerHTML = '<p>Changed <strong>text</strong>.</p>';
    fireEvent.input(editor);
    expect(screen.getByTestId('saved-content').textContent).toBe('<p>Changed <strong>text</strong>.</p>');
  });

  it('clears all slot text without removing the surrounding fixed image or layout', () => {
    function FixedLayout() {
      const [text, setText] = useState('<h2>Heading</h2><p>Editable text</p>');
      return <div className="layout-block layout-block--image-left" data-testid="fixed-layout"><div className="layout-media"><img src="/fixed.webp" alt="Fixed photo slot" /></div><div className="layout-copy"><RichTextEditor label="Text slot" textOnly value={text} onChange={setText} /></div></div>;
    }
    render(<FixedLayout />);
    const editor = screen.getByRole('textbox');
    editor.innerHTML = '';
    fireEvent.input(editor);
    expect(editor.innerHTML).toBe('');
    expect(screen.getByTestId('fixed-layout')).toHaveClass('layout-block--image-left');
    expect(screen.getByAltText('Fixed photo slot')).toHaveAttribute('src', '/fixed.webp');
    expect(screen.getByTestId('fixed-layout').querySelectorAll(':scope > .layout-media')).toHaveLength(1);
    expect(screen.getByTestId('fixed-layout').querySelectorAll(':scope > .layout-copy')).toHaveLength(1);
  });
});
