export type VariantSelection = {
  option: string;
  value: string;
};

export type SelectedVariantMap = Record<string, VariantSelection>;

export type VariantRecord = Record<string, any>;

const normalizeText = (value: unknown): string => String(value ?? "").trim();

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
};

export const normalizeVariantOptionName = (value: unknown): string => normalizeText(value);

export const getVariantAttributes = (variant: VariantRecord | null | undefined): Record<string, string> => {
  const raw = variant?.attributes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => [normalizeVariantOptionName(key), normalizeText(value)])
      .filter(([key, value]) => key && value),
  );
};

export const buildVariantSizeSummary = (variant: VariantRecord | null | undefined): string => {
  const length = Number(variant?.shipping_length_cm ?? 0);
  const width = Number(variant?.shipping_width_cm ?? 0);
  const height = Number(variant?.shipping_height_cm ?? 0);

  if (length <= 0 || width <= 0 || height <= 0) {
    return "";
  }

  const widthMm = Math.round(length * 10);
  const heightMm = Math.round(width * 10);
  const depthMm = Math.round(height * 10);
  const widthInches = Math.round(widthMm / 25);
  const heightInches = Math.round(heightMm / 25);
  const depthInches = Math.round(depthMm / 25);

  return `H ${heightMm} x W ${widthMm} x D ${depthMm}mm (${heightInches}" x ${widthInches}" x ${depthInches}")`;
};

export const isCombinationVariant = (variant: VariantRecord | null | undefined): boolean =>
  Object.keys(getVariantAttributes(variant)).length > 0;

export const getProductVariantMode = (product: {
  variant_mode?: unknown;
  variants?: VariantRecord[] | null;
} | null | undefined): "legacy" | "combination" => {
  const explicitMode = normalizeText(product?.variant_mode).toLowerCase();
  if (explicitMode === "combination") {
    return "combination";
  }

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.some((variant) => isCombinationVariant(variant)) ? "combination" : "legacy";
};

export const getVariantOptionNames = (product: {
  variant_mode?: unknown;
  variant_options?: unknown;
  variants?: VariantRecord[] | null;
} | null | undefined): string[] => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (getProductVariantMode(product) === "combination") {
    const explicitOptions = Array.isArray(product?.variant_options)
      ? product.variant_options.map((option) => normalizeVariantOptionName(option)).filter(Boolean)
      : [];
    const attributeOptions = variants.flatMap((variant) => Object.keys(getVariantAttributes(variant)));
    return uniqueStrings([...explicitOptions, ...attributeOptions]);
  }

  return uniqueStrings(
    variants
      .map((variant) => normalizeVariantOptionName(variant?.option))
      .filter(Boolean),
  );
};

export const getSelectedVariantValue = (
  selectedVariants: SelectedVariantMap | Record<string, any> | null | undefined,
  optionName: string,
): string => normalizeText(selectedVariants?.[optionName]?.value);

export const buildSelectedVariantsFromCombination = (
  variant: VariantRecord | null | undefined,
  optionNames: string[],
): SelectedVariantMap => {
  const attributes = getVariantAttributes(variant);

  return Object.fromEntries(
    optionNames
      .map((optionName) => {
        const value = attributes[optionName];
        return value
          ? [optionName, { option: optionName, value } satisfies VariantSelection]
          : null;
      })
      .filter((entry): entry is [string, VariantSelection] => Boolean(entry)),
  );
};

export const findMatchingCombinationVariant = (
  variants: VariantRecord[] | null | undefined,
  selectedVariants: SelectedVariantMap | Record<string, any> | null | undefined,
  optionNames: string[] = [],
): VariantRecord | null => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return null;
  }

  const requiredOptions = optionNames.length > 0
    ? optionNames.map((option) => normalizeVariantOptionName(option)).filter(Boolean)
    : uniqueStrings(variants.flatMap((variant) => Object.keys(getVariantAttributes(variant))));

  if (requiredOptions.length === 0) {
    return variants[0] ?? null;
  }

  const hasCompleteSelection = requiredOptions.every((optionName) => getSelectedVariantValue(selectedVariants, optionName));
  if (!hasCompleteSelection) {
    return null;
  }

  return variants.find((variant) => {
    const attributes = getVariantAttributes(variant);
    return requiredOptions.every((optionName) => attributes[optionName] === getSelectedVariantValue(selectedVariants, optionName));
  }) ?? null;
};

export const resolveSelectedVariantRecord = (
  product: {
    variant_mode?: unknown;
    variant_options?: unknown;
    variants?: VariantRecord[] | null;
  } | null | undefined,
  selectedVariants?: SelectedVariantMap | Record<string, any> | null,
): VariantRecord | null => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const normalizedSelectionValues = Object.values(selectedVariants || {})
    .map((selected) => normalizeText(selected?.value))
    .filter(Boolean);

  if (variants.length === 0) {
    return null;
  }

  if (getProductVariantMode(product) === "combination") {
    if (variants.length === 1 && normalizedSelectionValues.length === 0) {
      return variants[0] ?? null;
    }

    return findMatchingCombinationVariant(variants, selectedVariants, getVariantOptionNames(product));
  }

  if (variants.length === 1) {
    return variants[0] ?? null;
  }

  for (const [option, selected] of Object.entries(selectedVariants || {})) {
    const value = normalizeText(selected?.value);
    if (!value) continue;

    const match = variants.find((variant) => (
      normalizeVariantOptionName(variant?.option) === normalizeVariantOptionName(option)
      && normalizeText(variant?.value) === value
    ));

    if (match) {
      return match;
    }
  }

  return null;
};

export const getCompatibleCombinationVariants = (
  product: {
    variant_mode?: unknown;
    variant_options?: unknown;
    variants?: VariantRecord[] | null;
  } | null | undefined,
  selectedVariants: SelectedVariantMap | Record<string, any> | null | undefined,
  optionToIgnore?: string,
): VariantRecord[] => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const normalizedIgnore = normalizeVariantOptionName(optionToIgnore);
  const optionNames = getVariantOptionNames(product);

  return variants.filter((variant) => {
    const attributes = getVariantAttributes(variant);

    return optionNames.every((optionName) => {
      if (normalizedIgnore && optionName === normalizedIgnore) {
        return true;
      }

      const selectedValue = getSelectedVariantValue(selectedVariants, optionName);
      return !selectedValue || attributes[optionName] === selectedValue;
    });
  });
};

export const getVariantOptionValues = (
  product: {
    variant_mode?: unknown;
    variant_options?: unknown;
    variants?: VariantRecord[] | null;
  } | null | undefined,
  optionName: string,
  selectedVariants?: SelectedVariantMap | Record<string, any> | null,
): string[] => {
  const normalizedOption = normalizeVariantOptionName(optionName);
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (getProductVariantMode(product) === "combination") {
    return uniqueStrings(
      getCompatibleCombinationVariants(product, selectedVariants, normalizedOption)
        .map((variant) => getVariantAttributes(variant)[normalizedOption] ?? "")
        .filter(Boolean),
    );
  }

  return uniqueStrings(
    variants
      .filter((variant) => normalizeVariantOptionName(variant?.option) === normalizedOption)
      .map((variant) => normalizeText(variant?.value))
      .filter(Boolean),
  );
};

export const isCompleteVariantSelection = (
  product: {
    variant_mode?: unknown;
    variant_options?: unknown;
    variants?: VariantRecord[] | null;
  } | null | undefined,
  selectedVariants: SelectedVariantMap | Record<string, any> | null | undefined,
): boolean => getVariantOptionNames(product).every((optionName) => Boolean(getSelectedVariantValue(selectedVariants, optionName)));
