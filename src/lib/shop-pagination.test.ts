import { afterEach, describe, expect, it } from 'vitest';
import { initializeShopPagination } from './shop-pagination';

function renderCatalogue(total: number) {
  document.body.innerHTML = `
    <form data-shop-catalogue data-initial-visible-count="18" data-show-more-count="9">
      <span data-showing-count>${Math.min(total, 18)}</span>
      ${Array.from({ length: total }, (_, index) => `<a data-product-card style="${index >= 18 ? 'display:none' : ''}">Product ${index + 1}</a>`).join('')}
      ${total > 18 ? '<button type="button" data-show-more>Show more</button><button type="button" data-show-less hidden>Show less</button>' : ''}
    </form>`;
}

const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;
const count = () => document.querySelector('[data-showing-count]')?.textContent;
const visibleCards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-product-card]')).filter(card => card.style.display !== 'none').length;

afterEach(() => { document.body.innerHTML = ''; });

describe('shop pagination', () => {
  it('reveals remaining products and collapses them with matching counts and controls', () => {
    renderCatalogue(27);
    initializeShopPagination();
    button('[data-show-more]').click();
    expect(visibleCards()).toBe(27);
    expect(count()).toBe('27');
    expect(button('[data-show-more]')).not.toBeVisible();
    expect(button('[data-show-less]')).toBeVisible();
    button('[data-show-less]').click();
    expect(visibleCards()).toBe(18);
    expect(count()).toBe('18');
    expect(button('[data-show-more]')).toBeVisible();
    expect(button('[data-show-less]')).not.toBeVisible();
  });

  it('works on replacement page content without binding multiple handlers to the same controls', () => {
    for (let visit = 0; visit < 3; visit++) {
      renderCatalogue(40);
      initializeShopPagination();
      initializeShopPagination();
      button('[data-show-more]').click();
      expect(visibleCards()).toBe(27);
      expect(count()).toBe('27');
      initializeShopPagination();
      button('[data-show-more]').click();
      expect(visibleCards()).toBe(36);
      button('[data-show-more]').click();
      expect(visibleCards()).toBe(40);
    }
  });

  it('handles non-shop pages and filtered catalogues without pagination', () => {
    expect(initializeShopPagination).not.toThrow();
    renderCatalogue(8);
    expect(initializeShopPagination).not.toThrow();
    expect(visibleCards()).toBe(8);
  });
});
