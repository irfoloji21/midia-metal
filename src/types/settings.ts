// ---------------------------------------------------------------------------
// Settings domain types — canonical source for the frontend
// Matches backend: SiteSetting model, HeroSlide
// ---------------------------------------------------------------------------

/** A single site setting row from the `site_settings` table. */
export interface SiteSetting {
  id: number;
  key: string;
  value: string;
  type: string;
  group: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Setting groups used in the admin settings UI. */
export type SettingsGroup =
  | "general"
  | "seo"
  | "contact"
  | "about"
  | "services"
  | "portfolio"
  | "blog"
  | "home"
  | "legal"
  | "shipping-freight"
  | "payment"
  | "nav";

/** A hero slide record managed in admin settings. */
export interface HeroSlide {
  id: number | string;
  image: string;
  alt: string | null;
  order: number;
  active: boolean;
  /** Only present on newly-added slides before save. */
  isNew?: boolean;
}

/** A section in the admin settings UI. */
export interface SettingsSection {
  id: string;
  title: string;
  description?: string;
  keys: string[];
}
