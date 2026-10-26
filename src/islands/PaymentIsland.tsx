/**
 * PaymentIsland — React island for the Payment page.
 * Used in src/pages/payment.astro with client:load directive.
 *
 * Original: src/pages-react/PaymentPage.tsx
 * Changes from original:
 *   - Removed Header, Footer, Seo, FloatingSidebar imports/JSX
 *   - Replaced useLocation().state with sessionStorage('checkoutForm')
 *   - Replaced useNavigate() with sessionStorage('lastOrder') + window.location.href
 *   - Inline CheckoutSteps component (no react-router dependency)
 *   - Kept Stripe Elements, useCart, useCustomerAuth as-is
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { CreditCard, Building2, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useStore } from "@nanostores/react";
import { $cart, $subtotal, $coupon, $isBusiness, clearCart, setIsBusiness } from "@/stores/cart";
import { $customer, $isAuthLoading, $authError } from "@/stores/auth";
import CustomerSessionError from "@/components/CustomerSessionError";
import { formatMoneyValue, parseMoneyValue } from "@/lib/pricing";
import { getCheckoutErrors, normalizeCheckoutForm } from "@/lib/checkout-validation";
import { useCartAvailability } from '@/hooks/use-cart-availability';
import CartAvailabilityNotice from '@/components/CartAvailabilityNotice';

// Stripe
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = import.meta.env.PUBLIC_STRIPE_KEY ? loadStripe(import.meta.env.PUBLIC_STRIPE_KEY) : null;
import withErrorBoundary from "@/lib/withErrorBoundary";

interface PaymentSetup {
  client_secret: string;
  payment_intent_id: string;
  payment_token: string;
}
interface CheckoutSession {
  key: string;
  attempt: string;
  setup?: PaymentSetup;
  confirmed?: boolean;
}

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

// ─── Inner form (wrapped in <Elements>) ──────────────────────────────────────
interface StripeFormProps {
  totalFormatted: string;
  saveCard: boolean;
  setSaveCard: (val: boolean) => void;
  showSaveCheckbox: boolean;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onBusy: (busy: boolean) => void;
}

function StripeCardForm({ totalFormatted, saveCard, setSaveCard, showSaveCheckbox, onSuccess, onBusy }: StripeFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);

  useEffect(() => {
    if (elementReady) return undefined;
    const timeout = window.setTimeout(() => setElementError('Unable to load the secure card form. Please refresh the page.'), 25000);
    return () => window.clearTimeout(timeout);
  }, [elementReady]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !elementReady) return;
    setPaying(true);
    onBusy(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "/payment",
        },
        redirect: "if_required",
      });
      if (error) {
        toast.error(error.message || "Payment failed. Please try again.");
        setPaying(false);
        return;
      }
      if (paymentIntent && paymentIntent.status === "succeeded") {
        await onSuccess(paymentIntent.id);
      } else {
        toast.error("Payment has not completed. Please check your payment details.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Unexpected error. Please try again.");
    } finally {
      setPaying(false);
      onBusy(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <PaymentElement
        onReady={() => { setElementReady(true); setElementError(null); }}
        onLoadError={() => setElementError('Unable to load the secure card form. Please refresh the page.')}
        options={{
          layout: "tabs",
          fields: { billingDetails: { email: "auto" } },
          wallets: { link: "never" },
        }}
      />
      {!elementReady && <p role="status" className="text-sm text-[#6e7a92]">{elementError || 'Loading secure card form…'}</p>}
      {showSaveCheckbox && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            id="saveCard"
            disabled={paying}
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
            className="w-4 h-4 accent-orange cursor-pointer"
          />
          <label htmlFor="saveCard" className="text-[13px] font-semibold text-primary cursor-pointer">
            Save this card for future purchases
          </label>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || !elementReady || paying}
        className="w-full h-14 bg-orange text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-orange-hover transition-colors disabled:opacity-50"
      >
        <Lock className="w-4 h-4" />
        {paying ? "Processing Payment…" : `Pay ${totalFormatted} Securely`}
      </button>
      <p className="text-[11px] text-[#7f8aa2] text-center flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Secured by Stripe · Your card details are never stored on our servers
      </p>
    </form>
  );
}

// ─── Main PaymentIsland ─────────────────────────────────────────────────────────
function PaymentIsland() {
  const availability = useCartAvailability();
  // Read checkout form from sessionStorage (replaces React Router location.state)
  const [checkoutForm, setCheckoutForm] = useState<any>(null);

  const isAuthLoading = useStore($isAuthLoading);
  const authError = useStore($authError);
  const authReady = !isAuthLoading && !authError;

  useEffect(() => {
    const stored = sessionStorage.getItem("checkoutForm");
    if (stored) {
      try {
        const parsed = normalizeCheckoutForm(JSON.parse(stored));
        if (typeof parsed.isBusiness === 'boolean') setIsBusiness(parsed.isBusiness);
        if (Object.keys(getCheckoutErrors(parsed, $isBusiness.get())).length) throw new Error('Invalid checkout details');
        setCheckoutForm(parsed);
        const previous = JSON.parse(sessionStorage.getItem("stripeCheckout") || "null") as CheckoutSession | null;
        if (previous) {
          const [payload] = JSON.parse(previous.key);
          setMethod(payload.payment_method === "bank_transfer" ? "bank" : "card");
          setSaveCard(Boolean(payload.save_card));
        }
      } catch {
        // Invalid data, redirect back to checkout
        window.location.href = "/checkout";
      }
    } else {
      // No checkout data, redirect back
      window.location.href = "/checkout";
    }
  }, []);

  const cart = useStore($cart);
  const subtotalRaw = useStore($subtotal);
  const coupon = useStore($coupon);
  const isBusiness = useStore($isBusiness);
  const customer = useStore($customer);

  const [method, setMethod] = useState<"card" | "bank">("card");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("new");

  const paymentSession = useRef<CheckoutSession | null>(null);
  const [confirmedPayment, setConfirmedPayment] = useState<string | null>(null);

  const fulfilmentMethod = checkoutForm?.fulfillmentMethod === "click_collect" ? "click_collect" : "delivery";
  const selectedShippingOption = checkoutForm?.selectedShippingOption ?? null;
  const shippingOptionToken = checkoutForm?.shippingOptionToken ?? "";
  const shippingForOrder = fulfilmentMethod === "click_collect" ? 0 : Number(selectedShippingOption?.rate ?? 0);
  const discountAmount = coupon?.discount ?? 0;
  const totalForOrder = cart.length > 0 ? Math.max(0, subtotalRaw + shippingForOrder - discountAmount) : 0;
  const totalFormatted = `£${totalForOrder.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatEtaDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  useEffect(() => {
    if (customer) {
      apiFetch("/v1/customer/payment-methods")
        .then(data => {
          if (Array.isArray(data)) {
            setSavedCards(data);
            if (data.length > 0) {
              setSelectedCardId(data[0].stripe_payment_method_id);
            }
          }
        })
        .catch(() => { });
      return;
    }

    setSavedCards([]);
    setSelectedCardId("new");
  }, [customer]);

  const orderPayload = useMemo(() => {
    if (!checkoutForm) return null;
    const shippingAddress = `${checkoutForm.shipping_address}, ${checkoutForm.shipping_city}, ${checkoutForm.shipping_county ? checkoutForm.shipping_county + ', ' : ''}${checkoutForm.shipping_postcode}, ${checkoutForm.shipping_country}`;
    const billingAddress = checkoutForm.billingSameAsShipping
      ? `${checkoutForm.shipping_address}, ${checkoutForm.shipping_city}, ${checkoutForm.shipping_postcode}, ${checkoutForm.shipping_country}`
      : `${checkoutForm.address}, ${checkoutForm.city}, ${checkoutForm.postcode}, ${checkoutForm.country}`;
    return {
      customer_name: `${checkoutForm.firstName} ${checkoutForm.lastName}`,
      customer_email: checkoutForm.email,
      customer_phone: checkoutForm.phone,
      shipping_address: shippingAddress,
      shipping_address_line1: checkoutForm.shipping_address,
      shipping_city: checkoutForm.shipping_city,
      shipping_postcode: checkoutForm.shipping_postcode,
      shipping_county: checkoutForm.shipping_county || null,
      shipping_country: checkoutForm.shipping_country,
      billing_address: billingAddress,
      billing_address_line1: checkoutForm.billingSameAsShipping ? checkoutForm.shipping_address : checkoutForm.address,
      billing_city: checkoutForm.billingSameAsShipping ? checkoutForm.shipping_city : checkoutForm.city,
      billing_postcode: checkoutForm.billingSameAsShipping ? checkoutForm.shipping_postcode : checkoutForm.postcode,
      billing_county: checkoutForm.billingSameAsShipping ? (checkoutForm.shipping_county || null) : (checkoutForm.county || null),
      billing_country: checkoutForm.billingSameAsShipping ? checkoutForm.shipping_country : checkoutForm.country,
      notes: checkoutForm.notes,
      coupon_code: coupon?.code ?? null,
      fulfilment_method: fulfilmentMethod,
      shipping_option_token: shippingOptionToken || null,
      is_business: isBusiness,
      company_name: checkoutForm.company,
      company_vat_number: checkoutForm.companyVat,
      save_card: method === "card" && !!customer && saveCard,
      items: cart.map(item => ({ product_id: Number(item.product_id), quantity: item.qty, selected_variants: item.selected_variants ?? null })),
      payment_method: method === "card" ? "card" : "bank_transfer",
    };
  }, [checkoutForm, coupon?.code, fulfilmentMethod, shippingOptionToken, isBusiness, cart, method, customer?.id, saveCard]);
  const sessionKey = JSON.stringify([orderPayload, customer?.id ?? null]);

  const getPaymentSetup = async (): Promise<PaymentSetup> => {
    if (!orderPayload) throw new Error("Missing checkout details.");
    let session = paymentSession.current;
    if (!session || session.key !== sessionKey) {
      try { session = JSON.parse(sessionStorage.getItem("stripeCheckout") || "null"); } catch { session = null; }
      if (!session || session.key !== sessionKey) session = { key: sessionKey, attempt: crypto.randomUUID() };
      paymentSession.current = session;
    }
    // Keep the attempt ID even if the API response is lost; Stripe reuses the same intent.
    sessionStorage.setItem("stripeCheckout", JSON.stringify(session));
    if (!session.setup) {
      session.setup = await apiFetch<PaymentSetup>("/v1/payment/intent", {
        method: "POST", body: JSON.stringify({ ...orderPayload, payment_attempt_id: session.attempt }),
      });
      if (paymentSession.current === session) sessionStorage.setItem("stripeCheckout", JSON.stringify(session));
    }
    return session.setup;
  };

  useEffect(() => {
    if (!authReady || !orderPayload) return undefined;
    try {
      const saved = JSON.parse(sessionStorage.getItem("stripeCheckout") || "null") as CheckoutSession | null;
      if (saved?.key === sessionKey && saved.confirmed && saved.setup) {
        paymentSession.current = saved;
        setConfirmedPayment(saved.setup.payment_intent_id);
        return undefined;
      }
    } catch { /* An incomplete stored session is replaced on the next attempt. */ }
    if (availability.blocked) { setClientSecret(null); return undefined; }
    setConfirmedPayment(null);
    if (method !== "card" || totalForOrder <= 0 || (fulfilmentMethod === "delivery" && !shippingOptionToken)) {
      setClientSecret(null); return undefined;
    }
    let cancelled = false;
    setLoadingIntent(true);
    setPaymentError('');
    setClientSecret(null);
    getPaymentSetup().then(async (setup) => {
      if (cancelled) return;
      setClientSecret(setup.client_secret);
      const result = await apiFetch<{ status: string }>("/v1/payment/status", {
        method: "POST", body: JSON.stringify({ ...orderPayload, stripe_payment_intent_id: setup.payment_intent_id, payment_token: setup.payment_token }),
      });
      if (!cancelled && result.status === "succeeded") setConfirmedPayment(setup.payment_intent_id);
      if (new URLSearchParams(window.location.search).has("payment_intent_client_secret")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setClientSecret(null);
        setPaymentError(error instanceof Error ? error.message : 'Unable to initialise payment. Please try again.');
        toast.error(error instanceof Error ? error.message : "Unable to initialise payment.");
      }
    }).finally(() => { if (!cancelled) setLoadingIntent(false); });
    return () => { cancelled = true; };
  }, [sessionKey, authReady, availability.blocked]);

  const createOrder = async (paymentIntentId: string) => {
    const session = paymentSession.current;
    if (!orderPayload || !session?.setup || session.key !== sessionKey || session.setup.payment_intent_id !== paymentIntentId) {
      throw new Error("Your payment session has changed. Please reload this page.");
    }
    session.confirmed = true;
    sessionStorage.setItem("stripeCheckout", JSON.stringify(session));
    setConfirmedPayment(paymentIntentId);
    setIsSubmitting(true);
    try {
      const order = await apiFetch<{ confirmation: { order: string; token: string } }>("/v1/orders", {
        method: "POST",
        body: JSON.stringify({ ...orderPayload, stripe_payment_intent_id: paymentIntentId, payment_token: session.setup.payment_token }),
      });
      sessionStorage.setItem("orderConfirmation", JSON.stringify(order.confirmation));
      sessionStorage.removeItem("stripeCheckout");
      sessionStorage.removeItem("checkoutForm");
      sessionStorage.removeItem("lastOrder");
      clearCart();
      const target = new URL("/thank-you", window.location.origin);
      target.searchParams.set("order", order.confirmation.order);
      target.searchParams.set("token", order.confirmation.token);
      window.location.href = target.toString();
    } finally { setIsSubmitting(false); }
  };

  const handleNonCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const setup = await getPaymentSetup();
      await createOrder(setup.payment_intent_id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to place your order. Please try again.");
    } finally { setIsSubmitting(false); }
  };

  const stripeOptions = clientSecret
    ? {
      clientSecret,
      appearance: {
        theme: "flat" as const,
        variables: {
          colorPrimary: "#e85c0d",
          colorBackground: "#eaf0f3",
          colorText: "#10275c",
          borderRadius: "0px",
          fontFamily: "Inter, sans-serif",
        },
        rules: {
          ".Input": { border: "1px solid #cad4e4", padding: "12px 16px", fontSize: "14px" },
          ".Input:focus": { borderColor: "#e85c0d", boxShadow: "none" },
          ".Label": { fontSize: "13px", fontWeight: "600", color: "#10275c" },
        },
      },
    }
    : undefined;

  if (authError) return <section className="container mx-auto px-4 py-20"><CustomerSessionError /></section>;

  // Show loading while reading checkout data from sessionStorage
  if (!checkoutForm || isAuthLoading) {
    return (
      <section className="container mx-auto px-4 lg:px-8 py-20 text-center">
        <p className="text-[#6e7a92]">Loading payment details...</p>
      </section>
    );
  }

  return (
    <>
      <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-24 pb-4 md:pb-6">
        <CheckoutSteps currentStep={3} />
      </section>

      <section className="container mx-auto px-4 lg:px-8 pb-20 md:pb-28">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-10 md:gap-12 items-start">
          {/* LEFT: Payment method selector + card form */}
          <div>
            <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">Payment Method</h2>

            {/* Method selector */}
            <div className="space-y-4 mb-8">
              {[
                { id: "card" as const, icon: CreditCard, label: "Credit / Debit Card", desc: "Pay securely with Stripe — Visa, Mastercard, Amex and more." },
                { id: "bank" as const, icon: Building2, label: "Bank Transfer", desc: "Pay in GBP using the bank details and payment reference provided by Stripe." },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-4 p-5 border cursor-pointer transition-colors ${method === m.id ? "border-orange bg-[#fff3e9]" : "border-[#cad4e4] bg-[#f0f3f7] hover:border-orange/60"}`}
                >
                  <input type="radio" name="payment" disabled={isSubmitting || !!confirmedPayment} checked={method === m.id} onChange={() => { setPaymentError(''); setMethod(m.id); }} className="accent-orange mt-1" />
                  <m.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[16px] font-semibold text-primary leading-none">{m.label}</p>
                    <p className="text-[13px] text-[#7f8aa2] mt-2">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {confirmedPayment && (
              <div className="mb-6 border border-[#cad4e4] bg-white p-6" role="status">
                <p className="text-sm text-primary mb-4">Your payment session is ready. Complete your order confirmation below.</p>
                <button type="button" disabled={isSubmitting} onClick={() => createOrder(confirmedPayment).catch((error) => toast.error(error.message))} className="bg-orange px-6 py-3 text-white disabled:opacity-50">
                  {isSubmitting ? "Confirming order…" : "Complete order confirmation"}
                </button>
              </div>
            )}
            {/* Card: Stripe Elements */}
            {!confirmedPayment && <CartAvailabilityNotice state={availability} />}
            {paymentError && <p role="alert" className="mb-4 text-sm text-red-700">{paymentError}</p>}
            {method === "card" && !confirmedPayment && !availability.blocked && (
              <div className="border border-[#cad4e4] bg-[#f0f3f7] p-6 md:p-8">
                <h3 className="font-sans text-[24px] md:text-[30px] leading-none font-semibold text-primary mb-6 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-orange" /> Card Details
                </h3>

                {savedCards.length > 0 && (
                  <div className="mb-6 space-y-3">
                    {savedCards.map(card => (
                      <label key={card.id} className={`flex items-center gap-3 p-4 border cursor-pointer transition-colors bg-white ${selectedCardId === card.stripe_payment_method_id ? "border-orange ring-1 ring-orange/50" : "border-[#cad4e4] hover:border-orange/60"}`}>
                        <input type="radio" name="savedCard" disabled={isSubmitting} checked={selectedCardId === card.stripe_payment_method_id} onChange={() => setSelectedCardId(card.stripe_payment_method_id)} className="accent-orange" />
                        <div className="flex-1">
                          <p className="font-semibold text-primary text-sm">•••• •••• •••• {card.last4}</p>
                          <p className="text-[#6e7a92] text-xs">Expires {card.exp_month}/{card.exp_year}</p>
                        </div>
                        <div className="w-10 h-6 bg-[#f4f7f9] border border-[#cad4e4] rounded flex items-center justify-center font-bold text-primary text-[10px] uppercase">
                          {card.brand}
                        </div>
                      </label>
                    ))}
                    <label className={`flex items-center gap-3 p-4 border cursor-pointer transition-colors bg-white ${selectedCardId === "new" ? "border-orange ring-1 ring-orange/50" : "border-[#cad4e4] hover:border-orange/60"}`}>
                      <input type="radio" name="savedCard" disabled={isSubmitting} checked={selectedCardId === "new"} onChange={() => setSelectedCardId("new")} className="accent-orange" />
                      <div className="w-10 h-6 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-semibold text-primary text-sm">Add a new card</span>
                    </label>
                  </div>
                )}

                {selectedCardId === "new" ? (
                  loadingIntent ? (
                    <div className="text-center py-8 text-[#6e7a92]">
                      <div className="w-6 h-6 border-2 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      Initialising secure payment…
                    </div>
                  ) : clientSecret && stripeOptions ? (
                    <Elements key={clientSecret} stripe={stripePromise} options={stripeOptions}>
                      <StripeCardForm
                        totalFormatted={totalFormatted}
                        saveCard={saveCard}
                        setSaveCard={setSaveCard}
                        showSaveCheckbox={!!customer}
                        onSuccess={(id) => createOrder(id)}
                        onBusy={setIsSubmitting}
                      />
                    </Elements>
                  ) : fulfilmentMethod === "delivery" && !shippingOptionToken ? (
                    <p className="text-[#6e7a92] text-sm">Please return to checkout and select a delivery option.</p>
                  ) : (
                    <p className="text-[#6e7a92] text-sm">Unable to load payment form. Please refresh the page.</p>
                  )
                ) : (
                  <button
                    onClick={async () => {
                      if (!clientSecret) return;
                      setIsSubmitting(true);
                      try {
                        const stripe = await stripePromise;
                        if (!stripe) throw new Error("Stripe not loaded");
                        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                          payment_method: selectedCardId
                        });
                        if (error) {
                          toast.error(error.message || "Payment failed");
                        } else if (paymentIntent && paymentIntent.status === "succeeded") {
                          await createOrder(paymentIntent.id);
                        } else {
                          toast.error("Payment was not successful. Please try again.");
                        }
                      } catch (err: any) {
                        toast.error(err.message || "An error occurred");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting || !clientSecret}
                    className="w-full h-14 bg-orange text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-orange-hover transition-colors disabled:opacity-50 mt-4"
                  >
                    <Lock className="w-4 h-4" />
                    {isSubmitting ? "Processing Payment…" : `Pay ${totalFormatted} Securely`}
                  </button>
                )}
              </div>
            )}

            {method === "bank" && !confirmedPayment && !availability.blocked && (
              <form onSubmit={handleNonCardSubmit}>
                <div className="border border-[#cad4e4] bg-[#f0f3f7] p-6 mb-6">
                  <h3 className="font-semibold text-primary mb-3">Bank Transfer via Stripe</h3>
                  <p className="text-sm text-[#6e7a92]">Place your order to receive bank details and a payment reference. Use these details to make the transfer from your bank.</p>
                  <p className="text-sm text-[#6e7a92] mt-3">Your order will await payment until Stripe confirms receipt of the full amount.</p>
                </div>
                <button type="submit" disabled={isSubmitting || !authReady || cart.length === 0 || (fulfilmentMethod === "delivery" && !shippingOptionToken)} className="w-full h-14 bg-orange text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-orange-hover transition-colors disabled:opacity-50">
                  {isSubmitting ? "Preparing Transfer Details…" : "Place Order & Get Transfer Details"}
                </button>
              </form>
            )}
          </div>

          {/* RIGHT: Order summary */}
          <div>
            <h3 className="font-sans font-semibold text-[28px] md:text-[40px] leading-none text-primary mb-6">Order totals</h3>
            <div className="border border-[#cad4e4] overflow-hidden">
              <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Product</span>
                <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Subtotal</span>
              </div>
              {cart.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                  <div className="text-sm md:text-base text-primary p-4 md:p-6">
                    {item.name} x {item.qty}
                    {item.selected_variants && Object.entries(item.selected_variants).map(([opt, v]: [string, any]) => (
                      <div key={opt} className="text-[10px] text-orange font-bold uppercase tracking-tight mt-1">
                        {opt}: {v.value}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm md:text-base text-primary p-4 md:p-6">{formatMoneyValue((parseMoneyValue(item.price) ?? 0) * item.qty)}</span>
                </div>
              ))}
              <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Subtotal</span>
                <span className="text-sm md:text-base text-primary p-4 md:p-6">£{subtotalRaw.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Shipping</span>
                <div className="text-sm md:text-base text-primary p-4 md:p-6">
                  {fulfilmentMethod === "click_collect" ? (
                    <span>Click & Collect: £0.00</span>
                  ) : (
                    <>
                      <p>{selectedShippingOption?.service || "Delivery"}: £{shippingForOrder.toFixed(2)}</p>
                      {selectedShippingOption?.estimated_delivery_date && (
                        <p className="mt-1 text-[#6e7a92]">
                          ETA: {formatEtaDate(selectedShippingOption.estimated_delivery_date)}
                          {selectedShippingOption?.parcel_summary?.parcel_count > 1
                            ? ` · ${selectedShippingOption.parcel_summary.parcel_count} parcels`
                            : ""}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              {coupon && (
                <div className="grid grid-cols-[42%_58%] border-b border-[#cad4e4]">
                  <span className="font-semibold text-sm md:text-lg text-green-700 bg-[#f4f5f7] p-4 md:p-6">Discount ({coupon.code})</span>
                  <span className="text-sm md:text-base text-green-700 p-4 md:p-6">−£{coupon.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="grid grid-cols-[42%_58%]">
                <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Total</span>
                <span className="font-semibold text-base md:text-2xl text-primary p-4 md:p-6">{totalFormatted}</span>
              </div>
            </div>

            <p className="mt-3 text-[12px] text-[#6e7a92]">All displayed prices include VAT.</p>

            <p className="text-[12px] text-[#7f8aa2] mt-6">
              Your personal data will be used to process your order in accordance with our privacy policy.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default withErrorBoundary(PaymentIsland, "Payment");
