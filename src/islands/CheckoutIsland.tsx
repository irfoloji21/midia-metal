/**
 * CheckoutIsland — React island for the Checkout page.
 * Used in src/pages/checkout.astro with client:load directive.
 *
 * Original: src/pages-react/CheckoutPage.tsx
 * Changes from original:
 *   - Removed Header, Footer, Seo, FloatingSidebar imports/JSX
 *   - Replaced useNavigate() with sessionStorage + window.location.href
 *   - Checkout form data is stored in sessionStorage('checkoutForm') before redirecting to /payment
 *   - Inline CheckoutSteps component (no react-router dependency)
 *   - Kept useCart, useCustomerAuth context hooks as-is
 */
import { useState, useEffect, useRef } from "react";
import { MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useStore } from "@nanostores/react";
import { $cart, $subtotal, $coupon, $isBusiness, setIsBusiness } from "@/stores/cart";
import { $customer } from "@/stores/auth";
import type { CheckoutFormData } from "@/types/cart";
import withErrorBoundary from "@/lib/withErrorBoundary";
import { formatMoneyValue, parseMoneyValue } from "@/lib/pricing";
import { getCheckoutErrors, normalizeCheckoutForm, type CheckoutErrors } from "@/lib/checkout-validation";
import { useCartAvailability } from '@/hooks/use-cart-availability';
import CartAvailabilityNotice from '@/components/CartAvailabilityNotice';

// Astro-compatible CheckoutSteps (inline, no react-router)
function CheckoutSteps({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const steps = [
    { id: 1, label: "Cart", path: "/cart" },
    { id: 2, label: "Deliver / Collect", path: "/checkout" },
    { id: 3, label: "Checkout", path: "/payment" },
    { id: 4, label: "Complete", path: null as string | null },
  ];

  return (
    <div className="mx-auto mb-8 max-w-5xl px-2 md:mb-14 md:px-4">
      <ol className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-6 md:gap-y-0">
        {steps.map((step, index) => {
          const isCurrent = currentStep === step.id;
          const isDone = currentStep > step.id;
          const canNavigate = Boolean(step.path) && !isCurrent;
          const circleClass =
            isCurrent || isDone
              ? "border-primary bg-primary text-white"
              : "border-[#c3cad9] bg-transparent text-primary";

          const content = (
            <>
              <span
                className={`grid h-12 w-12 place-items-center rounded-full border text-base font-semibold transition-colors ${circleClass}`}
              >
                {isDone ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  step.id
                )}
              </span>
              <span
                className={`mt-3 block text-[13px] leading-tight md:text-sm ${
                  isCurrent ? "font-bold text-primary" : "font-semibold text-[#4f5d79]"
                }`}
              >
                {step.label}
              </span>
            </>
          );

          return (
            <li key={step.id} className="relative">
              {canNavigate ? (
                <a href={step.path!} className="group block transition-opacity hover:opacity-85">
                  {content}
                </a>
              ) : (
                <div>{content}</div>
              )}
              {index < steps.length - 1 && (
                <span
                  className={`absolute left-14 top-6 hidden h-[2px] w-[calc(100%-3.5rem)] md:block ${
                    isDone ? "bg-primary" : "bg-[#c3cad9]"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type ShippingOption = {
  quote_token: string;
  provider: string;
  carrier: string;
  service: string;
  service_code?: string;
  rate: number;
  currency?: string;
  delivery_days?: number | null;
  estimated_delivery_date?: string | null;
  estimated_delivery_window_start?: string | null;
  estimated_delivery_window_end?: string | null;
  is_premium?: boolean;
  parcel_summary?: {
    parcel_count?: number;
    total_weight_kg?: number;
  } | null;
};

function CheckoutIsland() {
  const availability = useCartAvailability();
  const defaultForm: CheckoutFormData = {
    firstName: "",
    lastName: "",
    company: "",
    phone: "",
    email: "",
    notes: "",
    companyVat: "",
    fulfillmentMethod: "delivery",
    selectedShippingOption: null,
    shippingOptionToken: "",
    // Shipping (primary)
    shipping_address: "",
    shipping_city: "",
    shipping_postcode: "",
    shipping_county: "",
    shipping_country: "United Kingdom",
    // Billing (secondary — only needed when billingSameAsShipping = false)
    billingSameAsShipping: true,
    address: "",
    city: "",
    postcode: "",
    county: "",
    country: "United Kingdom",
  };

  const cart = useStore($cart);
  const subtotalRaw = useStore($subtotal);
  const coupon = useStore($coupon);
  const isBusiness = useStore($isBusiness);
  const customer = useStore($customer);
  
  // Hydration fix: defer cart-dependent rendering until client-side
  // Server renders empty cart, but localStorage may have items on client
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  const [form, setForm] = useState<CheckoutFormData>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(false);
  const [shippingOptionsError, setShippingOptionsError] = useState("");
  const hasRestoredCheckoutForm = useRef(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("checkoutForm");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Partial<CheckoutFormData>;
      setForm((prev) => ({
        ...prev,
        ...parsed,
        shipping_country: parsed.shipping_country || prev.shipping_country,
        country: parsed.country || prev.country,
        shippingOptionToken: parsed.shippingOptionToken || "",
      }));
      hasRestoredCheckoutForm.current = true;
      if (typeof parsed.isBusiness === 'boolean') setIsBusiness(parsed.isBusiness);
    } catch {
      sessionStorage.removeItem("checkoutForm");
    }
  }, []);

  useEffect(() => {
    if (customer && !hasRestoredCheckoutForm.current) {
      const parts = (customer.name || "").split(" ");
      const cust = customer as any;
      const billingAddress = cust.billing_address || cust.address || "";
      const billingCity = cust.billing_city || cust.city || "";
      const billingPostcode = cust.billing_postcode || cust.postcode || "";
      const billingCountry = cust.billing_country || cust.country || "United Kingdom";
      const shippingAddress = cust.shipping_address || billingAddress;
      const shippingCity = cust.shipping_city || billingCity;
      const shippingPostcode = cust.shipping_postcode || billingPostcode;
      const shippingCountry = cust.shipping_country || billingCountry;
      const billingSame = !cust.billing_address || (shippingAddress === billingAddress);

      setForm(prev => ({
        ...prev,
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        company: cust.company_name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        companyVat: cust.company_vat_number || "",
        shipping_address: shippingAddress,
        shipping_city: shippingCity,
        shipping_postcode: shippingPostcode,
        shipping_country: shippingCountry,
        billingSameAsShipping: billingSame,
        address: billingAddress,
        city: billingCity,
        postcode: billingPostcode,
        country: billingCountry,
      }));
      setIsBusiness(customer.is_business || false);
    }
  }, [customer, setIsBusiness]);

  const update = <K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) => {
    hasRestoredCheckoutForm.current = true;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
  };
  const validationProps = (field: keyof CheckoutFormData) => ({
    id: `checkout-${field}`,
    name: field,
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `error-${field}` : undefined,
  });
  const fieldError = (field: keyof CheckoutFormData) => fieldErrors[field]
    ? <p id={`error-${field}`} role="alert" className="mt-2 text-sm text-red-700">{fieldErrors[field]}</p>
    : null;
  const formatEtaDate = (value?: string | null) => {
    if (!value) return "Estimated date unavailable";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  const formatEtaWindow = (start?: string | null, end?: string | null) => {
    if (!start || !end) return "Time window provided by courier";

    const to12Hour = (time: string) => {
      const [hRaw, mRaw] = time.split(":");
      const h = Number(hRaw);
      const m = Number(mRaw || "0");
      if (Number.isNaN(h)) return time;
      const hour12 = h % 12 || 12;
      const suffix = h >= 12 ? "pm" : "am";
      return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
    };

    return `${to12Hour(start)} - ${to12Hour(end)}`;
  };

  useEffect(() => {
    if (form.fulfillmentMethod !== "delivery") {
      setShippingOptions([]);
      setShippingOptionsError("");
      setShippingOptionsLoading(false);
      setForm((prev) => ({ ...prev, shippingOptionToken: "" }));
      return undefined;
    }

    const hasAddress = form.shipping_address.trim() && form.shipping_city.trim() && form.shipping_postcode.trim() && form.shipping_country.trim();
    if (!hasAddress || cart.length === 0) {
      setShippingOptions([]);
      setShippingOptionsError("");
      setShippingOptionsLoading(false);
      setForm((prev) => ({ ...prev, shippingOptionToken: "" }));
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setShippingOptionsLoading(true);
      setShippingOptionsError("");

      try {
        const data = await apiFetch<{ options: ShippingOption[] }>("/v1/shipping/options", {
          method: "POST",
          body: JSON.stringify({
            fulfilment_method: "delivery",
            shipping_address_line1: form.shipping_address,
            shipping_city: form.shipping_city,
            shipping_postcode: form.shipping_postcode,
            shipping_county: form.shipping_county,
            shipping_country: form.shipping_country,
            items: cart.map((item) => ({
              product_id: Number(item.product_id),
              quantity: item.qty,
              selected_variants: item.selected_variants ?? null,
            })),
          }),
        });

        if (cancelled) return;

        const options: ShippingOption[] = Array.isArray(data?.options) ? data.options : [];
        setShippingOptions(options);
        setForm((prev) => {
          const keepToken = options.some((option) => option.quote_token === prev.shippingOptionToken);
          return { ...prev, shippingOptionToken: keepToken ? prev.shippingOptionToken : (options[0]?.quote_token || "") };
        });
      } catch (error: unknown) {
        if (cancelled) return;
        setShippingOptions([]);
        setForm((prev) => ({ ...prev, shippingOptionToken: "" }));
        setShippingOptionsError(error instanceof Error ? error.message : "Could not load delivery options.");
      } finally {
        if (!cancelled) setShippingOptionsLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.fulfillmentMethod, form.shipping_address, form.shipping_city, form.shipping_postcode, form.shipping_county, form.shipping_country, cart]);

  const selectedShippingOption = shippingOptions.find((option) => option.quote_token === form.shippingOptionToken) || null;
  const shippingForOrder = form.fulfillmentMethod === "click_collect" ? 0 : (selectedShippingOption?.rate ?? 0);
  const discountAmount = coupon?.discount ?? 0;
  const totalForOrder = cart.length > 0 ? Math.max(0, subtotalRaw + shippingForOrder - discountAmount) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeCheckoutForm(form);
    const errors = getCheckoutErrors(normalized, isBusiness);
    setFieldErrors(errors);
    setForm(normalized);
    if (Object.keys(errors).length) {
      (e.currentTarget as HTMLFormElement).querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)?.focus();
      return;
    }
    if (cart.length === 0) { toast.error("Your cart is empty"); return; }
    if (availability.blocked) return;
    if (form.fulfillmentMethod === "delivery" && !form.shippingOptionToken) {
      toast.error("Please choose a delivery option.");
      return;
    }
    setIsSubmitting(true);

    try {
      // Store checkout form in sessionStorage (replaces React Router state passing)
      sessionStorage.setItem(
        "checkoutForm",
        JSON.stringify({
          ...normalized,
          isBusiness,
          selectedShippingOption,
        })
      );
      window.location.href = "/payment";
    } catch (err: any) {
      toast.error(err?.message || "Unable to proceed to payment. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-24 pb-4 md:pb-6">
        <CheckoutSteps currentStep={2} />
        <CartAvailabilityNotice state={availability} />
      </section>

      <section className="container mx-auto px-4 lg:px-8 pb-20 md:pb-28">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-10 md:gap-12 items-start">
            <div className="space-y-8">

              {/* ── Contact ── */}
              <div>
                <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">Contact Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="checkout-firstName" className="block text-[13px] font-semibold text-primary mb-2">First Name *</label>
                    <input {...validationProps("firstName")} type="text" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("firstName")}
                  </div>
                  <div>
                    <label htmlFor="checkout-lastName" className="block text-[13px] font-semibold text-primary mb-2">Last Name *</label>
                    <input {...validationProps("lastName")} type="text" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("lastName")}
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-[13px] font-semibold text-primary mb-2">Phone *</label>
                    <input {...validationProps("phone")} type="tel" required value={form.phone} onChange={(e) => update("phone", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("phone")}
                  </div>
                  <div>
                    <label htmlFor="checkout-email" className="block text-[13px] font-semibold text-primary mb-2">Email Address *</label>
                    <input {...validationProps("email")} type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("email")}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <input type="checkbox" id="isBusiness" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} className="w-4 h-4 accent-orange cursor-pointer" />
                  <label htmlFor="isBusiness" className="text-[13px] font-semibold text-primary cursor-pointer">I am purchasing as a business</label>
                </div>

                {isBusiness && (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="checkout-company" className="block text-[13px] font-semibold text-primary mb-2">Company Name *</label>
                      <input {...validationProps("company")} type="text" required value={form.company} onChange={(e) => update("company", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("company")}
                    </div>
                    <div>
                      <label htmlFor="checkout-companyVat" className="block text-[13px] font-semibold text-primary mb-2">Company VAT Number (optional)</label>
                      <input {...validationProps("companyVat")} type="text" value={form.companyVat} onChange={(e) => update("companyVat", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("companyVat")}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Fulfilment Method ── */}
              <div className="border-t border-[#cad4e4] pt-8">
                <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">
                  Choose how to get your items
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    {
                      id: "delivery",
                      title: "Delivery",
                      description: "We'll deliver your entire order to your address.",
                      Icon: Truck,
                    },
                    {
                      id: "click_collect",
                      title: "Click & Collect",
                      description: "Collect your order from our workshop.",
                      Icon: MapPin,
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => update("fulfillmentMethod", option.id as CheckoutFormData["fulfillmentMethod"])}
                      className={`border p-6 md:p-7 text-left transition-colors ${
                        form.fulfillmentMethod === option.id
                          ? "border-primary bg-[#f4f7fb]"
                          : "border-[#cad4e4] bg-[#f0f3f7] hover:border-primary/60"
                      }`}
                    >
                      <option.Icon className={`w-10 h-10 mb-5 ${form.fulfillmentMethod === option.id ? "text-orange" : "text-primary"}`} />
                      <h3 className="font-sans text-[34px] leading-none font-semibold text-primary mb-3">{option.title}</h3>
                      <p className="text-[16px] text-[#6e7a92] leading-relaxed">{option.description}</p>
                      <span className="inline-block mt-6 text-[16px] font-semibold text-primary underline underline-offset-4">
                        {form.fulfillmentMethod === option.id ? "Selected" : "Choose"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Shipping Address ── */}
              <div className="border-t border-[#cad4e4] pt-8">
                <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">
                  {form.fulfillmentMethod === "click_collect" ? "Address Details" : "Shipping Address"}
                </h2>
                {form.fulfillmentMethod === "click_collect" && (
                  <p className="text-[14px] text-[#6e7a92] mb-5">
                    For click & collect, we still use this address for billing records and order verification.
                  </p>
                )}
                <div className="space-y-5">
                  <div>
                    <label htmlFor="shipping-country" className="block text-[13px] font-semibold text-primary mb-2">Country / Region</label>
                    <input id="shipping-country" type="text" disabled value="United Kingdom" className="w-full h-12 border border-[#cad4e4] bg-[#dfe5ea] px-4 text-[14px] outline-none text-[#6e7a92] cursor-not-allowed" />
                  </div>
                  <div>
                    <label htmlFor="checkout-shipping_address" className="block text-[13px] font-semibold text-primary mb-2">Street Address *</label>
                    <input {...validationProps("shipping_address")} type="text" required placeholder="House number and street name" value={form.shipping_address} onChange={(e) => update("shipping_address", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("shipping_address")}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label htmlFor="checkout-shipping_city" className="block text-[13px] font-semibold text-primary mb-2">Town / City *</label>
                      <input {...validationProps("shipping_city")} type="text" required value={form.shipping_city} onChange={(e) => update("shipping_city", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("shipping_city")}
                    </div>
                    <div>
                      <label htmlFor="checkout-shipping_county" className="block text-[13px] font-semibold text-primary mb-2">County</label>
                      <input {...validationProps("shipping_county")} type="text" value={form.shipping_county} onChange={(e) => update("shipping_county", e.target.value)} placeholder="e.g. Essex" className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("shipping_county")}
                    </div>
                    <div>
                      <label htmlFor="checkout-shipping_postcode" className="block text-[13px] font-semibold text-primary mb-2">Postcode *</label>
                      <input {...validationProps("shipping_postcode")} type="text" required value={form.shipping_postcode} onChange={(e) => update("shipping_postcode", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("shipping_postcode")}
                    </div>
                  </div>
                </div>
              </div>

              {form.fulfillmentMethod === "delivery" && (
                <div className="border-t border-[#cad4e4] pt-8">
                  <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">Delivery Options</h2>
                  <div className="border border-[#cad4e4] bg-[#f0f3f7] p-5 md:p-6 space-y-4">
                    <p className="text-[24px] font-semibold text-primary">Please choose a delivery option</p>

                    {shippingOptionsLoading && (
                      <div className="text-sm text-[#6e7a92]">Getting delivery rates and estimated delivery windows…</div>
                    )}

                    {!shippingOptionsLoading && shippingOptionsError && (
                      <div className="text-sm text-red-700">{shippingOptionsError}</div>
                    )}

                    {!shippingOptionsLoading && !shippingOptionsError && shippingOptions.length === 0 && (
                      <div className="text-sm text-[#6e7a92]">Enter your full shipping address to load delivery options.</div>
                    )}

                    <div className="space-y-3">
                      {shippingOptions.map((option) => (
                        <button
                          key={option.quote_token}
                          type="button"
                          onClick={() => update("shippingOptionToken", option.quote_token)}
                          className={`w-full border p-4 md:p-5 text-left transition-colors ${
                            form.shippingOptionToken === option.quote_token
                              ? "border-[#0f6fb6] bg-[#eaf4fb]"
                              : "border-[#cad4e4] bg-white hover:border-[#0f6fb6]/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                aria-label={`${option.service} by ${option.carrier}`}
                                checked={form.shippingOptionToken === option.quote_token}
                                onChange={() => update("shippingOptionToken", option.quote_token)}
                                className="mt-1 h-5 w-5 accent-[#0f6fb6]"
                              />
                              <div>
                                <p className="text-[18px] md:text-[22px] font-semibold text-primary">{option.service}</p>
                                <p className="text-sm text-[#6e7a92] mt-1">{option.carrier}</p>
                                {option.parcel_summary?.parcel_count && option.parcel_summary.parcel_count > 1 && (
                                  <p className="text-sm text-[#6e7a92] mt-1">
                                    {option.parcel_summary.parcel_count} parcels
                                    {typeof option.parcel_summary.total_weight_kg === "number"
                                      ? ` · ${option.parcel_summary.total_weight_kg.toFixed(2)}kg total`
                                      : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[24px] leading-none font-semibold text-primary">£{Number(option.rate || 0).toFixed(2)}</p>
                              {option.is_premium && (
                                <p className="text-xs text-[#6e7a92] mt-1 uppercase tracking-wider">Premium</p>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pl-8 md:pl-9 text-primary">
                            <p className="text-[17px] font-medium">Estimated delivery</p>
                            <p className="text-[18px] mt-1">{formatEtaDate(option.estimated_delivery_date)}</p>
                            <p className="text-[18px] mt-1">{formatEtaWindow(option.estimated_delivery_window_start, option.estimated_delivery_window_end)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Billing Same as Shipping checkbox ── */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="billingSame"
                  checked={form.billingSameAsShipping}
                  onChange={(e) => update("billingSameAsShipping", e.target.checked)}
                  className="w-4 h-4 accent-orange cursor-pointer"
                />
                <label htmlFor="billingSame" className="text-[13px] font-semibold text-primary cursor-pointer">
                  Billing address is same as shipping address
                </label>
              </div>

              {/* ── Billing Address (shown only when different) ── */}
              {!form.billingSameAsShipping && (
                <div className="border-t border-[#cad4e4] pt-8">
                  <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">Billing Address</h2>
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="billing-country" className="block text-[13px] font-semibold text-primary mb-2">Country / Region</label>
                      <input id="billing-country" type="text" disabled value="United Kingdom" className="w-full h-12 border border-[#cad4e4] bg-[#dfe5ea] px-4 text-[14px] outline-none text-[#6e7a92] cursor-not-allowed" />
                    </div>
                    <div>
                      <label htmlFor="checkout-address" className="block text-[13px] font-semibold text-primary mb-2">Street Address *</label>
                      <input {...validationProps("address")} type="text" required placeholder="House number and street name" value={form.address} onChange={(e) => update("address", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("address")}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label htmlFor="checkout-city" className="block text-[13px] font-semibold text-primary mb-2">Town / City *</label>
                        <input {...validationProps("city")} type="text" required value={form.city} onChange={(e) => update("city", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("city")}
                      </div>
                      <div>
                        <label htmlFor="checkout-county" className="block text-[13px] font-semibold text-primary mb-2">County</label>
                        <input {...validationProps("county")} type="text" value={form.county} onChange={(e) => update("county", e.target.value)} placeholder="e.g. Essex" className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("county")}
                      </div>
                      <div>
                        <label htmlFor="checkout-postcode" className="block text-[13px] font-semibold text-primary mb-2">Postcode *</label>
                        <input {...validationProps("postcode")} type="text" required value={form.postcode} onChange={(e) => update("postcode", e.target.value)} className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange" />
                    {fieldError("postcode")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Order Notes ── */}
              <div className="border border-[#cad4e4] bg-[#f0f3f7] p-6 md:p-8">
                <h3 className="font-sans text-[24px] md:text-[30px] leading-none font-semibold text-primary mb-5">Additional Information</h3>
                <label htmlFor="checkout-notes" className="block text-[13px] font-semibold text-primary mb-2">Order Notes (optional)</label>
                <textarea id="checkout-notes" rows={4} placeholder="Notes about your order, e.g. preferred delivery time or pickup details." value={form.notes} onChange={(e) => update("notes", e.target.value)} className="w-full border border-[#cad4e4] bg-[#eaf0f3] px-4 py-3 text-[14px] outline-none focus:border-orange resize-none" />
              </div>

            </div>


            <div>
              <h3 className="font-sans font-semibold text-[28px] md:text-[40px] leading-none text-primary mb-6">Your order</h3>
              {/* Use isHydrated to prevent SSR mismatch - server renders empty cart */}
              {(isHydrated && cart.length > 0) ? (
                <>
                  <div className="border border-[#cad4e4] overflow-hidden">
                    <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                      <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Product</span>
                      <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Subtotal</span>
                    </div>
                    <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                      {cart.map((item, idx) => (
                        <div key={idx} className="contents">
                          <div className="text-sm md:text-base text-primary p-4 md:p-6 border-b border-[#cad4e4]">
                            {item.name} x {item.qty}
                            {item.selected_variants && Object.entries(item.selected_variants).map(([opt, v]: [string, any]) => (
                              <div key={opt} className="text-[10px] text-orange font-bold uppercase tracking-tight mt-1">
                                {opt}: {v.value}
                              </div>
                            ))}
                          </div>
                          <span className="text-sm md:text-base text-primary p-4 md:p-6 border-b border-[#cad4e4]">{formatMoneyValue((parseMoneyValue(item.price) ?? 0) * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                      <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Subtotal</span>
                      <span className="text-sm md:text-base text-primary p-4 md:p-6">£{subtotalRaw.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    {isHydrated && coupon && (
                      <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                        <span className="font-semibold text-sm md:text-lg text-green-700 bg-[#f4f5f7] p-4 md:p-6">Discount ({coupon.code})</span>
                        <span className="text-sm md:text-base text-green-700 p-4 md:p-6">−£{coupon.discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                      <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Shipping</span>
                      <div className="text-sm md:text-base text-primary p-4 md:p-6">
                        {form.fulfillmentMethod === "click_collect" ? (
                          <p>Click & Collect: £0.00</p>
                        ) : (
                          <>
                            <p>{selectedShippingOption?.service || "Select a delivery option"}: £{shippingForOrder.toFixed(2)}</p>
                            {selectedShippingOption && (
                              <p className="mt-1 text-[#6e7a92]">
                                ETA: <strong className="text-primary">{formatEtaDate(selectedShippingOption.estimated_delivery_date)}</strong>
                                {" · "}
                                {formatEtaWindow(selectedShippingOption.estimated_delivery_window_start, selectedShippingOption.estimated_delivery_window_end)}
                                {selectedShippingOption.parcel_summary?.parcel_count && selectedShippingOption.parcel_summary.parcel_count > 1
                                  ? ` · ${selectedShippingOption.parcel_summary.parcel_count} parcels`
                                  : ""}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-[42%_58%]">
                      <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Total</span>
                      <span className="font-semibold text-base md:text-2xl text-primary p-4 md:p-6">£{(isHydrated ? totalForOrder : 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[12px] text-[#6e7a92]">All displayed prices include VAT.</p>
                </>
              ) : (
                <div className="border border-[#cad4e4] p-4 text-center">Your cart is empty.</div>
              )}

              <button
                type="submit"
                disabled={availability.blocked || isSubmitting || !isHydrated || cart.length === 0 || (form.fulfillmentMethod === "delivery" && !form.shippingOptionToken)}
                className="w-full mt-8 h-16 bg-orange text-white inline-flex items-center justify-center text-sm font-semibold hover:bg-orange-hover disabled:opacity-50 transition-colors"
                aria-label="Proceed to payment"
              >
                {isSubmitting ? "Processing..." : "Proceed to Payment"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </>
  );
}

export default withErrorBoundary(CheckoutIsland, "Checkout");
