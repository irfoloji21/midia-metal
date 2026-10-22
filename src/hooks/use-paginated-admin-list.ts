import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

export function usePaginatedAdminList<T = any>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sequence = useRef(0);

  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(false);
    try {
      const result = await apiFetch<{ data: T[]; last_page: number; total: number }>(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}`);
      if (request !== sequence.current) return;
      const last = Math.max(1, result.last_page || 1);
      setItems(result.data);
      setLastPage(last);
      setTotal(result.total);
      // Deleting the last row on the last page returns to the nearest existing page.
      if (page > last) setPage(last);
    } catch {
      if (request !== sequence.current) return;
      setItems([]);
      setError(true);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [endpoint, page]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => { void reload(); }, 200);
    return () => { clearTimeout(timer); sequence.current += 1; };
  }, [reload]);

  return { items, setItems, page, setPage, lastPage, total, loading, error, reload };
}
