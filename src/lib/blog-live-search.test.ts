import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeBlogLiveSearch } from './blog-live-search';

const resultsMarkup = (titles: string[], nextUrl?: string) => `<div data-blog-results aria-live="polite">
  <p>Showing ${titles.length ? 1 : 0}–${titles.length} of ${titles.length} articles</p>
  ${titles.map(title => `<article><h2>${title}</h2></article>`).join('')}
  ${titles.length === 0 ? '<p>No blog posts found.</p>' : ''}
  ${nextUrl ? `<nav aria-label="Blog pagination"><a rel="next" href="${nextUrl.replaceAll('&', '&amp;')}">Next</a></nav>` : ''}
</div>`;
const response = (titles: string[], nextUrl?: string) => ({
  ok: true,
  text: async () => `<section data-blog-catalogue>${resultsMarkup(titles, nextUrl)}</section>`,
});
const searchForm = () => document.querySelector<HTMLFormElement>('form[data-blog-search]')!;
const searchInput = () => searchForm().querySelector<HTMLInputElement>('input[name="search"]')!;
const status = () => searchForm().querySelector<HTMLElement>('[data-blog-search-status]')!;
const clearLink = () => searchForm().querySelector<HTMLAnchorElement>('[data-blog-clear-search]')!;
const categoryForms = () => Array.from(document.querySelectorAll<HTMLFormElement>('form[data-blog-category-form]'));
const titles = () => Array.from(document.querySelectorAll('[data-blog-results] h2')).map(node => node.textContent);
const type = (value: string) => {
  searchInput().value = value;
  searchInput().dispatchEvent(new InputEvent('input', { bubbles: true }));
};
const delay = (ms = 400) => vi.advanceTimersByTimeAsync(ms);
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({ preserved: true }, '', '/blog?page=2&category=Kitchen&category=Planning');
  document.body.innerHTML = `<section data-blog-catalogue>
    ${resultsMarkup(['Initial article'], '/blog?page=3&category=Kitchen&category=Planning')}
    <aside>
      <form method="get" action="/blog" data-blog-search>
        <input type="hidden" name="category" value="Kitchen">
        <input type="hidden" name="category" value="Planning">
        <div><input type="text" name="search" aria-label="Search articles" value=""><button type="submit" aria-label="Search articles">Search</button></div>
        <a data-blog-clear-search href="/blog?category=Kitchen&category=Planning" hidden>Clear search</a>
        <p data-blog-search-status role="status" hidden></p>
      </form>
      <form method="get" action="/blog" data-blog-category-form>
        <input type="hidden" name="search" value="">
        <input type="hidden" name="category" value="Planning">
        <button type="submit">Kitchen</button>
      </form>
      <form method="get" action="/blog" data-blog-category-form>
        <input type="hidden" name="search" value="">
        <input type="hidden" name="category" value="Kitchen">
        <input type="hidden" name="category" value="Planning">
        <input type="hidden" name="category" value="Metalwork">
        <button type="submit">Metalwork</button>
      </form>
      <div data-test-recent-posts>Recent article</div>
    </aside>
  </section>`;
  fetchMock = vi.fn().mockResolvedValue(response(['Canopy planning']));
  vi.stubGlobal('fetch', fetchMock);
  initializeBlogLiveSearch();
});

afterEach(() => {
  document.dispatchEvent(new Event('astro:before-swap'));
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('blog live search', () => {
  it('searches text entered before initialization without requiring another input event', async () => {
    document.dispatchEvent(new Event('astro:before-swap'));
    window.history.replaceState({ preserved: true }, '', '/blog?category=Kitchen&category=Planning');
    const input = searchInput();
    expect(input.defaultValue).toBe('');
    input.value = 'Castors';
    input.focus();
    input.setSelectionRange(7, 7);
    fetchMock.mockResolvedValueOnce(response(['Choosing castors']));

    initializeBlogLiveSearch();
    await delay(399);
    expect(fetchMock).not.toHaveBeenCalled();
    await delay(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get('search')).toBe('Castors');
    expect(params.getAll('category')).toEqual(['Kitchen', 'Planning']);
    expect(titles()).toEqual(['Choosing castors']);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(7);
    expect(clearLink().hidden).toBe(false);
  });

  it('waits for a typing pause, resets pagination and preserves categories, focus and selection', async () => {
    const input = searchInput();
    const recentPosts = document.querySelector('[data-test-recent-posts]');
    input.focus();
    type('can');
    await delay(200);
    type('canopy');
    input.setSelectionRange(2, 5);
    await delay(399);
    expect(fetchMock).not.toHaveBeenCalled();
    await delay(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/blog');
    expect(url.searchParams.get('search')).toBe('canopy');
    expect(url.searchParams.getAll('category')).toEqual(['Kitchen', 'Planning']);
    expect(url.searchParams.has('page')).toBe(false);
    expect(titles()).toEqual(['Canopy planning']);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(5);
    expect(document.querySelector('[data-test-recent-posts]')).toBe(recentPosts);
    expect(window.location.search).toContain('search=canopy');
    expect(window.history.state).toEqual({ preserved: true });
  });

  it('updates category submissions immediately, before the delayed search begins', async () => {
    type('canopy');
    for (const form of categoryForms()) {
      expect(new FormData(form).get('search')).toBe('canopy');
    }
    expect(new FormData(categoryForms()[1]).getAll('category')).toEqual(['Kitchen', 'Planning', 'Metalwork']);
    expect(clearLink().hidden).toBe(false);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    categoryForms()[1].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('syncs the current search value again immediately before category submission', () => {
    searchInput().value = 'latest term';
    categoryForms()[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(new FormData(categoryForms()[0]).get('search')).toBe('latest term');
  });

  it('clears live results immediately while retaining selected categories and focusing the input', async () => {
    type('canopy');
    await delay();
    fetchMock.mockResolvedValueOnce(response(['All matching categories']));
    clearLink().click();
    await delay(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const params = new URL(fetchMock.mock.calls[1][0]).searchParams;
    expect(params.has('search')).toBe(false);
    expect(params.has('page')).toBe(false);
    expect(params.getAll('category')).toEqual(['Kitchen', 'Planning']);
    expect(searchInput().value).toBe('');
    expect(clearLink().hidden).toBe(true);
    expect(document.activeElement).toBe(searchInput());
    expect(titles()).toEqual(['All matching categories']);
    for (const form of categoryForms()) expect(new FormData(form).get('search')).toBe('');
  });

  it('typing an empty search also restores category results', async () => {
    type('canopy');
    await delay();
    fetchMock.mockResolvedValueOnce(response(['Unsearched article']));
    type('');
    expect(clearLink().hidden).toBe(true);
    await delay();
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.has('search')).toBe(false);
    expect(titles()).toEqual(['Unsearched article']);
  });

  it('submits on Enter without intercepting the form navigation and cancels delayed work', async () => {
    let submit!: Event;
    const requestSubmit = vi.spyOn(searchForm(), 'requestSubmit').mockImplementation(() => {
      submit = new Event('submit', { bubbles: true, cancelable: true });
      searchForm().dispatchEvent(submit);
    });
    type('canopy');
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    expect(requestSubmit).not.toHaveBeenCalled();
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    searchInput().dispatchEvent(key);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(submit.defaultPrevented).toBe(false);
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns to the first page even when edits restore the original search text on page 2', async () => {
    type('x');
    await delay(100);
    type('');
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.has('page')).toBe(false);
    expect(params.has('search')).toBe(false);
    expect(new URL(window.location.href).searchParams.has('page')).toBe(false);
  });

  it('preserves modified clear-link clicks for opening the link in another tab', async () => {
    type('canopy');
    await delay();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    clearLink().dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(searchInput().value).toBe('canopy');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores an older response after the user types a newer term', async () => {
    let resolveOld!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    type('steel');
    await delay();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    type('canopy');
    expect(signal.aborted).toBe(true);
    await delay();
    resolveOld(response(['Outdated steel article']));
    await delay(0);
    expect(titles()).toEqual(['Canopy planning']);
    expect(new URL(window.location.href).searchParams.get('search')).toBe('canopy');
  });

  it('waits for composition to finish rather than searching incomplete text', async () => {
    searchInput().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    type('metal');
    await delay(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    searchInput().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('replaces no-results and pagination links using the latest server response', async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    type('missing');
    await delay();
    expect(document.querySelector('[data-blog-results]')?.textContent).toContain('No blog posts found.');
    expect(document.querySelector('[aria-label="Blog pagination"]')).toBeNull();
    fetchMock.mockResolvedValueOnce(response(['Canopy planning'], '/blog?search=canopy&category=Kitchen&category=Planning&page=2'));
    type('canopy');
    await delay();
    const next = document.querySelector<HTMLAnchorElement>('[aria-label="Blog pagination"] a[rel="next"]')!;
    const params = new URL(next.href).searchParams;
    expect(params.get('search')).toBe('canopy');
    expect(params.getAll('category')).toEqual(['Kitchen', 'Planning']);
    expect(params.get('page')).toBe('2');
  });

  it('encodes spaces, punctuation and non-ASCII search text without losing categories', async () => {
    type('steel & métal');
    await delay();
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get('search')).toBe('steel & métal');
    expect(params.getAll('category')).toEqual(['Kitchen', 'Planning']);
  });

  it.each([
    ['network rejection', () => Promise.reject(new Error('offline'))],
    ['HTTP failure', () => Promise.resolve({ ok: false })],
    ['unexpected HTML', () => Promise.resolve({ ok: true, text: async () => '<h1>Unavailable</h1>' })],
  ])('keeps existing articles and an accessible retry message on %s', async (_, result) => {
    fetchMock.mockImplementationOnce(result);
    const initialUrl = window.location.href;
    type('canopy');
    await delay();
    expect(titles()).toEqual(['Initial article']);
    expect(window.location.href).toBe(initialUrl);
    expect(status().hidden).toBe(false);
    expect(status().textContent).toMatch(/Enter/i);
    expect(document.querySelector('[data-blog-results]')).not.toHaveAttribute('aria-busy');
  });

  it('initializes once and cleans up before an Astro page replacement', async () => {
    initializeBlogLiveSearch();
    type('canopy');
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    type('steel');
    document.dispatchEvent(new Event('astro:before-swap'));
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a running search before another Astro navigation starts', async () => {
    let resolveRequest!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve; }));
    type('canopy');
    await delay();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    document.dispatchEvent(new Event('astro:before-preparation'));
    expect(signal.aborted).toBe(true);
    resolveRequest(response(['Stale response during navigation']));
    await delay(0);
    expect(titles()).toEqual(['Initial article']);
  });

  it('works after browser back/forward cache restoration', async () => {
    type('can');
    window.dispatchEvent(new Event('pagehide'));
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pageshow'));
    type('canopy');
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(titles()).toEqual(['Canopy planning']);
  });
});
