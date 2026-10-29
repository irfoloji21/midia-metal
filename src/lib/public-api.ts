export class PublicApiError extends Error {
  constructor(public readonly status: number) {
    super(`Public API returned HTTP ${status}`);
    this.name = 'PublicApiError';
  }
}

interface PublicGetOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortReason(signal)); return; }
    const onAbort = () => { clearTimeout(timer); reject(abortReason(signal!)); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function retryDelay(header: string | null, attempt: number): number {
  const seconds = header === null ? NaN : Number(header);
  const requested = Number.isFinite(seconds) ? seconds * 1000
    : header ? Date.parse(header) - Date.now() : NaN;
  return Number.isFinite(requested) ? Math.min(1000, Math.max(0, requested)) : 150 * (attempt + 1);
}

/** Bounded retries for anonymous reads only. Mutations must never use this helper. */
export async function fetchPublicJson<T = unknown>(url: string, options: PublicGetOptions = {}): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (options.signal?.aborted) throw abortReason(options.signal);
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 3500);
    let delay = 150 * (attempt + 1);
    let failure: unknown;
    try {
      const response = await fetch(url, {
        method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      if (!response.ok) {
        delay = retryDelay(response.headers.get('Retry-After'), attempt);
        throw new PublicApiError(response.status);
      }
      // Keep the timeout active until the complete response body is parsed.
      return await response.json() as T;
    } catch (error) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      const retryable = !(error instanceof PublicApiError) || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === 2) throw error;
      failure = error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
    if (failure) await pause(delay, options.signal);
  }
  throw new Error('Public API request failed.');
}
