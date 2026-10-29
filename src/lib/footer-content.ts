export function socialProfileUrl(value: string): string | undefined {
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    if (!url.hostname.includes('.') || url.pathname.replace(/\//g, '') === '') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function currentCopyright(text: string, year = new Date().getFullYear()): string {
  return text.replace(/(©\s*)(\d{4})(?:\s*[-–]\s*(\d{4}))?/, (_, symbol, start, end) =>
    `${symbol}${end ? `${start}–` : ''}${year}`
  );
}
