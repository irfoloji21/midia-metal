/**
 * Wishlist Store (Nanostores)
 * Replaces: src/context/WishlistContext.tsx
 * Works across Astro React islands — no shared React tree needed
 */
import { atom, computed } from 'nanostores';

export interface WishlistItem {
  price_on_request?: boolean;
  id: number | string;
  name: string;
  price: string | number;
  image: string;
  slug?: string;
}

// --- Core state ---
function loadWishlist(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('midia_wishlist');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export const $wishlist = atom<WishlistItem[]>(loadWishlist());

// Persist to localStorage on every change
$wishlist.subscribe((items) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('midia_wishlist', JSON.stringify(items));
});

// --- Derived ---
export const $wishlistCount = computed($wishlist, (items) => items.length);

// --- Actions ---
export function addToWishlist(item: WishlistItem) {
  const current = $wishlist.get();
  if (current.find((w) => w.id === item.id)) return;
  $wishlist.set([...current, item]);
}

export function removeFromWishlist(id: number | string) {
  $wishlist.set($wishlist.get().filter((w) => w.id !== id));
}

export function isInWishlist(id: number | string): boolean {
  return $wishlist.get().some((w) => w.id === id);
}

export function clearWishlist() {
  $wishlist.set([]);
}
