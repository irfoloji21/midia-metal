// ---------------------------------------------------------------------------
// Customer domain types — canonical source for the frontend
// Matches backend: Customer model, CustomerPaymentMethod model
// ---------------------------------------------------------------------------

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;

  // Default address
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;

  // Billing address
  billing_address: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  billing_country: string | null;

  // Shipping address
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postcode: string | null;
  shipping_country: string | null;

  // Stripe
  stripe_customer_id: string | null;

  created_at?: string;
  updated_at?: string;
}

/** Saved payment method (Stripe card). */
export interface SavedCard {
  id: string;
  stripe_payment_method_id: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  brand: string;
}

/** Bank transfer details fetched from site settings. */
export interface BankDetails {
  account_name: string;
  sort_code: string;
  account_number: string;
}
