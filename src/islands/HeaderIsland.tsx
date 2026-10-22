/**
 * HeaderIsland — React island wrapper for the Header component.
 * Used in BaseLayout.astro with client:load directive.
 *
 * This wraps the existing Header component and swaps the React context
 * (useCart) for nanostores. During migration, we keep using the existing
 * Header.tsx as-is and just provide it the cart data it needs.
 */
import { useEffect, useRef, useState } from 'react';
import { useSiteSettings } from '@/lib/use-site-settings';
import { useStore } from '@nanostores/react';
import { $cartCount } from '@/stores/cart';
import { useModalFocus } from '@/hooks/use-modal-focus';

// Re-export the existing Header but with nanostores context
// For now, we create a simplified header that works outside React Router.
// The full Header.tsx uses react-router-dom which won't work in Astro pages.
// This is a standalone version that uses <a> tags instead of <Link>.

interface HeaderIslandProps {
  initialSettings?: Record<string, string>;
}

export default function HeaderIsland({ initialSettings }: HeaderIslandProps) {
  const cartCount = useStore($cartCount);
  
  // Track hydration to avoid SSR mismatch for cart badge
  const [isHydrated, setIsHydrated] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const settings = useSiteSettings(initialSettings);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  useModalFocus(isSearchOpen, searchPanelRef, () => setIsSearchOpen(false));
  const infoPanelRef = useRef<HTMLDivElement>(null);
  useModalFocus(isInfoSidebarOpen, infoPanelRef, () => setIsInfoSidebarOpen(false));

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const t = (key: string, def: string) => settings[key] || def;

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery.trim())}`;
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  // Defer path computation to client-side only to avoid SSR hydration mismatch.
  // Listen for Astro View Transitions so the active nav updates after page swaps
  // (this island uses transition:persist, so it survives navigations).
  const [currentPath, setCurrentPath] = useState('');
  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
      setMobileOpen(false);
      setIsSearchOpen(false);
    };
    updatePath();
    document.addEventListener('astro:after-swap', updatePath);
    return () => document.removeEventListener('astro:after-swap', updatePath);
  }, []);

  const isPathActive = (path: string) => {
    if (!currentPath) return false; // During SSR / before hydration, nothing is active
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const navItems = [
    { label: t('header_nav_home', 'Home'), path: '/' },
    { label: t('header_nav_services', 'Services'), path: '/services' },
    { label: t('header_nav_about', 'About Us'), path: '/about' },
    { label: t('header_nav_portfolio', 'Portfolio'), path: '/portfolio' },
    { label: t('header_nav_blog', 'Blog'), path: '/blog' },
    { label: t('header_nav_shop', 'Shop'), path: '/shop' },
    { label: t('header_nav_contact', 'Contact'), path: '/contact' },
  ];

  return (
    <header className="relative z-50 bg-white border-b border-[#e6e9ef]">
      <div className="container mx-auto flex items-center justify-between h-[64px] md:h-[84px] px-4 lg:px-8">
        {/* Logo */}
        <a href="/" className="flex items-center">
          <img
            src={t('site_logo', '/logo.png')}
            alt={`${t('site_name', 'Midia M Metal')} Logo`}
            width="147"
            height="56"
            className="h-14 w-auto object-contain"
          />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={`text-[15px] leading-none font-medium transition-colors ${
                isPathActive(item.path)
                  ? 'text-primary underline underline-offset-[10px] decoration-[1.5px]'
                  : 'text-primary hover:text-orange'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3 md:gap-5">
          <a href="/cart" className="relative group" aria-label="Open cart">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-primary group-hover:text-orange transition-colors"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.72a2 2 0 0 0 2-1.58L22 6H6" /></svg>
            {isHydrated && cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-orange text-accent-foreground text-[10px] flex items-center justify-center rounded-full font-bold">
                {cartCount}
              </span>
            )}
          </a>
          <a href="/account" className="text-primary hover:text-orange transition-colors" aria-label="Open account">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </a>
          <button
            className="text-primary hover:text-orange transition-colors"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label={isSearchOpen ? 'Close search' : 'Open search'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </button>
          <button
            className="text-primary hover:text-orange transition-colors hidden lg:block"
            onClick={() => setIsInfoSidebarOpen(true)}
            aria-label="Open information sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
          </button>
          <button className="lg:hidden text-primary" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close mobile menu' : 'Open mobile menu'}>
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 12h16" /><path d="M4 6h16" /><path d="M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div ref={searchPanelRef} role="dialog" aria-modal="true" aria-label="Search products" tabIndex={-1} className="absolute inset-0 bg-white z-[60] flex items-center px-4 lg:px-8">
          <div className="container mx-auto flex items-center gap-4">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <input
                ref={searchInputRef}
                aria-label="Search products"
                type="text"
                placeholder="Search products..."
                className="w-full bg-transparent border-none text-2xl md:text-3xl font-semibold text-primary placeholder:text-muted-foreground/30 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="hidden">Search</button>
            </form>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-2 hover:bg-secondary rounded-full transition-colors"
              aria-label="Close search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-border shadow-lg flex flex-col">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={`px-8 py-4 text-[15px] hover:bg-muted transition-colors ${
                isPathActive(item.path) ? 'text-primary font-semibold' : 'text-primary'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {/* Desktop Info Sidebar */}
      {isInfoSidebarOpen && (
        <div ref={infoPanelRef} tabIndex={-1} className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Information">
          <button
            aria-label="Close information sidebar backdrop"
            tabIndex={-1}
            className="absolute inset-0 bg-[#0b1530]/30"
            onClick={() => setIsInfoSidebarOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[420px] max-w-full bg-[#f3f5f8] border-l border-[#d7dfeb] p-10 overflow-y-auto">
            <div className="flex items-center justify-between mb-16">
              <img src={t('site_logo', '/logo.png')} alt={`${t('site_name', 'Midia M Metal')} Logo`} width="147" height="56" className="h-14 w-auto object-contain mix-blend-multiply" />
              <button
                onClick={() => setIsInfoSidebarOpen(false)}
                className="w-14 h-14 rounded-full bg-[#e1e8f0] text-primary hover:bg-[#d6deea] transition-colors grid place-items-center"
                aria-label="Close information sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {[
                { icon: 'facebook', label: 'Facebook', href: t('social_facebook', '#') },
                { icon: 'twitter', label: 'Twitter', href: t('social_twitter', '#') },
                { icon: 'tiktok', label: 'TikTok', href: t('social_tiktok', t('social_dribbble', '#')) },
                { icon: 'instagram', label: 'Instagram', href: t('social_instagram', '#') },
              ].map(({ icon, label, href }) => (
                <a key={label} href={href} className="flex items-center gap-3 text-primary hover:text-orange transition-colors text-[17px] font-semibold" aria-label={label}>
                  {icon === 'facebook' && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 flex-shrink-0"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>}
                  {icon === 'twitter' && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 flex-shrink-0"><path d="M22 4s-.7 2.1-2 3.4c.2 1.4.2 2.8-.1 4.2A10 10 0 0 1 4 19c4.3.3 7.4-1.3 9-3 0 0-4.5.5-6-3 0 0 1.8.2 3-.2-2.5-1.5-3-4-3-5 0 0 1 .7 3 1-2.6-1.9-1.6-6 1-7a28.6 28.6 0 0 0 7 4s-1.5-4 2-6c0 0 2.1 0 4 2z" /></svg>}
                  {icon === 'tiktok' && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 1 1-2.9-2.9c.25 0 .49.03.72.09V9.34a6.4 6.4 0 1 0 5.73 6.36V9.4a8.2 8.2 0 0 0 4.77 1.52V7.47a4.85 4.85 0 0 1-1.1-.78Z" /></svg>}
                  {icon === 'instagram' && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 flex-shrink-0"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>}
                  {label}
                </a>
              ))}
            </div>
            <div className="mt-14 border-t border-[#c9d3e4] pt-10 space-y-6">
              <div className="flex items-start gap-3 text-[#6f7c95] text-[15px] leading-7">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#2f9cea] mt-0.5 flex-shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                <p>{t('contact_address', '')}</p>
              </div>
              <div className="space-y-2">
                <a href={`tel:${t('contact_phone', '')}`} className="flex items-start gap-3 text-primary hover:text-orange transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#2f9cea] mt-1 flex-shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  <span className="text-[30px] xl:text-[34px] leading-[1.05] font-semibold tracking-tight whitespace-nowrap">{t('contact_phone', '')}</span>
                </a>
              </div>
              <a href={`mailto:${t('contact_email', '')}`} className="flex items-center gap-3 text-[18px] text-[#6f7c95] hover:text-orange transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#2f9cea] flex-shrink-0"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                {t('contact_email', '')}
              </a>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
