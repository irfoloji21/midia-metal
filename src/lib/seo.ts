export const DEFAULT_SITE_NAME = "Midia M Metal";

export function stripHtml(input: string = ""): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(input: string = "", maxLength: number = 160): string {
  const normalized = input.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function absoluteUrl(pathOrUrl: string = ""): string {
  if (!pathOrUrl) {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  if (typeof window === "undefined") {
    return pathOrUrl;
  }

  return new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, window.location.origin).toString();
}

export function buildSeoTitle(title: string, siteName: string = DEFAULT_SITE_NAME): string {
  if (!title) {
    return siteName;
  }

  return title.includes(siteName) ? title : `${title} | ${siteName}`;
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildOrganizationJsonLd({
  name = DEFAULT_SITE_NAME,
  url,
  logo,
  email,
  telephone,
  sameAs = [],
}: {
  name?: string;
  url: string;
  logo?: string;
  email?: string;
  telephone?: string;
  sameAs?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo ? { logo } : {}),
    ...(email ? { email } : {}),
    ...(telephone ? { telephone } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function priceToNumber(price: string | number | null | undefined): number | null {
  if (typeof price === "number") {
    return Number.isFinite(price) ? price : null;
  }

  if (typeof price !== "string") {
    return null;
  }

  const numeric = parseFloat(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

// --- Structured Data Builders for SEO ---

/**
 * Build Product JSON-LD schema for product detail pages.
 * Required for Google rich product snippets and Merchant Center.
 */
export function buildProductJsonLd({
  name,
  description,
  image,
  sku,
  url,
  price,
  priceCurrency = "GBP",
  availability = "https://schema.org/InStock",
  brand = "Midia M Metal",
  ratingValue,
  reviewCount,
}: {
  name: string;
  description?: string;
  image?: string;
  sku?: string;
  url: string;
  price: string | number | null;
  priceCurrency?: string;
  availability?: string;
  brand?: string;
  ratingValue?: number;
  reviewCount?: number;
}) {
  const numericPrice = price === null ? null : priceToNumber(price);
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description: truncateText(stripHtml(description), 5000) } : {}),
    ...(image ? { image } : {}),
    ...(sku ? { sku } : {}),
    brand: { "@type": "Brand", name: brand },
    ...(numericPrice !== null ? { offers: {
      "@type": "Offer",
      url,
      priceCurrency,
      price: numericPrice.toFixed(2),
      availability,
      seller: { "@type": "Organization", name: DEFAULT_SITE_NAME },
    } } : {}),
  };

  if (ratingValue && reviewCount && reviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount,
    };
  }

  return jsonLd;
}

/**
 * Build BlogPosting JSON-LD schema for blog detail pages.
 * Enables rich results with date, author, and image in search.
 */
export function buildBlogPostingJsonLd({
  headline,
  description,
  image,
  datePublished,
  dateModified,
  authorName = "Admin",
  url,
  publisherName = DEFAULT_SITE_NAME,
  publisherLogo,
}: {
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  url: string;
  publisherName?: string;
  publisherLogo?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    ...(description ? { description: truncateText(stripHtml(description), 300) } : {}),
    ...(image ? { image } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : { ...(datePublished ? { dateModified: datePublished } : {}) }),
    author: { "@type": "Person", name: authorName },
    url,
    publisher: {
      "@type": "Organization",
      name: publisherName,
      ...(publisherLogo ? { logo: { "@type": "ImageObject", url: publisherLogo } } : {}),
    },
  };
}

/**
 * Build ItemList JSON-LD schema for list/collection pages.
 * Helps Google understand page structure for blog lists, product lists, portfolio lists.
 */
export function buildItemListJsonLd({
  name,
  description,
  url,
  items,
}: {
  name?: string;
  description?: string;
  url?: string;
  items: Array<{ url: string; name?: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    ...(url ? { url } : {}),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: item.url,
        ...(item.name ? { name: item.name } : {}),
      })),
    },
  };
}

/**
 * Build FAQPage JSON-LD schema for FAQ pages.
 * Enables FAQ rich results in Google Search.
 */
export function buildFaqPageJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(faq.answer),
      },
    })),
  };
}

/**
 * Build Service JSON-LD schema for service detail pages.
 */
export function buildServiceJsonLd({
  name,
  description,
  image,
  url,
  providerName = DEFAULT_SITE_NAME,
}: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  providerName?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    ...(description ? { description: truncateText(stripHtml(description), 300) } : {}),
    ...(image ? { image } : {}),
    url,
    provider: { "@type": "Organization", name: providerName },
  };
}
