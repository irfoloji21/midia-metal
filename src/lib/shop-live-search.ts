import { initializeShopPagination } from './shop-pagination';

const initializedForms = new WeakSet<HTMLFormElement>();
const SEARCH_DELAY = 400;

/** Enhance the existing GET form while retaining Enter and no-JavaScript navigation. */
export function initializeShopLiveSearch() {
  document.querySelectorAll<HTMLFormElement>('form[data-shop-catalogue]').forEach((form) => {
    const input = form.querySelector<HTMLInputElement>('input[name="search"]');
    const status = form.querySelector<HTMLElement>('[data-shop-search-status]');
    if (!input || !status || initializedForms.has(form)) return;
    initializedForms.add(form);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let revision = 0;
    let composing = false;

    const queryForForm = () => {
      const params = new URLSearchParams();
      new FormData(form).forEach((value, key) => {
        if (typeof value === 'string' && value.trim()) params.append(key, value);
      });
      return params.toString();
    };
    let appliedQuery = queryForForm();
    const results = () => form.querySelector<HTMLElement>('[data-shop-results]');
    const setStatus = (message: string) => {
      status.textContent = message;
      status.hidden = !message;
    };
    const cancel = () => {
      clearTimeout(debounce);
      request?.abort();
      request = undefined;
      revision++;
      results()?.removeAttribute('aria-busy');
    };

    const search = async () => {
      if (!form.isConnected || !form.checkValidity()) return;
      const query = queryForForm();
      if (query === appliedQuery) return;
      const currentRevision = revision;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      const url = new URL(form.action || window.location.href, window.location.href);
      url.search = query;
      results()?.setAttribute('aria-busy', 'true');
      setStatus('Searching products…');
      try {
        const response = await fetch(url.href, { signal: controller.signal, headers: { Accept: 'text/html' } });
        if (!response.ok) throw new Error('Search unavailable');
        const html = await response.text();
        if (revision !== currentRevision || !form.isConnected) return;
        const page = new DOMParser().parseFromString(html, 'text/html');
        const nextResults = page.querySelector<HTMLElement>('form[data-shop-catalogue] [data-shop-results]');
        const currentResults = results();
        if (!nextResults || !currentResults) throw new Error('Search results missing');

        const focused = document.activeElement === input;
        const inputTop = input.getBoundingClientRect().top;
        currentResults.replaceWith(nextResults);
        appliedQuery = query;
        window.history.replaceState(window.history.state, '', url);
        initializeShopPagination();
        document.dispatchEvent(new Event('shop:results-updated'));
        // On mobile the sidebar follows the cards; keep the active field in view.
        if (focused) {
          const offset = input.getBoundingClientRect().top - inputTop;
          if (offset) window.scrollBy(0, offset);
        }
        setStatus('');
      } catch {
        if (revision === currentRevision && form.isConnected) {
          setStatus('Search could not be updated. Press Enter to try again.');
        }
      } finally {
        clearTimeout(timeout);
        if (revision === currentRevision) {
          request = undefined;
          results()?.removeAttribute('aria-busy');
        }
      }
    };

    const schedule = () => {
      cancel();
      setStatus('');
      if (!composing) debounce = setTimeout(search, SEARCH_DELAY);
    };
    const onInput = (event: Event) => {
      if (event instanceof InputEvent && event.isComposing) return;
      schedule();
    };
    const onCompositionStart = () => { composing = true; cancel(); setStatus(''); };
    const onCompositionEnd = () => { composing = false; schedule(); };
    const onSubmit = () => { cancel(); setStatus(''); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.isComposing && !composing) {
        event.preventDefault();
        form.requestSubmit();
      }
    };
    const cleanup = () => {
      cancel();
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('keydown', onKeyDown);
      form.removeEventListener('submit', onSubmit);
      document.removeEventListener('astro:before-swap', cleanup);
      window.removeEventListener('pagehide', onSubmit);
      initializedForms.delete(form);
    };
    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('keydown', onKeyDown);
    form.addEventListener('submit', onSubmit);
    document.addEventListener('astro:before-swap', cleanup);
    // BFCache restores this DOM and its listeners without rerunning module scripts.
    window.addEventListener('pagehide', onSubmit);
  });
}
