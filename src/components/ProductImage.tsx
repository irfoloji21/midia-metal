import { useEffect, useState } from "react";
import { normalizeMediaUrl } from "@/lib/media";
import { sampleImageEdgeColor } from "@/lib/image-color";

interface ProductImageProps {
  src: unknown;
  alt: string;
  className?: string;
  imageClassName?: string;
  fit?: "contain" | "cover";
}

const localStorageProxyUrl = (value: unknown) => {
  const normalized = normalizeMediaUrl(value, "");
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized, "http://localhost");
    const isLocalBackend = ["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.port === "8000";

    if (isLocalBackend && parsed.pathname.startsWith("/storage/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Keep the normalized value if it is not a standard URL.
  }

  return normalized;
};

export default function ProductImage({
  src,
  alt,
  className = "",
  imageClassName = "",
  fit = "contain",
}: ProductImageProps) {
  const imageSrc = localStorageProxyUrl(src);
  const objectFitClass = fit === "cover" ? "object-cover" : "object-contain";
  const [backgroundColor, setBackgroundColor] = useState("#f3f5f7");
  const [canSample, setCanSample] = useState(false);

  useEffect(() => {
    setBackgroundColor("#f3f5f7");
    setCanSample(false);
  }, [imageSrc]);

  return (
    <div className={`relative isolate overflow-hidden ${className}`} style={{ backgroundColor }}>
      {!canSample && imageSrc && (
        <img
          src={imageSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-50"
        />
      )}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          onLoad={(event) => {
            const sampled = sampleImageEdgeColor(event.currentTarget);
            if (sampled) {
              setBackgroundColor(sampled);
              setCanSample(true);
            }
          }}
          className={`relative z-[1] block h-full w-full ${objectFitClass} ${imageClassName}`}
        />
      )}
    </div>
  );
}
