import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProductDetailIsland from './ProductDetailIsland';
import { $customer, $isAuthLoading } from '@/stores/auth';

const product = {
  id: 88, slug: 'section-layout-test', name: 'Section layout test', price: '12.00',
  image: '/test.jpg', gallery: [], reviews: [], variants: [],
  specifications: { Material: 'Steel' }, pdf_download_enabled: false,
};
const columns = 'xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]';
beforeEach(() => {
  $customer.set(null);
  $isAuthLoading.set(false);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function showProduct(description: string, overrides = {}) {
  const fixture = { ...product, description, ...overrides };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/related') ? [] : fixture })));
  const view = render(<ProductDetailIsland id={product.slug} initialProduct={fixture} initialRelated={[]} />);
  await act(async () => {});
  return view;
}

it('gives section descriptions the full row and keeps specifications below them through tab changes', async () => {
  const description = '<div class="content-section"><div class="layout-block layout-block--image-left"><div class="layout-media"><img src="/work.jpg" alt="Workshop" /></div><div class="layout-copy"><h2>Made to fit</h2><p>Custom metalwork</p></div></div></div><div class="content-section"><p>Finishing options</p></div>';
  const { container } = await showProduct(description);
  const layout = container.querySelector('[data-product-details-layout="sections"]')!;
  const content = container.querySelector('[data-product-detail-content]')!;
  const specs = screen.getByRole('complementary', { name: 'Product specifications' });
  expect(layout).not.toHaveClass(columns);
  expect(specs.parentElement).toBe(layout);
  expect(content.nextElementSibling).toBe(specs);
  expect(content.querySelectorAll('.content-section')).toHaveLength(2);
  expect(content.querySelector('[data-product-description] .prose')).toHaveTextContent('Custom metalwork');
  expect(within(specs).getByText('Steel')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Reviews (0)' }));
  expect(screen.getByText('Customer Reviews')).toBeInTheDocument();
  expect(within(specs).getByText('Steel')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Description' }));
  expect(screen.getByRole('heading', { name: 'Made to fit' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { name: 'Specifications' })).toHaveLength(1);
});

it('keeps ordinary descriptions and their specifications in the existing sidebar layout', async () => {
  const { container } = await showProduct('<p>Ordinary product description.</p>');
  expect(container.querySelector('[data-product-details-layout="legacy"]')).toHaveClass(columns);
  expect(container.querySelector('[data-product-description] .prose')).toHaveTextContent('Ordinary product description.');
  expect(screen.getByRole('complementary', { name: 'Product specifications' })).toHaveTextContent('Steel');
});

it('preserves the DD7 editorial specification insertion without a duplicate sidebar', async () => {
  const { container } = await showProduct('<div class="product-section"><h2>Fan overview</h2></div><div class="product-spec-slot"></div>');
  expect(container.querySelector('[data-product-details-layout="sections"]')).not.toHaveClass(columns);
  expect(screen.getByRole('table', { name: 'Product specifications and dimensional reference' })).toHaveTextContent('Steel');
  expect(screen.queryByRole('complementary', { name: 'Product specifications' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { name: 'Technical specifications' })).toHaveLength(1);
});

it('does not create an empty specifications row for image-only sections', async () => {
  const { container } = await showProduct('<div class="content-section"><div class="layout-block layout-block--image"><div class="layout-media"><img src="/work.jpg" alt="Workshop" /></div></div></div>', { specifications: {} });
  expect(container.querySelector('[data-product-details-layout="sections"]')).not.toHaveClass(columns);
  expect(screen.queryByRole('complementary', { name: 'Product specifications' })).not.toBeInTheDocument();
  expect(container.querySelector('[data-product-description] img')).toHaveAttribute('alt', 'Workshop');
});
