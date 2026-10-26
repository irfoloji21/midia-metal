const initializedCatalogues = new WeakSet<HTMLElement>();

export function initializeShopPagination() {
  document.querySelectorAll<HTMLElement>('[data-shop-catalogue]').forEach((catalogue) => {
    const results = catalogue.querySelector<HTMLElement>('[data-shop-results]') || catalogue;
    if (initializedCatalogues.has(results)) return;

    const cards = Array.from(catalogue.querySelectorAll<HTMLElement>('[data-product-card]'));
    const showingCount = catalogue.querySelector<HTMLElement>('[data-showing-count]');
    const showMoreButton = catalogue.querySelector<HTMLButtonElement>('[data-show-more]');
    const showLessButton = catalogue.querySelector<HTMLButtonElement>('[data-show-less]');
    const initialVisibleCount = Number(catalogue.dataset.initialVisibleCount);
    const showMoreCount = Number(catalogue.dataset.showMoreCount);
    if (!showMoreButton || !showLessButton || cards.length <= initialVisibleCount) return;

    initializedCatalogues.add(results);
    let visibleCount = initialVisibleCount;

    const updateVisibleProducts = (nextCount: number) => {
      visibleCount = Math.max(initialVisibleCount, Math.min(nextCount, cards.length));
      cards.forEach((card, index) => {
        if (index < visibleCount) card.style.removeProperty('display');
        else card.style.display = 'none';
      });
      if (showingCount) showingCount.textContent = String(visibleCount);
      showMoreButton.hidden = visibleCount >= cards.length;
      showLessButton.hidden = visibleCount <= initialVisibleCount;
    };

    showMoreButton.addEventListener('click', () => updateVisibleProducts(visibleCount + showMoreCount));
    showLessButton.addEventListener('click', () => updateVisibleProducts(visibleCount - showMoreCount));
  });
}
