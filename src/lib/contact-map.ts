const GOOGLE_MAP_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.co.uk',
  'www.google.co.uk',
  'maps.google.co.uk',
]);

function isConfigured(value: string | null): boolean {
  return Boolean(value?.trim() && !/^(?:\.{3}|…|undefined|null|YOUR_API_KEY)$/i.test(value.trim()));
}

export function getGoogleMapsEmbedUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !GOOGLE_MAP_HOSTS.has(url.hostname)
      || url.username || url.password || url.port) return null;

    const path = url.pathname.replace(/\/$/, '');
    const parameter = (key: string) => isConfigured(url.searchParams.get(key));

    // The URL produced by Google Maps' "Embed a map" share option.
    if (path === '/maps/embed') {
      const payload = url.searchParams.get('pb');
      return payload?.startsWith('!') && parameter('pb') ? url.href : null;
    }

    if (path === '/maps' && url.searchParams.get('output') === 'embed' && parameter('q')) {
      return url.href;
    }

    if (!parameter('key')) return null;
    const mode = path.replace('/maps/embed/v1/', '');
    if (!path.startsWith('/maps/embed/v1/')) return null;
    const validMode = (mode === 'place' || mode === 'search') ? parameter('q')
      : mode === 'view' ? parameter('center')
        : mode === 'directions' ? parameter('origin') && parameter('destination')
          : mode === 'streetview' ? parameter('location') || parameter('pano')
            : false;

    return validMode ? url.href : null;
  } catch {
    return null;
  }
}

export function getGoogleMapsSearchUrl(address: string | undefined): string | null {
  const query = address?.trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}
