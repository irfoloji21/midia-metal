// ---------------------------------------------------------------------------
// Cart domain types — canonical source for the frontend
// Re-exports the existing types from cart store for consistency
// ---------------------------------------------------------------------------

import type { VariantSelection } from "@/lib/variants";

/** A single item in the shopping cart. */
export interface CartItem {
  /** Unique ID: `${product_id}` or `${product_id}-Option-Value-...`. */
  id: number | string;
  product_id: number | string;
  name: string;
  /** Formatted price string, e.g. "£150.00". */
  price: string | number;
  qty: number;
  image: string;
  /** Map of option name → { option, value } for the selected variants. */
  selected_variants?: Record<string, VariantSelection> | null;
  track_stock?: boolean;
  stock_quantity?: number | null;
  available_stock?: number | null;
  availability_error?: string;
}

/** A successfully applied coupon. */
export interface AppliedCoupon {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  discount: number;
  message: string;
}

/** Checkout form data persisted to sessionStorage between steps. */
export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Shipping address
  shipping_address: string;
  shipping_city: string;
  shipping_postcode: string;
  shipping_county: string;
  shipping_country: string;

  // Billing address (when different from shipping)
  billingSameAsShipping: boolean;
  address?: string;
  city?: string;
  postcode?: string;
  county?: string;
  country?: string;

  // Fulfillment
  fulfillmentMethod: "delivery" | "click_collect";
  selectedShippingOption: SelectedShippingOption | null;
  shippingOptionToken: string;

  // Notes
  notes?: string;
}

/** A shipping option selected during checkout. */
export interface SelectedShippingOption {
  service: string;
  rate: number;
  token: string;
  estimated_delivery_date?: string;
  estimated_delivery_window_start?: string;
  estimated_delivery_window_end?: string;
  parcel_summary?: {
    parcel_count: number;
    total_weight_kg: number;
  };
}

/** Line item sent in the order/payment-intent request body. */
export interface CheckoutLineItem {
  product_id: number;
  quantity: number;
  selected_variants: Record<string, unknown> | null;
}

/**
 * Minimal product shape accepted by `addToCart()`.
 * Callers may pass a full `Product`, a re-order item from `AccountIsland`,
 * or a hand-built object — all must satisfy at least these fields.
 */
export interface AddToCartProduct {
  price_on_request?: boolean;
  id: number | string;
  name: string;
  price: string | number;
  image: string;
  qty?: number;
  selected_variants?: Record<string, VariantSelection> | null;
  track_stock?: boolean;
  stock_quantity?: number | null;
  variants?: unknown[] | null;
  variant_mode?: string | null;
}
