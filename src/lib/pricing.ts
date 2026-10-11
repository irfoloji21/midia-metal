import { buildVariantSizeSummary, findMatchingCombinationVariant, getProductVariantMode, getVariantAttributes, getVariantOptionNames, resolveSelectedVariantRecord } from "@/lib/variants";

export const parseMoneyValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  const parsed = parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
};

export const formatMoneyValue = (value: unknown): string => {
  const parsed = parseMoneyValue(value);
  return parsed === null ? String(value ?? "") : `£${parsed.toFixed(2)}`;
};

export const shouldShowOldPrice = (oldPrice: unknown, currentPrice: unknown): boolean => {
  const old = parseMoneyValue(oldPrice);
  const current = parseMoneyValue(currentPrice);
  return old !== null && current !== null && old > current;
};

export const resolveSelectedVariantUnitPrice = (
  basePrice: unknown,
  selectedVariants?: Record<string, any> | null,
  productOrVariants?: { variant_mode?: unknown; variant_options?: unknown; variants?: Array<Record<string, any>> | null } | Array<Record<string, any>> | null,
): number | null => {
  const base = parseMoneyValue(basePrice);
  const resolvedVariant = Array.isArray(productOrVariants)
    ? null
    : resolveSelectedVariantRecord(productOrVariants, selectedVariants);
  const resolvedVariantPrice = parseMoneyValue(resolvedVariant?.price);
  if (resolvedVariantPrice !== null) {
    return resolvedVariantPrice;
  }

  const productVariants = Array.isArray(productOrVariants)
    ? productOrVariants
    : Array.isArray(productOrVariants?.variants)
      ? productOrVariants.variants
      : [];

  if (getProductVariantMode({
    variant_mode: Array.isArray(productOrVariants) ? null : productOrVariants?.variant_mode,
    variants: productVariants,
  }) === "combination") {
    const match = findMatchingCombinationVariant(
      productVariants,
      selectedVariants,
      Array.isArray(productOrVariants) ? [] : getVariantOptionNames(productOrVariants),
    );
    const combinationPrice = parseMoneyValue(match?.price);
    return combinationPrice !== null ? combinationPrice : base;
  }

  const variants = Object.values(selectedVariants || {}).filter(Boolean);
  
  // 1. Prioritize any variant specifically named "Size" (or similar) that has a price
  const sizeVariant = variants.find(v => {
    const opt = String(v.option ?? "").toLowerCase();
    return opt === "size" || opt === "ölçü" || opt === "ebat";
  });
  
  const sizePrice = parseMoneyValue(sizeVariant?.price);
  if (sizePrice !== null) {
    return sizePrice;
  }

  // 2. Fallback: Find the first variant with a non-null price
  const variantWithPrice = variants.find(v => parseMoneyValue(v.price) !== null);
  if (variantWithPrice) {
    return parseMoneyValue(variantWithPrice.price);
  }

  return base;
};

export const getStandardizedDisplayPrice = (product: any): string => {
  if (!product) return "£0.00";
  
  const base = parseMoneyValue(product.price);
  
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    const validPrices = product.variants
      .map((v: any) => parseMoneyValue(v.price))
      .filter((p: number | null): p is number => p !== null);
      
    if (validPrices.length > 0) {
      const minPrice = Math.min(...validPrices);
      return `£${minPrice.toFixed(2)}`;
    }
  }
  
  return base !== null ? `£${base.toFixed(2)}` : String(product.price || "");
};

export const getStandardizedDisplayTitle = (product: any, activeVariantMap?: Record<string, any> | null): string => {
  if (!product) return "";
  
  let appendText = "";
  if (product.show_variant_in_title) {
    const isSizeOption = (opt: any) => {
      const normalized = String(opt ?? "").toLowerCase();
      return normalized === "size" || normalized === "ölçü" || normalized === "ebat";
    };

    if (getProductVariantMode(product) === "combination") {
      let selectedAttributes: Record<string, string> = {};
      let sourceVariant: any = null;

      if (activeVariantMap && Object.keys(activeVariantMap).length > 0) {
        selectedAttributes = Object.fromEntries(
          getVariantOptionNames(product)
            .map((option) => [option, String(activeVariantMap[option]?.value ?? "").trim()] as const)
            .filter(([, value]) => value),
        );
        sourceVariant = resolveSelectedVariantRecord(product, activeVariantMap);
      } else {
        const pricedVariants = (product.variants || [])
          .map((variant: any) => ({ variant, price: parseMoneyValue(variant?.price) }))
          .filter((entry: { price: number | null }) => entry.price !== null) as Array<{ variant: any; price: number }>;
        const cheapestVariant = pricedVariants.length > 0
          ? pricedVariants.reduce((min, current) => current.price < min.price ? current : min, pricedVariants[0]).variant
          : product.variants?.[0];
        sourceVariant = cheapestVariant;
        selectedAttributes = getVariantAttributes(cheapestVariant);
      }

      const attributeValues = getVariantOptionNames(product)
        .filter((option) => selectedAttributes[option])
        .map((option) => selectedAttributes[option]);
      const hasExplicitSizeValue = Object.entries(getVariantAttributes(sourceVariant))
        .some(([option, value]) => isSizeOption(option) && Boolean(value));
      const sizeSummary = hasExplicitSizeValue ? "" : buildVariantSizeSummary(sourceVariant);
      if (sizeSummary) {
        attributeValues.push(sizeSummary);
      }
      if (attributeValues.length > 0) {
        appendText = ` - ${attributeValues.join(" / ")}`;
      }
    } else if (activeVariantMap && Object.keys(activeVariantMap).length > 0) {
      const sizeVariant = Object.values(activeVariantMap).find((v: any) => isSizeOption(v.option));
      if (sizeVariant && sizeVariant.value) {
        appendText = ` - ${sizeVariant.value}`;
      }
    } else if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      const sizeVariants = product.variants.filter((v: any) => isSizeOption(v.option));
      if (sizeVariants.length > 0) {
        const validVariants = sizeVariants.filter((v: any) => v.price !== null && v.price !== undefined && String(v.price).trim() !== "");
        if (validVariants.length > 0) {
          const cheapest = validVariants.reduce((min: any, curr: any) => {
            const currPrice = parseFloat(String(curr.price).replace(/[^\d.-]/g, "")) || 0;
            const minPrice = parseFloat(String(min.price).replace(/[^\d.-]/g, "")) || 0;
            return currPrice < minPrice ? curr : min;
          }, validVariants[0]);
          if (cheapest && cheapest.value) {
            appendText = ` - ${cheapest.value}`;
          }
        } else if (sizeVariants[0] && sizeVariants[0].value) {
          appendText = ` - ${sizeVariants[0].value}`;
        }
      }
    }
  }
  
  return `${product.name}${appendText}`;
};
