interface Props {
  label: string;
  page: number;
  lastPage: number;
  total: number;
  loading: boolean;
  error: boolean;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
}

export default function ListPagination({ label, page, lastPage, total, loading, error, setPage, reload }: Props) {
  return (
    <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {error ? <p role="alert">Could not load records. <button onClick={() => void reload()} className="underline">Retry</button></p>
        : <span aria-live="polite">{loading ? 'Loading…' : `Page ${page} of ${lastPage} · ${total} records`}</span>}
      <div className="flex gap-2">
        <button disabled={loading || error || page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
        <button disabled={loading || error || page >= lastPage} onClick={() => setPage(page + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
      </div>
    </nav>
  );
}
