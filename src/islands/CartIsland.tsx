/**
 * CartIsland — React island for the Cart page.
 * Used in src/pages/cart.astro with client:load directive.
 *
 * This is the REFERENCE INTERACTIVE ISLAND conversion.
 * Pattern: React component using nanostores instead of React context.
 *
 * Original: src/pages-react/CartPage.tsx
 * Changes from original:
 *   - Removed Header, Footer, Seo, FloatingSidebar imports
 *   - Replaced useCart() context with nanostores ($cart, $subtotal, etc.)
 *   - Replaced <Link to="..."> with <a href="...">
 *   - Standalone component (no react-router dependency)
 *   - Added isHydrated to prevent SSR mismatch with localStorage cart
 */
import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { X, Minus, Plus, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import {
  $cart,
  $subtotal,
  $coupon,
  $total,
  $couponState,
  removeFromCart,
  updateQuantity,
  applyCoupon,
  removeCoupon,
} from '@/stores/cart';
import withErrorBoundary from '@/lib/withErrorBoundary';
import { normalizeMediaUrl } from '@/lib/media';
import { useCartAvailability } from '@/hooks/use-cart-availability';
import CartAvailabilityNotice from '@/components/CartAvailabilityNotice';
import { useCartCoupon } from '@/hooks/use-cart-coupon';
import CartCouponNotice from '@/components/CartCouponNotice';

// Astro-compatible CheckoutSteps (inline, no react-router)
function CheckoutSteps({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const steps = [
    { id: 1, label: 'Cart', path: '/cart' },
    { id: 2, label: 'Deliver / Collect', path: '/checkout' },
    { id: 3, label: 'Checkout', path: '/payment' },
    { id: 4, label: 'Complete', path: null as string | null },
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
              ? 'border-primary bg-primary text-white'
              : 'border-[#c3cad9] bg-transparent text-primary';

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
                  isCurrent ? 'font-bold text-primary' : 'font-semibold text-[#4f5d79]'
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
                    isDone ? 'bg-primary' : 'bg-[#c3cad9]'
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

function CartIsland() {
  const availability = useCartAvailability();
  const couponState = useCartCoupon();
  const cart = useStore($cart);
  const subtotal = useStore($subtotal);
  const coupon = useStore($coupon);
  const total = useStore($total);

  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  
  // Hydration fix: defer cart rendering until client-side to avoid SSR mismatch
  // Server renders empty cart, but localStorage may have items on client
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    await applyCoupon(couponInput);
    setApplyingCoupon(false);
  };

  return (
    <>
      <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-24 pb-4 md:pb-6">
        <CheckoutSteps currentStep={1} />
        <CartAvailabilityNotice state={availability} />
        {isHydrated && <CartCouponNotice state={couponState} />}
      </section>

      <section className="container mx-auto px-4 lg:px-8 pb-20 md:pb-28">
        {/* Mobile cart cards - use isHydrated to prevent SSR mismatch */}
        <div className="space-y-4 md:hidden mb-10">
          {(isHydrated ? cart : []).map((item) => (
            <div key={item.id} className="border border-[#cad4e4] bg-[#f0f3f7] p-4">
              <div className="flex items-start gap-3">
                <img src={normalizeMediaUrl(item.image, '/logo.png')} alt={item.name} className="w-16 h-16 object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary leading-snug">{item.name}</p>
                  {item.available_stock !== null && item.available_stock !== undefined && (
                    <p className="text-[10px] text-[#6e7a92] mt-1 font-semibold uppercase tracking-wide">
                      Stock: {item.available_stock}
                    </p>
                  )}
                  {item.selected_variants &&
                    Object.entries(item.selected_variants).map(([opt, v]: [string, any]) => (
                      <p key={opt} className="text-[10px] text-orange mt-0.5 font-bold uppercase tracking-tight">
                        {opt}: {v.value}
                      </p>
                    ))}
                  <p className="text-xs text-muted-foreground mt-1">
                    £{parseFloat(item.price.toString().replace(/[£,]/g, '')).toFixed(2)} each
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center border border-[#cad4e4] h-10">
                  <button aria-label={`Decrease quantity of ${item.name}`} onClick={() => updateQuantity(item.id, item.qty - 1)} className="px-2.5 py-1.5 text-primary">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-4 text-sm font-medium text-primary">{item.qty}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.qty + 1)}
                    disabled={
                      item.available_stock !== null &&
                      item.available_stock !== undefined &&
                      item.qty >= item.available_stock
                    }
                    className="px-2.5 py-1.5 text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-semibold text-primary">
                    £{(parseFloat(item.price.toString().replace(/[£,]/g, '')) * item.qty).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table - use isHydrated to prevent SSR mismatch */}
        <div className="hidden md:block mb-10">
          <div className="grid grid-cols-5 gap-6 px-6 py-5 bg-[#f4f5f7] text-sm md:text-base leading-none font-semibold text-primary">
            <span>Product</span>
            <span>Price</span>
            <span>Quantity</span>
            <span>Subtotal</span>
            <span>Remove</span>
          </div>
          {(!isHydrated || cart.length === 0) ? (
            <div className="px-6 py-12 border-b border-[#cad4e4] text-[24px] text-muted-foreground">Your cart is empty.</div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="grid grid-cols-5 gap-6 px-6 py-8 items-center border-b border-[#cad4e4]">
                <div className="flex items-center gap-5 min-w-0">
                  <img src={normalizeMediaUrl(item.image, '/logo.png')} alt={item.name} className="w-20 h-20 object-cover flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-base md:text-xl leading-tight font-semibold text-primary truncate">
                      {item.name}
                    </span>
                    {item.available_stock !== null && item.available_stock !== undefined && (
                      <span className="text-[10px] text-[#6e7a92] mt-1 font-semibold uppercase tracking-wide">
                        Stock: {item.available_stock}
                      </span>
                    )}
                    {item.selected_variants &&
                      Object.entries(item.selected_variants).map(([opt, v]: [string, any]) => (
                        <span key={opt} className="text-xs text-orange font-bold uppercase tracking-widest mt-1 block">
                          {opt}: {v.value}
                        </span>
                      ))}
                  </div>
                </div>
                <span className="text-lg md:text-xl leading-none text-primary">
                  £{parseFloat(item.price.toString().replace(/[£,]/g, '')).toFixed(2)}
                </span>
                <div className="w-[124px] h-[56px] border border-[#cad4e4] flex items-center px-5 bg-[#eaf0f3]">
                  <span className="text-base md:text-lg leading-none text-primary">{item.qty}</span>
                  <div className="ml-auto flex flex-col">
                    <button
                      onClick={() => updateQuantity(item.id, item.qty + 1)}
                      disabled={
                        item.available_stock !== null &&
                        item.available_stock !== undefined &&
                        item.qty >= item.available_stock
                      }
                      className="text-[#8c99b2] hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => updateQuantity(item.id, item.qty - 1)}
                      className="text-[#8c99b2] hover:text-primary"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <span className="text-lg md:text-xl leading-none font-semibold text-primary">
                  £{(parseFloat(item.price.toString().replace(/[£,]/g, '')) * item.qty).toFixed(2)}
                </span>
                <button aria-label={`Remove ${item.name}`} onClick={() => removeFromCart(item.id)} className="text-[#8f9ab1] hover:text-destructive w-fit">
                  <X className="w-6 h-6" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="hidden md:block border-t border-[#cad4e4] mb-14" />

        {/* Coupon Row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-14 md:mb-20">
          <div className="w-full md:w-[530px] h-14 border border-[#cad4e4] flex items-center bg-[#eaf0f3]">
            <div className="flex items-center gap-2 pl-5 pr-3 flex-1 min-w-0">
              <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {isHydrated && coupon ? (
                <span className="text-sm font-semibold text-green-700">
                  {coupon.code}{couponState.status === 'valid' ? ` — ${coupon.message}` : ''}
                </span>
              ) : (
                <input
                  type="text"
                  placeholder="Coupon Code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  className="bg-transparent text-sm outline-none w-full min-w-0 placeholder:text-[#8f9bb2]"
                />
              )}
            </div>
            {isHydrated && coupon ? (
              <button
                onClick={removeCoupon}
                className="h-full px-6 border-l border-[#cad4e4] text-red-500 text-sm font-semibold hover:bg-[#f5f7fa] transition-colors"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={handleApplyCoupon}
                disabled={applyingCoupon}
                className="h-full px-6 border-l border-[#cad4e4] text-primary text-sm font-semibold hover:bg-[#f5f7fa] transition-colors disabled:opacity-50"
              >
                {applyingCoupon ? 'Applying...' : 'Apply Coupon'}
              </button>
            )}
          </div>
        </div>

        {/* Cart Totals - use isHydrated to show correct values */}
        <div className="w-full max-w-[640px] ml-auto">
          <h3 className="font-sans font-semibold text-[28px] md:text-[40px] leading-none text-primary mb-6">Cart totals</h3>
          <div className="border border-[#cad4e4] overflow-hidden">
            <div className="grid grid-cols-[38%_62%] border-b border-[#cad4e4]">
              <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Subtotal</span>
              <span className="text-sm md:text-lg text-primary p-4 md:p-6">£{(isHydrated ? subtotal : 0).toFixed(2)}</span>
            </div>

            {isHydrated && coupon && (
              <div className="grid grid-cols-[38%_62%] border-b border-[#cad4e4]">
                <span className="font-semibold text-sm md:text-lg text-green-700 bg-[#f4f5f7] p-4 md:p-6">
                  Discount ({coupon.code})
                </span>
                <span className="text-sm md:text-lg text-green-700 p-4 md:p-6">
                  {couponState.blocked ? 'Awaiting coupon check' : `−£${couponState.discount.toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-[38%_62%] border-b border-[#cad4e4]">
              <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Shipping</span>
              <div className="text-sm md:text-lg text-primary p-4 md:p-6">
                <p>Calculated at checkout</p>
                <p className="mt-1 text-xs md:text-sm text-[#6e7a92]">
                  Live EasyPost delivery options appear after you enter your address.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[38%_62%]">
              <span className="font-semibold text-sm md:text-lg text-primary bg-[#f4f5f7] p-4 md:p-6">Total</span>
              <span className="font-semibold text-base md:text-2xl text-primary p-4 md:p-6">{isHydrated && couponState.blocked ? 'Awaiting coupon check' : `£${(isHydrated ? total : 0).toFixed(2)}`}</span>
            </div>
          </div>
          <a
            href="/checkout"
            aria-disabled={!isHydrated || availability.blocked || couponState.blocked}
            onClick={(event) => { if (!isHydrated || availability.blocked || $couponState.get().blocked) event.preventDefault(); }}
            className="w-full mt-8 h-16 bg-orange text-white inline-flex items-center justify-center text-sm font-semibold hover:bg-orange-hover transition-colors"
          >
            Proceed to checkout
          </a>
          <p className="mt-3 text-[12px] text-[#6e7a92]">All displayed prices include VAT.</p>
        </div>
      </section>
    </>
  );
}

export default withErrorBoundary(CartIsland, "Cart");
