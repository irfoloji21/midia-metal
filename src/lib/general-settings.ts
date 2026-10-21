import type { SettingsSection, SiteSetting } from '@/types/settings';

export const LEGACY_GENERAL_KEYS = new Set(['company_name', 'company_email', 'company_phone', 'company_address', 'services_hero_phone', 'nav_faq']);

export const GENERAL_SECTIONS: SettingsSection[] = [
  { id: 'company', title: 'Company & contact details', description: 'The shared name, email, phone and address used throughout the website.', keys: ['site_name', 'contact_email', 'contact_phone', 'contact_address', 'contact_map_url'] },
  { id: 'branding', title: 'Site logo', description: 'Upload or replace the logo used across the website.', keys: ['site_logo'] },
  { id: 'social', title: 'Social media', description: 'Profile links used in the menu and footer.', keys: ['social_facebook', 'social_twitter', 'social_tiktok', 'social_instagram'] },
  { id: 'hours', title: 'Working hours', description: 'Opening hours displayed in the footer.', keys: ['footer_working_hours'] },
  { id: 'navigation', title: 'Navigation labels', description: 'Keep or customise the names shown in the main menu and footer.', keys: ['header_nav_home', 'header_nav_services', 'header_nav_about', 'header_nav_portfolio', 'header_nav_blog', 'header_nav_shop', 'header_nav_contact', 'footer_nav_home', 'footer_nav_services', 'footer_nav_about', 'footer_nav_shop', 'footer_nav_contact'] },
  { id: 'footer', title: 'Footer text & headings', description: 'Copyright text and section headings. {{site_name}} follows the company name above.', keys: ['footer_text', 'footer_label_office', 'footer_label_links', 'footer_label_working_hours', 'footer_label_get_in_touch', 'footer_label_info'] },
  { id: 'policy-links', title: 'Policy links', description: 'The link labels displayed in the footer. Policy content is managed in Legal.', keys: ['footer_info_privacy', 'footer_info_terms', 'footer_info_cookies', 'footer_info_returns', 'footer_info_faq'] },
];

export const GENERAL_LABELS: Record<string, string> = {
  site_name: 'Company / site name', contact_email: 'Contact email', contact_phone: 'Contact phone',
  contact_address: 'Factory address', contact_map_url: 'Location map URL', site_logo: 'Site logo',
  social_facebook: 'Facebook profile URL', social_twitter: 'X / Twitter profile URL', social_tiktok: 'TikTok profile URL', social_instagram: 'Instagram profile URL',
  footer_working_hours: 'Working hours', footer_text: 'Copyright text', footer_label_office: 'Factory heading',
  footer_label_links: 'Navigation heading', footer_label_working_hours: 'Working hours heading', footer_label_get_in_touch: 'Social media heading', footer_label_info: 'Information heading',
  footer_info_privacy: 'Privacy policy link', footer_info_terms: 'Terms & conditions link', footer_info_cookies: 'Cookie policy link', footer_info_returns: 'Returns & refunds link', footer_info_faq: 'FAQ link',
};
for (const [key, label] of Object.entries({ home: 'Home', services: 'Services', about: 'About Us', portfolio: 'Portfolio', blog: 'Blog', shop: 'Shop', contact: 'Contact' })) {
  GENERAL_LABELS[`header_nav_${key}`] = `Main menu — ${label}`;
  GENERAL_LABELS[`footer_nav_${key}`] = `Footer menu — ${label}`;
}

export function generalSettingGroup(setting: SiteSetting): string {
  return ['header', 'footer'].includes(setting.group || '') || setting.key === 'contact_map_url' ? 'general' : setting.group || 'general';
}

/** Submit only edited fields in the selected section, preserving other editors' changes. */
export function changedSettings(settings: SiteSetting[], saved: Record<string, string>): Record<string, string> {
  return Object.fromEntries(settings.filter(s => !LEGACY_GENERAL_KEYS.has(s.key) && s.value !== saved[s.key]).map(s => [s.key, s.value ?? '']));
}
