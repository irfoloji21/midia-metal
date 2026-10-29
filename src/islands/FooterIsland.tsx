/**
 * FooterIsland — React island wrapper for the Footer component.
 * Used in BaseLayout.astro with client:visible directive.
 *
 * Standalone version that uses <a> tags instead of react-router-dom <Link>.
 * Faithfully reproduces src/components/Footer.tsx layout and behaviour.
 *
 * Server-rendered settings are refreshed after client navigation so shared
 * company details stay current even when this island persists.
 */
import { useSiteSettings } from '@/lib/use-site-settings';
import { currentCopyright, socialProfileUrl } from '@/lib/footer-content';

interface FooterIslandProps {
  initialSettings?: Record<string, string>;
}

export default function FooterIsland({ initialSettings }: FooterIslandProps) {
  const settings = useSiteSettings(initialSettings);

  const t = (key: string, def: string) => settings[key] || def;
  const socialLinks = [
    { icon: 'facebook', label: 'Facebook', href: t('social_facebook', '') },
    { icon: 'twitter', label: 'Twitter', href: t('social_twitter', '') },
    { icon: 'tiktok', label: 'TikTok', href: t('social_tiktok', '') },
    { icon: 'instagram', label: 'Instagram', href: t('social_instagram', '') },
  ].map(item => ({ ...item, href: socialProfileUrl(item.href) })).filter(item => item.href);

  return (
    <footer className="relative z-10 bg-[#031946] text-white">
      <div className="container mx-auto px-4 lg:px-8 py-16 md:py-20">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${socialLinks.length ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-10 md:gap-12`}>
          {/* Working Hours */}
          <div>
            <h4 className="font-sans text-xl font-semibold mb-6">
              {t('footer_label_working_hours', 'Working Hours')}
            </h4>
            <div className="space-y-2">
              <p className="text-white/70 text-sm whitespace-pre-line">
                {t('footer_working_hours', 'Mon-Fri: 9 AM — 6 PM\nSaturday: 9 AM — 4 PM\nSunday: Closed')}
              </p>
            </div>
          </div>

          {/* Factory */}
          <div>
            <h4 className="font-sans text-xl font-semibold mb-6">
              {t('footer_label_office', 'Factory')}
            </h4>
            <div className="space-y-2">
              <p className="text-white/70 text-sm whitespace-pre-line">
                {t('contact_address', '')}
              </p>
              <div className="pt-2">
                <a
                  href={`mailto:${t('contact_email', '')}`}
                  className="text-white text-sm underline decoration-white/40 hover:decoration-white transition-all"
                >
                  {t('contact_email', '')}
                </a>
              </div>
              <div className="pt-4">
                <p className="text-white text-[22px] leading-none font-medium">
                  <a
                    href={`tel:${t('contact_phone', '')}`}
                    className="hover:text-orange transition-colors"
                  >
                    {t('contact_phone', '')}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-sans text-xl font-semibold mb-6">
              {t('footer_label_links', 'Quick Links')}
            </h4>
            <ul className="space-y-2">
              {[
                { label: t('footer_nav_home', 'Home'), path: '/' },
                { label: t('footer_nav_services', 'Services'), path: '/services' },
                { label: t('footer_nav_about', 'About Us'), path: '/about' },
                { label: t('footer_nav_shop', 'Shop'), path: '/shop' },
                { label: t('footer_nav_contact', 'Contact'), path: '/contact' },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.path}
                    className="text-white/80 text-sm hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Information links */}
          <div>
            <h4 className="font-sans text-xl font-semibold mb-6">
              {t('footer_label_info', 'Information')}
            </h4>
            <ul className="space-y-2">
              {[
                { label: t('footer_info_privacy', 'Privacy Policy'), path: '/privacy-policy' },
                { label: t('footer_info_terms', 'Terms & Conditions'), path: '/terms-of-service' },
                { label: t('footer_info_cookies', 'Cookie Policy'), path: '/cookies' },
                { label: t('footer_info_returns', 'Returns & Refunds'), path: '/returns-policy' },
                { label: t('footer_info_faq', 'FAQ'), path: '/faq' },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.path}
                    className="text-white/80 text-sm hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Get in Touch */}
          {socialLinks.length > 0 && <div>
            <h4 className="font-sans text-xl font-semibold mb-6">
              {t('footer_label_get_in_touch', 'Get in Touch')}
            </h4>
            <div className="flex gap-4">
              {socialLinks.map(({ icon, label, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-orange hover:border-orange transition-all group"
                  aria-label={label}
                >
                  {icon === 'facebook' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white group-hover:text-white"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>}
                  {icon === 'twitter' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white group-hover:text-white"><path d="M22 4s-.7 2.1-2 3.4c.2 1.4.2 2.8-.1 4.2A10 10 0 0 1 4 19c4.3.3 7.4-1.3 9-3 0 0-4.5.5-6-3 0 0 1.8.2 3-.2-2.5-1.5-3-4-3-5 0 0 1 .7 3 1-2.6-1.9-1.6-6 1-7a28.6 28.6 0 0 0 7 4s-1.5-4 2-6c0 0 2.1 0 4 2z" /></svg>}
                  {icon === 'tiktok' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white group-hover:text-white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 1 1-2.9-2.9c.25 0 .49.03.72.09V9.34a6.4 6.4 0 1 0 5.73 6.36V9.4a8.2 8.2 0 0 0 4.77 1.52V7.47a4.85 4.85 0 0 1-1.1-.78Z" /></svg>}
                  {icon === 'instagram' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white group-hover:text-white"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>}
                </a>
              ))}
            </div>
          </div>}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 lg:px-8 py-6 flex justify-between items-center">
          <p className="text-white/65 text-xs tracking-wide">
            {currentCopyright(t('footer_text', 'midiaM \u00A9 2024. All Rights Reserved.'))}
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-10 h-10 bg-orange text-white flex items-center justify-center hover:bg-orange-hover transition-colors"
            aria-label="Back to top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="m18 15-6-6-6 6" /><path d="M12 19V9" /></svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
