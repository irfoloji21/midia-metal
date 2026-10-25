import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from './RichTextEditor';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const marks = { bold: 'strong', italic: 'em', underline: 'u' } as const;
const selectors = { bold: 'strong,b', italic: 'em,i', underline: 'u' } as const;
type Mark = keyof typeof marks;

/** JSDOM has no editing commands. Model the browser behavior relevant to this regression:
 * collapsed typing marks live outside HTML and disappear when the selection is replaced.
 * Non-collapsed commands change real DOM so persistence is tested, not just command calls.
 */
function installEditingCommands() {
  const selection = window.getSelection()!;
  const originalRemove = selection.removeAllRanges.bind(selection);
  let pending: Partial<Record<Mark, boolean>> = {};
  let css = true; // A previous colour command can leave the document in CSS mode.
  const removed = vi.spyOn(selection, 'removeAllRanges').mockImplementation(() => {
    pending = {};
    originalRemove();
  });
  const range = () => selection.rangeCount ? selection.getRangeAt(0) : null;
  const elementAt = () => {
    const node = range()?.startContainer;
    return node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement;
  };
  const block = () => elementAt()?.closest('p,h1,h2,h3,h4,h5,h6,blockquote');
  const state = (command: string): boolean => {
    const current = range();
    if (!current || !(command in marks)) return false;
    const mark = command as Mark;
    if (current.collapsed && pending[mark] !== undefined) return pending[mark]!;
    if (elementAt()?.closest(selectors[mark])) return true;
    if (!current.collapsed) {
      const fragment = current.cloneContents();
      const marked = fragment.querySelector(selectors[mark]);
      return !!marked && marked.textContent === fragment.textContent;
    }
    return false;
  };
  const insert = (fragment: DocumentFragment, collapse = false) => {
    const current = range()!;
    current.deleteContents();
    const first = fragment.firstChild!;
    const last = fragment.lastChild!;
    current.insertNode(fragment);
    const next = document.createRange();
    next.setStartBefore(first);
    next.setEndAfter(last);
    if (collapse) next.collapse(false);
    selection.removeAllRanges();
    selection.addRange(next);
  };
  const unwrap = (fragment: DocumentFragment, selector: string) => {
    fragment.querySelectorAll(selector).forEach(node => node.replaceWith(...Array.from(node.childNodes)));
  };
  const exec = vi.fn((command: string, _showUI?: boolean, value?: string) => {
    if (command === 'styleWithCSS') { css = value === 'true'; return true; }
    if (command === 'defaultParagraphSeparator') return true;
    const current = range();
    if (!current) return false;
    if (command in marks) {
      const mark = command as Mark;
      const active = state(mark);
      if (current.collapsed) { pending[mark] = !active; return true; }
      const fragment = current.cloneContents();
      if (active) unwrap(fragment, selectors[mark]);
      else {
        const wrapper = document.createElement(css ? 'span' : marks[mark]);
        if (css) wrapper.setAttribute('style', mark === 'bold' ? 'font-weight:bold' : mark === 'italic' ? 'font-style:italic' : 'text-decoration:underline');
        wrapper.append(fragment);
        fragment.append(wrapper);
      }
      insert(fragment);
      return true;
    }
    if (command === 'insertText') {
      let node: Node = document.createTextNode(value || '');
      for (const mark of Object.keys(marks) as Mark[]) {
        if (state(mark)) { const wrapper = document.createElement(marks[mark]); wrapper.append(node); node = wrapper; }
      }
      const fragment = document.createDocumentFragment();
      fragment.append(node);
      insert(fragment, true);
      return true;
    }
    if (command === 'removeFormat') {
      pending = { bold: false, italic: false, underline: false };
      if (!current.collapsed) {
        const fragment = current.cloneContents();
        unwrap(fragment, 'strong,b,em,i,u,span');
        insert(fragment);
      }
      return true;
    }
    if (command === 'formatBlock') {
      const existing = block();
      if (!existing) return false;
      const collapsed = current.collapsed;
      const replacement = document.createElement((value || 'p').replace(/[<>]/g, ''));
      replacement.append(...Array.from(existing.childNodes));
      existing.replaceWith(replacement);
      const next = document.createRange();
      next.selectNodeContents(replacement);
      if (collapsed) next.collapse(false);
      selection.removeAllRanges();
      selection.addRange(next);
      return true;
    }
    return false;
  });
  const descriptors = new Map(['execCommand', 'queryCommandState', 'queryCommandValue'].map(name => [name, Object.getOwnPropertyDescriptor(document, name)]));
  Object.defineProperties(document, {
    execCommand: { configurable: true, value: exec },
    queryCommandState: { configurable: true, value: vi.fn(state) },
    queryCommandValue: { configurable: true, value: vi.fn(() => block()?.tagName.toLowerCase() || 'p') },
  });
  return { exec, removed, restore: () => descriptors.forEach((descriptor, name) => {
    if (descriptor) Object.defineProperty(document, name, descriptor);
    else Reflect.deleteProperty(document, name);
  }) };
}

function Editor({ label = 'Content', initial = '<p>Some text</p>', textOnly = true }: { label?: string; initial?: string; textOnly?: boolean }) {
  const [value, setValue] = useState(initial);
  return <><RichTextEditor label={label} value={value} onChange={setValue} textOnly={textOnly} documentLayout /><output data-testid={`${label}-saved`}>{value}</output></>;
}

function select(node: Node, collapsed = false) {
  const editor = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest<HTMLElement>('[contenteditable]');
  act(() => {
    editor?.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    if (collapsed) range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
}
const button = (name: string, label = 'Content') => within(screen.getByRole('toolbar', { name: `${label} formatting` })).getByRole('button', { name });
const clickTool = (name: string, label = 'Content') => { fireEvent.mouseDown(button(name, label)); fireEvent.click(button(name, label)); };
const saved = (label = 'Content') => screen.getByTestId(`${label}-saved`).textContent!;
let browser: ReturnType<typeof installEditingCommands>;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  browser = installEditingCommands();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); browser.restore(); vi.unstubAllGlobals(); });

describe('Rich text formatting controls', () => {
  it('keeps the caret and native DOM when a parent echoes sanitized typing, but accepts external changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor label="Echo" value="<p>Before</p>" textOnly onChange={onChange} />);
    const editor = screen.getByRole('textbox', { name: 'Echo' });
    // Chrome can emit DIV for a new line; the saved representation uses P.
    editor.innerHTML = '<div>Typed text</div>';
    const liveNode = editor.firstChild!;
    select(liveNode, true);
    const caret = window.getSelection()!.getRangeAt(0).cloneRange();
    fireEvent.input(editor);
    expect(onChange).toHaveBeenLastCalledWith('<p>Typed text</p>');
    rerender(<RichTextEditor label="Echo" value="<p>Typed text</p>" textOnly onChange={onChange} />);
    expect(editor.firstChild).toBe(liveNode);
    expect(window.getSelection()!.getRangeAt(0).startContainer).toBe(caret.startContainer);
    expect(window.getSelection()!.getRangeAt(0).startOffset).toBe(caret.startOffset);
    rerender(<RichTextEditor label="Echo" value="<p>External replacement</p>" textOnly onChange={onChange} />);
    expect(editor).toHaveTextContent('External replacement');
    expect(editor.firstChild).not.toBe(liveNode);
  });

  it.each(['Bold', 'Italic', 'Underline'])('toggles pending %s off without typing or replacing the unchanged caret', name => {
    render(<Editor />);
    const editor = screen.getByRole('textbox');
    select(editor.querySelector('p')!, true);
    browser.removed.mockClear();
    clickTool(name);
    expect(button(name)).toHaveAttribute('aria-pressed', 'true');
    clickTool(name);
    expect(button(name)).toHaveAttribute('aria-pressed', 'false');
    expect(browser.removed).not.toHaveBeenCalled();
    act(() => { document.execCommand('insertText', false, ' normal'); });
    fireEvent.input(editor);
    expect(saved()).toBe('<p>Some text normal</p>');
  });

  it.each(['Bold', 'Italic', 'Underline'])('toggles selected %s text on and off and persists the final HTML', name => {
    const { unmount } = render(<Editor />);
    const editor = screen.getByRole('textbox');
    select(editor.querySelector('p')!);
    clickTool(name);
    expect(button(name)).toHaveAttribute('aria-pressed', 'true');
    expect(saved()).toContain(`<${marks[name.toLowerCase() as Mark]}>Some text`);
    clickTool(name);
    expect(button(name)).toHaveAttribute('aria-pressed', 'false');
    expect(saved()).toBe('<p>Some text</p>');
    const value = saved();
    unmount();
    render(<Editor initial={value} />);
    expect(screen.getByRole('textbox').querySelector('strong,b,em,i,u')).toBeNull();
    expect(browser.exec).toHaveBeenCalledWith('styleWithCSS', false, 'false');
  });

  it.each(['Heading 2', 'Heading 3'])('returns %s to a normal paragraph through a second click or Normal paragraph', name => {
    render(<Editor />);
    select(screen.getByRole('textbox').querySelector('p')!, true);
    clickTool(name);
    expect(button(name)).toHaveAttribute('aria-pressed', 'true');
    clickTool(name);
    expect(saved()).toBe('<p>Some text</p>');
    expect(button('Normal paragraph')).toHaveAttribute('aria-pressed', 'true');
    clickTool(name);
    clickTool('Normal paragraph');
    expect(saved()).toBe('<p>Some text</p>');
    expect(button(name)).toHaveAttribute('aria-pressed', 'false');
  });

  it('removes one selected mark without clearing another mark or changing surrounding text', () => {
    render(<Editor initial='<p>Before middle after</p>' />);
    const editor = screen.getByRole('textbox');
    act(() => {
      editor.focus();
      const range = document.createRange();
      const text = editor.querySelector('p')!.firstChild!;
      range.setStart(text, 7);
      range.setEnd(text, 13);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    clickTool('Bold');
    clickTool('Italic');
    expect(button('Bold')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Italic')).toHaveAttribute('aria-pressed', 'true');
    clickTool('Bold');
    expect(saved()).toBe('<p>Before <em>middle</em> after</p>');
    expect(button('Bold')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Italic')).toHaveAttribute('aria-pressed', 'true');
    clickTool('Italic');
    expect(saved()).toBe('<p>Before middle after</p>');
  });

  it('clears selected inline formatting and the surrounding heading together', () => {
    render(<Editor initial='<h2><strong>Bold <em>and italic</em></strong></h2>' />);
    select(screen.getByRole('textbox').querySelector('h2')!);
    clickTool('Clear Format');
    expect(saved()).toBe('<p>Bold and italic</p>');
    expect(button('Heading 2')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Bold')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Italic')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Normal paragraph')).toHaveAttribute('aria-pressed', 'true');
  });

  it('tracks the selected editor and resets active controls when selection moves elsewhere', () => {
    render(<><Editor label='First' initial='<p><strong>Bold text</strong></p>' /><Editor label='Second' initial='<h3><em>Italic heading</em></h3>' /><p data-testid='outside'>Outside editors</p></>);
    const first = screen.getByRole('textbox', { name: 'First' });
    const second = screen.getByRole('textbox', { name: 'Second' });
    select(first.querySelector('strong')!, true);
    expect(button('Bold', 'First')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Bold', 'Second')).toHaveAttribute('aria-pressed', 'false');
    select(second.querySelector('em')!, true);
    expect(button('Bold', 'First')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Italic', 'Second')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Heading 3', 'Second')).toHaveAttribute('aria-pressed', 'true');
    select(screen.getByTestId('outside'), true);
    expect(button('Italic', 'Second')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Heading 3', 'Second')).toHaveAttribute('aria-pressed', 'false');
    expect(button('Normal paragraph', 'First')).toHaveAttribute('aria-pressed', 'false');
  });
});
