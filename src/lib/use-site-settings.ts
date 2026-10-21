import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

let pendingSettings: Promise<Record<string, string>> | null = null;
function refreshSettings() {
  if (!pendingSettings) {
    pendingSettings = apiFetch<Array<{ key: string; value: string }>>('/v1/settings')
      .then(items => Object.fromEntries(items.map(({ key, value }) => [key, String(value ?? '')])))
      .finally(() => { pendingSettings = null; });
  }
  return pendingSettings;
}

/** Persisted layout islands refresh after navigation, including prerendered pages. */
export function useSiteSettings(initialSettings?: Record<string, string>) {
  const [settings, setSettings] = useState(initialSettings ?? {});
  useEffect(() => {
    let active = true;
    if (initialSettings) setSettings(initialSettings);
    const refresh = () => {
      refreshSettings().then(values => { if (active) setSettings(values); })
        .catch(error => console.error('Failed to refresh site settings', error));
    };
    refresh();
    document.addEventListener('astro:after-swap', refresh);
    return () => { active = false; document.removeEventListener('astro:after-swap', refresh); };
  }, [initialSettings]);
  return settings;
}
