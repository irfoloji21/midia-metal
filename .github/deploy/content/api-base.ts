// Server-only API resolution for the isolated content deployment.
export function getApiBase(_requestUrl?: URL | string) {
  const origin = typeof process !== 'undefined' ? process.env.API_BACKEND_URL : undefined;
  return `${(origin || 'https://api-test.midiawork.com').replace(/\/+$/, '')}/api`;
}
