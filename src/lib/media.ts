export const normalizeMediaUrl = (value: unknown, fallback = "/logo.png") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const isLocalBackend = ["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.port === "8000";
      if (isLocalBackend && parsed.pathname.startsWith("/storage/")) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return trimmed;
    }

    return trimmed;
  }
  if (trimmed.startsWith("/uploads/")) return `/storage${trimmed}`;
  if (trimmed.startsWith("uploads/")) return `/storage/${trimmed}`;
  if (trimmed.startsWith("/storage/") || trimmed.startsWith("/images/") || trimmed.startsWith("/logo")) return trimmed;
  if (trimmed.startsWith("storage/")) return `/${trimmed}`;
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
};
