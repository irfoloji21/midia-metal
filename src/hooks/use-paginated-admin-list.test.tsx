import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { usePaginatedAdminList } from './use-paginated-admin-list';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('loads subsequent pages and returns to the previous page after deleting its last record', async () => {
  vi.mocked(apiFetch).mockImplementation(async url => ({ data: [{ id: url.endsWith('page=2') ? 16 : 1 }], total: 16, last_page: 2 }));
  const { result } = renderHook(() => usePaginatedAdminList('/admin/services?search=test'));
  await waitFor(() => expect(result.current.items[0]?.id).toBe(1));
  act(() => result.current.setPage(2));
  await waitFor(() => expect(result.current.items[0]?.id).toBe(16));
  vi.mocked(apiFetch).mockResolvedValue({ data: [], total: 15, last_page: 1 });
  await act(async () => { await result.current.reload(); });
  await waitFor(() => expect(result.current.page).toBe(1));
  await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith('/admin/services?search=test&page=1'));
});

it('ignores an older search response that finishes after the newer search', async () => {
  let finishOld: (value: unknown) => void;
  vi.mocked(apiFetch).mockImplementation(url => url.includes('old') ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve({ data: [{ id: 'new' }], total: 1, last_page: 1 }));
  const { result, rerender } = renderHook(({ query }) => usePaginatedAdminList('/admin/services?search='+query), { initialProps: { query: 'old' } });
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
  rerender({ query: 'new' });
  await waitFor(() => expect(result.current.items[0]?.id).toBe('new'));
  await act(async () => finishOld!({ data: [{ id: 'old' }], total: 99, last_page: 7 }));
  expect(result.current.items[0]?.id).toBe('new');
  expect(result.current.total).toBe(1);
});

it('exposes load errors and recovers when retried', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
  const { result } = renderHook(() => usePaginatedAdminList('/admin/services'));
  await waitFor(() => expect(result.current.error).toBe(true));
  vi.mocked(apiFetch).mockResolvedValue({ data: [{ id: 1 }], total: 1, last_page: 1 });
  await act(async () => { await result.current.reload(); });
  expect(result.current.error).toBe(false);
  expect(result.current.items).toEqual([{ id: 1 }]);
});
