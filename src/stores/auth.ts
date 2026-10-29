/**
 * Customer Auth Store (Nanostores)
 * Replaces: src/context/CustomerAuthContext.tsx
 * Works across Astro React islands — no shared React tree needed
 */
import { atom, computed } from 'nanostores';
import { API_URL } from '@/lib/api';

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
}

// --- Core state ---
export const $customer = atom<Customer | null>(null);
export const $isAuthLoading = atom<boolean>(true);
export const $authError = atom<string | null>(null);

let currentRequest: Promise<void> | null = null;
let requestVersion = 0;

// --- Derived ---
export const $isAuthenticated = computed($customer, (c) => c !== null);

// --- Actions ---
const getResolvedApiUrl = () => {
  if (typeof window === 'undefined') {
    return API_URL;
  }

  if (API_URL.startsWith('http://127.0.0.1:') || API_URL.startsWith('http://localhost:')) {
    return '/api';
  }

  return API_URL;
};

function setCustomerSession(customerData: Customer | null) {
  // A late session response must not undo a login, logout or profile update.
  requestVersion++;
  currentRequest = null;
  $customer.set(customerData);
  $authError.set(null);
  $isAuthLoading.set(false);
}

export function loginCustomer(customerData: Customer) {
  setCustomerSession(customerData);
}

export function logoutCustomer() {
  setCustomerSession(null);
}

export function updateCustomer(customerData: Customer) {
  setCustomerSession(customerData);
}

/**
 * Shared session check, started by CustomerSessionIsland in BaseLayout.
 * Concurrent consumers share one request. Only an explicit 401 means guest;
 * network/server errors retain a separate, retryable state.
 */
export function fetchCurrentCustomer(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (currentRequest) return currentRequest;

  const version = ++requestVersion;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  $isAuthLoading.set(true);
  $authError.set(null);
  currentRequest = Promise.resolve().then(async () => {
    try {
      const response = await fetch(`${getResolvedApiUrl()}/v1/customer/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 401) {
        if (version === requestVersion) $customer.set(null);
      } else {
        if (!response.ok) throw new Error('Session check failed');
        const data = await response.json();
        if (!data || typeof data.id !== 'number') throw new Error('Invalid session response');
        if (version === requestVersion) $customer.set(data);
      }
    } catch {
      if (version === requestVersion) {
        $authError.set('We could not verify your session. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion) {
        $isAuthLoading.set(false);
        currentRequest = null;
      }
    }
  });
  return currentRequest;
}
