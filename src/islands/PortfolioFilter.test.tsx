import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PortfolioFilter from './PortfolioFilter';
import { portfolioExcerpt } from '@/lib/portfolio-description';

afterEach(cleanup);
const categories = [{ id: 1, name: 'Ventilation' }, { id: 2, name: 'Metalwork' }];

describe('portfolio listing cards', () => {
  it('shows the prepared plain excerpt instead of section HTML', () => {
    const description = '<div class="content-section"><h2>Project overview</h2><p>Steel &amp; <strong>ventilation</strong>.</p><img src="/inside.jpg"><script>bad()</script></div>';
    const { container } = render(<PortfolioFilter categories={categories} projects={[{
      id: 15, title: 'QA project', slug: 'qa-project', image: '/cover.jpg', excerpt: portfolioExcerpt(description), portfolio_category: { name: 'Ventilation' },
    }]} />);
    expect(screen.getByText('Project overview Steel & ventilation.')).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/portfolio/qa-project');
    expect(container.querySelector('.content-section,script,strong')).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(container.textContent).not.toContain('<div');
    expect(container.textContent).not.toContain('bad()');
  });

  it('keeps category filtering and literal legacy text safe', () => {
    const { container } = render(<PortfolioFilter categories={categories} projects={[
      { id: 1, title: 'Kitchen', slug: 'kitchen', image: '/kitchen.jpg', excerpt: 'Kitchen project', portfolio_category: { name: 'Ventilation' } },
      { id: 2, title: 'Steel project', slug: 'steel', image: '/steel.jpg', excerpt: portfolioExcerpt('Measurements: 2 < 3. Literal <strong>steel</strong>.'), portfolio_category: { name: 'Metalwork' } },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Metalwork' }));
    expect(screen.queryByRole('heading', { name: 'Kitchen' })).not.toBeInTheDocument();
    expect(screen.getByText('Measurements: 2 < 3. Literal <strong>steel</strong>.')).toBeVisible();
    expect(container.querySelector('strong')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});
