const initializedCatalogues = new WeakSet<HTMLElement>();
const SEARCH_DELAY = 400;

/** Keep the server-rendered filters and pagination, updating only article results. */
export function initializeBlogLiveSearch() {
  document.querySelectorAll<HTMLElement>('[data-blog-catalogue]').forEach((catalogue) => {
    const form = catalogue.querySelector<HTMLFormElement>('form[data-blog-search]');
    const input = form?.querySelector<HTMLInputElement>('input[name="search"]');
    const status = form?.querySelector<HTMLElement>('[data-blog-search-status]');
    const clearLink = form?.querySelector<HTMLAnchorElement>('[data-blog-clear-search]');
    if (!form || !input || !status || !clearLink || initializedCatalogues.has(catalogue)) return;
    initializedCatalogues.add(catalogue);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let revision = 0;
    let composing = false;
    const results = () => catalogue.querySelector<HTMLElement>('[data-blog-results]');
    const queryForForm = (useInitialValues = false) => {
      const params = new URLSearchParams();
      new FormData(form).forEach((value, key) => {
        const currentValue = useInitialValues && key === 'search' ? input.defaultValue : value;
        if (key !== 'page' && typeof currentValue === 'string' && currentValue.trim()) params.append(key, currentValue.trim());
      });
      return params.toString();
    };
    let appliedQuery = queryForForm(true);
    // Even unchanged search text on page 2 must return to the first result page.
    let appliedPage = new URL(window.location.href).searchParams.get('page') || '1';
    const synchronizeSearchControls = () => {
      catalogue.querySelectorAll<HTMLInputElement>('form[data-blog-category-form] input[name="search"]').forEach(hidden => {
        hidden.value = input.value.trim();
      });
      clearLink.hidden = !input.value.trim();
    };
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
      if (!catalogue.isConnected || !form.checkValidity()) return;
      const query = queryForForm();
      if (query === appliedQuery && appliedPage === '1') return;
      const currentRevision = revision;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      const url = new URL(form.action, window.location.href);
      url.search = query;
      results()?.setAttribute('aria-busy', 'true');
      setStatus('Searching articles…');
      try {
        const response = await fetch(url.href, { signal: controller.signal, headers: { Accept: 'text/html' } });
        if (!response.ok) throw new Error('Search unavailable');
        const html = await response.text();
        if (revision !== currentRevision || !catalogue.isConnected) return;
        const page = new DOMParser().parseFromString(html, 'text/html');
        const nextResults = page.querySelector<HTMLElement>('[data-blog-catalogue] [data-blog-results]');
        const currentResults = results();
        if (!nextResults || !currentResults) throw new Error('Search results missing');
        const focused = document.activeElement === input;
        const inputTop = input.getBoundingClientRect().top;
        currentResults.replaceWith(nextResults);
        appliedQuery = query;
        appliedPage = '1';
        window.history.replaceState(window.history.state, '', url);
        if (focused) {
          const offset = input.getBoundingClientRect().top - inputTop;
          if (offset) window.scrollBy(0, offset);
        }
        setStatus('');
      } catch {
        if (revision === currentRevision && catalogue.isConnected) {
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
      synchronizeSearchControls();
      setStatus('');
      if (!composing) debounce = setTimeout(search, SEARCH_DELAY);
    };
    const onInput = (event: Event) => {
      if (event instanceof InputEvent && event.isComposing) return;
      schedule();
    };
    const onCompositionStart = () => { composing = true; cancel(); setStatus(''); };
    const onCompositionEnd = () => { composing = false; schedule(); };
    const onSubmit = () => { synchronizeSearchControls(); cancel(); setStatus(''); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.isComposing && !composing) {
        event.preventDefault();
        form.requestSubmit();
      }
    };
    const onClear = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      input.value = '';
      cancel();
      synchronizeSearchControls();
      setStatus('');
      input.focus({ preventScroll: true });
      void search();
    };
    const onNavigation = () => { cancel(); setStatus(''); };
    const cleanup = () => {
      cancel();
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('keydown', onKeyDown);
      clearLink.removeEventListener('click', onClear);
      catalogue.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('astro:before-preparation', onNavigation);
      document.removeEventListener('astro:before-swap', cleanup);
      window.removeEventListener('pagehide', onNavigation);
      initializedCatalogues.delete(catalogue);
    };
    synchronizeSearchControls();
    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('keydown', onKeyDown);
    clearLink.addEventListener('click', onClear);
    catalogue.addEventListener('submit', onSubmit, true);
    document.addEventListener('astro:before-preparation', onNavigation);
    document.addEventListener('astro:before-swap', cleanup);
    window.addEventListener('pagehide', onNavigation);
    // Preserve text entered or autofilled before this module finished loading.
    if (queryForForm() !== appliedQuery) schedule();
  });
}
