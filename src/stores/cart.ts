/**
 * Cart Store (Nanostores)
 * Replaces: src/context/CartContext.tsx
 * Works across Astro React islands — no shared React tree needed
 *
 * Mirrors the exact logic from CartContext including:
 * - Stock tracking & clamping
 * - Variant-based unique IDs
 * - Coupon system
 * - VAT-inclusive pricing
 * - localStorage persistence
 */
import { atom, computed } from 'nanostores';
import { apiFetch } from '@/lib/api';
import { clampQuantityToStock, getAvailableStock } from '@/lib/stock';
import { formatMoneyValue, resolveSelectedVariantUnitPrice } from '@/lib/pricing';

// --- Types (re-exported from canonical types) ---
export type { CartItem, AppliedCoupon, AddToCartProduct } from '@/types/cart';
import type { CartItem, AppliedCoupon, AddToCartProduct } from '@/types/cart';

// --- Core state ---
function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('midia_cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function loadCoupon(): AppliedCoupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('midia_coupon');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export const $cart = atom<CartItem[]>(loadCart());
export const $coupon = atom<AppliedCoupon | null>(loadCoupon());
export const $isBusiness = atom<boolean>(false);

// Persist cart to localStorage
$cart.subscribe((items) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('midia_cart', JSON.stringify(items));
});

// Persist coupon to localStorage
$coupon.subscribe((c) => {
  if (typeof window === 'undefined') return;
  if (c) {
    localStorage.setItem('midia_coupon', JSON.stringify(c));
  } else {
    localStorage.removeItem('midia_coupon');
  }
});

// --- Derived values ---
export const $subtotal = computed($cart, (cart) =>
  cart.reduce((acc, item) => {
    const priceStr = typeof item.price === 'string' ? item.price : item.price.toString();
    const price = parseFloat(priceStr.replace(/[£,]/g, '')) || 0;
    return acc + price * item.qty;
  }, 0)
);

export const $discount = computed($coupon, (c) => c?.discount ?? 0);

export const $total = computed(
  [$cart, $subtotal, $discount],
  (cart, subtotal, discount) => {
    if (cart.length === 0) return 0;
    return Math.max(0, subtotal - discount);
  }
);

export const $cartCount = computed($cart, (cart) =>
  cart.reduce((acc, item) => acc + item.qty, 0)
);

// --- Actions ---

/** Toast helper — lazy-loads sonner to avoid SSR issues */
async function showToast(message: string, type: 'success' | 'error' = 'error') {
  const { toast } = await import('sonner');
  if (type === 'error') toast.error(message);
  else toast.success(message);
}

export function addToCart(product: AddToCartProduct, quantity: number = 1) {
  if (product.price_on_request) {
    showToast(`Please contact us for a price for ${product.name}.`);
    return false;
  }
  const cart = $cart.get();

  // Build unique ID from product + variant selection
  const variantKeys = Object.keys(product.selected_variants || {}).sort();
  const variantId =
    variantKeys.length > 0
      ? '-' + variantKeys.map((k) => `${k}-${product.selected_variants[k].value}`).join('-')
      : '';
  const uniqueId = `${product.id}${variantId}`;
  const availableStock = getAvailableStock(product);

  if (availableStock !== null && availableStock <= 0) {
    showToast(`${product.name} is out of stock.`);
    return false;
  }

  const existing = cart.find((item) => item.id === uniqueId);
  if (existing) {
    const requestedQty = existing.qty + quantity;
    const nextQty = clampQuantityToStock(requestedQty, availableStock);
    const resolvedPrice = formatMoneyValue(
      resolveSelectedVariantUnitPrice(product.price, product.selected_variants, product) ?? product.price
    );

    if (availableStock !== null && nextQty < requestedQty) {
      showToast(`Only ${availableStock} unit(s) of ${product.name} are in stock.`);
    }

    $cart.set(
      cart.map((item) =>
        item.id === uniqueId
          ? {
              ...item,
              price: resolvedPrice,
              qty: nextQty,
              track_stock: product.track_stock,
              stock_quantity: product.stock_quantity ?? null,
              available_stock: availableStock,
            }
          : item
      )
    );
    return true;
  }

  // New item
  const nextQty = clampQuantityToStock(quantity, availableStock);
  if (availableStock !== null && nextQty < quantity) {
    showToast(`Only ${availableStock} unit(s) of ${product.name} are in stock.`);
  }

  $cart.set([
    ...cart,
    {
      id: uniqueId,
      product_id: product.id,
      name: product.name,
      price: formatMoneyValue(
        resolveSelectedVariantUnitPrice(product.price, product.selected_variants, product) ?? product.price
      ),
      image: product.image,
      qty: nextQty,
      selected_variants: product.selected_variants,
      track_stock: product.track_stock,
      stock_quantity: product.stock_quantity ?? null,
      available_stock: availableStock,
    },
  ]);
  return true;
}

export function removeFromCart(id: number | string) {
  $cart.set($cart.get().filter((item) => item.id !== id));
}

export function updateQuantity(id: number | string, qty: number) {
  const cart = $cart.get();
  let toastMessage: string | null = null;

  $cart.set(
    cart.map((item) => {
      if (item.id !== id) return item;

      const nextQty = clampQuantityToStock(qty, item.available_stock ?? null);
      if (item.available_stock !== null && item.available_stock !== undefined && nextQty < qty) {
        toastMessage = `Only ${item.available_stock} unit(s) of ${item.name} are in stock.`;
      }

      return { ...item, qty: nextQty === 0 ? 1 : nextQty };
    })
  );

  if (toastMessage) showToast(toastMessage);
}

export function clearCart() {
  $cart.set([]);
  $coupon.set(null);
}

export async function applyCoupon(code: string) {
  if (!code.trim()) return;
  try {
    const subtotal = $subtotal.get();
    const res = await apiFetch<AppliedCoupon>('/v1/coupons/apply', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim().toUpperCase(), order_amount: subtotal }),
    });
    $coupon.set(res);
    showToast(res.message, 'success');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid or expired coupon code';
    showToast(msg);
  }
}

export function removeCoupon() {
  $coupon.set(null);
  showToast('Coupon removed', 'success');
}

export function setIsBusiness(value: boolean) {
  $isBusiness.set(value);
}

// --- Initialization ---

/** Refresh stock and purchasing availability once per product on app load. */
const hydratedProductIds = new Set<string>();

export async function hydrateCartStock() {
  const cart = $cart.get();
  const itemsMissingStock = cart.filter(
    (item) => !hydratedProductIds.has(String(item.product_id))
  );
  if (itemsMissingStock.length === 0) return;

  const uniqueProductIds = Array.from(new Set(itemsMissingStock.map((item) => item.product_id)));
  uniqueProductIds.forEach((id) => hydratedProductIds.add(String(id)));

  try {
    const results = await Promise.allSettled(
      uniqueProductIds.map((productId) => apiFetch<Record<string, unknown>>(`/v1/products/${productId}`))
    );
    const products = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return [result.value];
      hydratedProductIds.delete(String(uniqueProductIds[index]));
      return [];
    });
    const byId = new Map(products.map((product) => [String(product.id), product]));
    const quoteOnlyItems = $cart.get().filter((item) => byId.get(String(item.product_id))?.price_on_request);
    if (quoteOnlyItems.length > 0) {
      showToast(`${[...new Set(quoteOnlyItems.map((item) => item.name))].join(', ')} now requires a quote and has been removed from your basket. Please contact us for a price.`);
    }

    $cart.set(
      $cart.get().filter((item) => !byId.get(String(item.product_id))?.price_on_request).map((item) => {
        const product = byId.get(String(item.product_id));
        if (!product) return item;

        return {
          ...item,
          track_stock: Boolean(product.track_stock),
          stock_quantity: typeof product.stock_quantity === 'number' ? product.stock_quantity : null,
          available_stock: getAvailableStock({
            ...product,
            selected_variants: item.selected_variants,
          }),
        };
      })
    );
  } catch (err) {
    uniqueProductIds.forEach((id) => hydratedProductIds.delete(String(id)));
    console.error('Failed to hydrate cart stock', err);
  }
}
