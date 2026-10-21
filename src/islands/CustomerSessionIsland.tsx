import { useEffect } from 'react';
import { fetchCurrentCustomer } from '@/stores/auth';

/** One session owner for all public pages, persisted across Astro navigation. */
export default function CustomerSessionIsland() {
  useEffect(() => {
    const refresh = () => { void fetchCurrentCustomer(); };
    refresh();
    document.addEventListener('astro:after-swap', refresh);
    return () => document.removeEventListener('astro:after-swap', refresh);
  }, []);
  return null;
}
