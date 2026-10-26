import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeShopLiveSearch } from './shop-live-search';

const products = (names: string[]) => `<div data-shop-results aria-live="polite">
  <span data-showing-count>${Math.min(names.length, 2)}</span>
  ${names.map((name, index) => `<a data-product-card style="${index >= 2 ? 'display:none' : ''}">${name}</a>`).join('')}
  ${names.length > 2 ? '<button type="button" data-show-more>Show more</button><button type="button" data-show-less hidden>Show less</button>' : ''}
  ${names.length === 0 ? 'No products found.' : ''}
</div>`;
const response = (names: string[]) => ({ ok: true, text: async () => `<form data-shop-catalogue>${products(names)}</form>` });
const searchInput = () => document.querySelector<HTMLInputElement>('[name="search"]')!;
const status = () => document.querySelector<HTMLElement>('[data-shop-search-status]')!;
const form = () => document.querySelector<HTMLFormElement>('form')!;
const type = (value: string) => {
  searchInput().value = value;
  searchInput().dispatchEvent(new InputEvent('input', { bubbles: true }));
};
const delay = (ms = 400) => vi.advanceTimersByTimeAsync(ms);
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({ preserved: true }, '', '/shop');
  document.body.innerHTML = `<form method="GET" data-shop-catalogue data-initial-visible-count="2" data-show-more-count="1">
    ${products(['Initial product'])}
    <input type="text" name="search" value="">
    <select name="sort"><option value="price-low" selected>Low to high</option></select>
    <input type="radio" name="category" value="fans" checked>
    <input type="checkbox" name="stock" value="1" checked>
    <input type="checkbox" name="tag" value="steel" checked>
    <input type="checkbox" name="tag" value="silver" checked>
    <input type="number" name="min_price" min="0" value="0">
    <input type="number" name="max_price" min="0" value="">
    <p role="status" data-shop-search-status hidden></p>
  </form>`;
  fetchMock = vi.fn().mockResolvedValue(response(['Fan']));
  vi.stubGlobal('fetch', fetchMock);
  initializeShopLiveSearch();
});
afterEach(() => {
  document.dispatchEvent(new Event('astro:before-swap'));
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shop live search', () => {
  it('searches once after typing pauses, without Enter, while preserving filters and focus', async () => {
    const input = searchInput();
    input.focus();
    type('f');
    await delay(200);
    type('fan');
    input.setSelectionRange(3, 3);
    await delay(399);
    expect(fetchMock).not.toHaveBeenCalled();
    await delay(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get('search')).toBe('fan');
    expect(params.get('category')).toBe('fans');
    expect(params.get('stock')).toBe('1');
    expect(params.getAll('tag')).toEqual(['steel', 'silver']);
    expect(params.get('sort')).toBe('price-low');
    expect(params.has('max_price')).toBe(false);
    expect(document.querySelector('[data-product-card]')?.textContent).toBe('Fan');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(3);
    expect(window.location.search).toContain('search=fan');
    expect(window.history.state).toEqual({ preserved: true });
  });

  it('clearing the search restores unsearched results without a hidden maximum', async () => {
    type('fan');
    await delay();
    fetchMock.mockResolvedValueOnce(response(['Fan', 'Expensive kitchen']));
    type('');
    await delay();
    const params = new URL(fetchMock.mock.calls[1][0]).searchParams;
    expect(params.has('search')).toBe(false);
    expect(params.has('max_price')).toBe(false);
    expect(document.querySelector('[data-shop-results]')?.textContent).toContain('Expensive kitchen');
  });

  it('ignores an older response even if it completes after newer input', async () => {
    let resolveOld!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    type('f');
    await delay();
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    type('fan');
    expect(oldSignal.aborted).toBe(true);
    await delay();
    resolveOld(response(['Outdated product']));
    await delay(0);
    expect(document.querySelector('[data-product-card]')?.textContent).toBe('Fan');
    expect(window.location.search).toContain('search=fan');
  });

  it('keeps Enter and other native form submissions available and cancels pending live work', async () => {
    type('fan');
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form().dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(false);
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits immediately on Enter but not during composition', async () => {
    const requestSubmit = vi.spyOn(form(), 'requestSubmit').mockImplementation(() => {
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    type('fan');
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    expect(requestSubmit).not.toHaveBeenCalled();
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not search partially composed text', async () => {
    searchInput().dispatchEvent(new CompositionEvent('compositionstart'));
    type('fan');
    await delay(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    searchInput().dispatchEvent(new CompositionEvent('compositionend'));
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders no-results and rebinds pagination when later results replace it', async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    type('missing');
    await delay();
    expect(document.querySelector('[data-shop-results]')?.textContent).toContain('No products found.');
    fetchMock.mockResolvedValueOnce(response(['One', 'Two', 'Three', 'Four']));
    type('');
    await delay();
    document.querySelector<HTMLButtonElement>('[data-show-more]')!.click();
    expect(document.querySelector('[data-showing-count]')?.textContent).toBe('3');
    document.querySelector<HTMLButtonElement>('[data-show-less]')!.click();
    expect(document.querySelector('[data-showing-count]')?.textContent).toBe('2');
    fetchMock.mockResolvedValueOnce(response(['New One', 'New Two', 'New Three']));
    type('new');
    await delay();
    document.querySelector<HTMLButtonElement>('[data-show-more]')!.click();
    expect(document.querySelector('[data-showing-count]')?.textContent).toBe('3');
    expect(document.querySelector<HTMLButtonElement>('[data-show-more]')!.hidden).toBe(true);
  });

  it.each([
    ['network rejection', () => Promise.reject(new Error('offline'))],
    ['HTTP failure', () => Promise.resolve({ ok: false })],
    ['unexpected HTML', () => Promise.resolve({ ok: true, text: async () => '<h1>Error</h1>' })],
  ])('keeps existing products and offers Enter on %s', async (_, result) => {
    fetchMock.mockImplementationOnce(result);
    type('fan');
    await delay();
    expect(status().textContent).toContain('Press Enter');
    expect(status().hidden).toBe(false);
    expect(document.querySelector('[data-product-card]')?.textContent).toBe('Initial product');
    expect(window.location.search).toBe('');
    expect(document.querySelector('[data-shop-results]')).not.toHaveAttribute('aria-busy');
  });

  it('initializes once and cancels requests when leaving the catalogue', async () => {
    initializeShopLiveSearch();
    type('fan');
    document.dispatchEvent(new Event('astro:before-swap'));
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
    initializeShopLiveSearch();
    type('another fan');
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('works after a browser back/forward cache restore', async () => {
    type('f');
    window.dispatchEvent(new Event('pagehide'));
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pageshow'));
    type('fan');
    await delay();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-product-card]')?.textContent).toBe('Fan');
  });

  it('includes an explicit maximum and respects invalid numeric fields', async () => {
    const max = document.querySelector<HTMLInputElement>('[name="max_price"]')!;
    max.value = '-1';
    type('fan');
    await delay();
    expect(fetchMock).not.toHaveBeenCalled();
    max.value = '100';
    type('fan ');
    await delay();
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('max_price')).toBe('100');
  });
});
