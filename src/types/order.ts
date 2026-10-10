// ---------------------------------------------------------------------------
// Order domain types — canonical source for the frontend
// Matches backend: Order model, OrderItem model, ContactMessage (customer requests)
// ---------------------------------------------------------------------------

/** Order lifecycle status. */
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "ready_for_collection" | "collected" | "cancelled";

/** Payment lifecycle status. */
export type PaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "refund_pending"
  | "manual_refund_pending"
  | "failed"
  | "refund_failed"
  | "partially_refunded";

/** How the customer chose to receive the order. */
export type FulfilmentMethod = "delivery" | "click_collect";

/** Payment method the customer selected at checkout. */
export type PaymentMethod = "Credit / Debit Card" | "Direct Bank Transfer";

// -- Shipping metadata -------------------------------------------------------

export interface ParcelSummary {
  parcel_count: number;
  total_weight_kg: number;
}

export interface SelectedDeliveryOption {
  service: string;
  rate: number;
  estimated_delivery_date: string;
  estimated_delivery_window_start?: string;
  estimated_delivery_window_end?: string;
  parcel_summary?: ParcelSummary;
}

export interface ShippingMetadata {
  fulfillment_method?: FulfilmentMethod;
  /** Backend sometimes uses UK spelling. */
  fulfilment_method?: FulfilmentMethod;
  mode?: "mock" | "live";
  selected_delivery_option?: SelectedDeliveryOption;
  tracking_detail?: string;
}

// -- Address -----------------------------------------------------------------

export interface Address {
  line1: string | null;
  line2?: string | null;
  city: string | null;
  postcode: string | null;
  county: string | null;
  country: string;
}

// -- Order Item --------------------------------------------------------------

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  /** Stored as formatted string, e.g. "£150.00". */
  product_price: string;
  quantity: number;
  variant_details: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

// -- Customer Request (cancel / refund) --------------------------------------

export type CustomerRequestType = "cancel" | "cancel_refund";
export type CustomerRequestStatus = "pending" | "approved" | "rejected";

export interface CustomerRequest {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message_type: "order_request";
  request_type: CustomerRequestType;
  request_status: CustomerRequestStatus;
  reason: string;
  details: string;
  message: string;
  subject: string;
  order_id: number;
  read: boolean;
  created_at: string;
}

// -- Order -------------------------------------------------------------------

export interface Order {
  id: number;
  order_number: string;

  // Customer info
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_id: number | null;

  // Shipping address
  shipping_address: string;
  shipping_address_line1: string | null;
  shipping_address_line2?: string | null;
  shipping_city: string | null;
  shipping_postcode: string | null;
  shipping_county: string | null;
  shipping_country: string;

  // Billing address
  billing_address: string;
  billing_address_line1: string | null;
  billing_address_line2?: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  billing_county: string | null;
  billing_country: string | null;

  // Status
  status: OrderStatus;
  payment_method: string;
  payment_status: PaymentStatus;

  // Financials
  subtotal: number;
  shipping: number;
  total: number;
  discount_amount: number;
  tax_amount: number;
  coupon_code: string | null;

  // Stripe
  stripe_payment_intent_id: string | null;
  stripe_receipt_url: string | null;

  // Shipping / tracking
  tracking_number: string | null;
  shipping_provider: string | null;
  shipping_carrier: string | null;
  shipping_service: string | null;
  shipping_status: string | null;
  shipping_shipment_id: string | null;
  shipping_label_url: string | null;
  shipping_tracking_url: string | null;
  shipping_metadata: ShippingMetadata | null;

  // Business
  is_business: boolean;
  company_name: string | null;
  company_vat_number: string | null;

  // Notes
  notes: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Relationships (included when eager-loaded)
  items?: OrderItem[];
  customer_requests?: CustomerRequest[];

  // Aggregates (appended by admin endpoints)
  customer_requests_count?: number;
  unread_customer_requests_count?: number;
}

/** Minimal shape returned after placing an order. */
export interface OrderPlacedResponse {
  message: string;
  order_number: string;
}
