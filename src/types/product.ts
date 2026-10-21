// ---------------------------------------------------------------------------
// Product domain types — canonical source for the frontend
// Matches backend: Product model, ProductCategory, ProductReview
// ---------------------------------------------------------------------------

/** Shipping class a product can belong to. */
export type ShippingClass = "standard" | "freight";

/** Variant mode stored on the product. */
export type VariantMode = "legacy" | "combination";

/** Section key for the variant table column visibility config. */
export type VariantTableSection = "size" | "general" | "combination";

/** Per-column visibility config stored in `product.variant_table_columns`. */
export interface VariantTableColumn {
  key: string;
  label: string;
  visible: boolean;
  frontendVisible: boolean;
}

/** Map of section → columns for the variant table. */
export type VariantTableColumns = Record<VariantTableSection, VariantTableColumn[]>;

// -- Variant shapes ----------------------------------------------------------

/** Shared shipping dimensions that can appear on both products and variants. */
export interface ShippingDimensions {
  shipping_weight_kg: number | null;
  shipping_length_cm: number | null;
  shipping_width_cm: number | null;
  shipping_height_cm: number | null;
}

/** Custom fields attached to a variant row (free-form key/value). */
export type VariantCustomFields = Record<string, string>;

/** A single variant in **legacy** mode (option/value pair). */
export interface LegacyVariant extends ShippingDimensions {
  option: string;
  value: string;
  price: string | null;
  stock: number | null;
  shipping_class: ShippingClass | string;
  ships_separately: boolean;
  custom_fields: VariantCustomFields;
}

/** A single variant in **combination** mode (multi-attribute). */
export interface CombinationVariant extends ShippingDimensions {
  attributes: Record<string, string>;
  price: string | null;
  stock: number | null;
  shipping_class: ShippingClass | string;
  ships_separately: boolean;
  custom_fields: VariantCustomFields;
}

/** Union of both variant shapes — use `isCombinationVariant()` to narrow. */
export type ProductVariant = LegacyVariant | CombinationVariant;

// -- Category ----------------------------------------------------------------

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  image: string;
  description: string;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// -- Review ------------------------------------------------------------------

export interface ProductReview {
  id: number;
  rating: number;
  comment: string;
  customer: { name: string };
  created_at: string;
}

// -- Product -----------------------------------------------------------------

/**
 * Full product shape as returned by the API.
 *
 * Prices are currently stored as formatted strings (e.g. "£150.00").
 * This will change to `number` after the decimal migration (item 4.1).
 */
export interface Product extends ShippingDimensions {
  id: number;
  name: string;
  product_code: string | null;
  show_variant_in_title: boolean;
  slug: string;
  variant_mode: VariantMode;
  variant_options: string[] | null;
  frontend_variant_layout: string;
  selection_table_config: Record<string, unknown> | null;
  price: string;
  price_on_request?: boolean;
  old_price: string | null;
  image: string;
  gallery: string[];
  description: string;
  product_category_id: number | null;
  tags: string[];
  badge: string | null;
  featured: boolean;
  active: boolean;
  order: number;
  stock_quantity: number;
  track_stock: boolean;
  shipping_class: ShippingClass | string | null;
  ships_separately: boolean;
  freight_delivery_price: number | null;
  specifications: Record<string, string> | null;
  variants: ProductVariant[] | null;
  variant_table_columns: VariantTableColumns | null;
  created_at: string;
  updated_at: string;

  // Relationships (included when eager-loaded)
  category?: ProductCategory;
  reviews?: ProductReview[];

  // Computed / appended (frontend-only helpers from API)
  share_url?: string;
  share_links?: { facebook: string; twitter: string };
}

/** Lightweight product card shape (e.g. related products). */
export interface ProductSummary {
  id: number;
  name: string;
  slug: string;
  price: string;
  price_on_request?: boolean;
  old_price?: string | null;
  image: string;
}

// -- Admin variant suggestion ------------------------------------------------

export interface VariantSuggestion {
  option: string;
  description: string;
  variants: Array<Record<string, unknown>>;
}
