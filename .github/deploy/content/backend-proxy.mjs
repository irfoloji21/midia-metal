import httpProxy from 'http-proxy';

const handledResponse = Symbol('handledApiResponse');
const maxJsonBytes = 16 * 1024 * 1024;

function responseHeaders(upstream, target) {
  const headers = { ...upstream.headers, 'x-robots-tag': 'noindex, nofollow' };
  // Connection headers describe the upstream socket, not the browser connection.
  const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
  const connectionHeaders = String(headers.connection || '').split(',').map(value => value.trim().toLowerCase());
  for (const name of [...hopHeaders, ...connectionHeaders]) delete headers[name];
  if (headers['set-cookie']) {
    headers['set-cookie'] = [].concat(headers['set-cookie']).map(cookie => cookie.replace(/;\s*domain=[^;]*/gi, ''));
  }
  if (headers.location) {
    const location = new URL(headers.location, target.origin);
    if (location.origin === target.origin) headers.location = `${location.pathname}${location.search}${location.hash}`;
  }
  return headers;
}

function unavailable(res) {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) return res.destroy();
  const body = Buffer.from(JSON.stringify({ message: 'The backend is temporarily unavailable.' }));
  res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': body.length });
  res.end(body);
}

export function createBackendProxy(backendOrigin) {
  const target = new URL(backendOrigin);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname);
  if ((!local && (target.hostname !== 'api-test.midiawork.com' || target.protocol !== 'https:')) ||
      (local && !['http:', 'https:'].includes(target.protocol)) ||
      target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('API_BACKEND_URL must be the dedicated HTTPS API origin.');
  }

  const proxy = httpProxy.createProxyServer({
    target: target.origin,
    changeOrigin: true,
    secure: true,
    cookieDomainRewrite: '',
    proxyTimeout: 60000,
    timeout: 65000,
  });

  proxy.on('proxyRes', (upstream, req, res) => {
    if (req[handledResponse]) {
      const headers = responseHeaders(upstream, target);
      const status = upstream.statusCode || 502;
      const noBody = req.method === 'HEAD' || status === 204 || status === 304;
      const json = /\bapplication\/(?:[\w.-]+\+)?json\b/i.test(String(headers['content-type'] || ''));
      upstream.on('error', () => unavailable(res));
      upstream.on('aborted', () => unavailable(res));
      if (noBody || !json) {
        // Keep PDFs and other binary responses streaming; preserve status and cookies.
        res.writeHead(status, headers);
        if (noBody) { upstream.resume(); res.end(); }
        else upstream.pipe(res);
        return;
      }
      const chunks = [];
      let bytes = 0;
      upstream.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxJsonBytes) { unavailable(res); upstream.destroy(); return; }
        chunks.push(chunk);
      });
      upstream.on('end', () => {
        if (res.destroyed || res.writableEnded) return;
        const body = Buffer.concat(chunks, bytes);
        // LiteSpeed's Node bridge needs JSON sent as one complete, length-delimited
        // response. Publishing headers before its body intermittently produced 200/0.
        if (body.length === 0) { unavailable(res); return; }
        headers['content-length'] = String(body.length);
        headers['cache-control'] = 'private, no-store, no-transform';
        res.writeHead(status, headers);
        res.end(body);
      });
      return;
    }
    // Cookies belong only to the frontend hostname, never to .midiawork.com.
    upstream.headers['x-robots-tag'] = 'noindex, nofollow';
    if (upstream.headers.location) {
      const location = new URL(upstream.headers.location, target.origin);
      if (location.origin === target.origin) {
        upstream.headers.location = `${location.pathname}${location.search}${location.hash}`;
      }
    }
  });

  proxy.on('error', (_error, _req, res) => unavailable(res));

  function handle(req, res) {
    if (!/^\/(?:api|sanctum|storage)(?:\/|\?|$)/.test(req.url || '')) return false;
    // Keep the original browser Origin/Referer for Laravel's CSRF validation.
    // The fixed target and TLS verification prevent an open proxy.
    const handleResponse = /^\/(?:api|sanctum)(?:\/|\?|$)/.test(req.url || '');
    req[handledResponse] = handleResponse;
    if (handleResponse) req.headers['accept-encoding'] = 'identity';
    proxy.web(req, res, { selfHandleResponse: handleResponse });
    return true;
  }

  return { handle, close: () => proxy.close() };
}
