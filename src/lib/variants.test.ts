import { describe, it, expect } from "vitest";
import {
  normalizeVariantOptionName,
  getVariantAttributes,
  isCombinationVariant,
  getProductVariantMode,
  getVariantOptionNames,
  getSelectedVariantValue,
  buildSelectedVariantsFromCombination,
  findMatchingCombinationVariant,
  getCompatibleCombinationVariants,
  getVariantOptionValues,
  isCompleteVariantSelection,
  buildVariantSizeSummary,
  formatVariantDimensionValue,
} from "@/lib/variants";

describe('small variant size summaries', () => {
  it.each([
    ['mm', 'H 500 x W 1000 x D 0.1mm'],
    ['cm', 'H 50 x W 100 x D 0.01cm'],
    ['m', 'H 0.5 x W 1 x D 0.0001m'],
  ] as const)('formats public summaries in %s without changing the original variant', (unit, metric) => {
    const variant = Object.freeze({ option: 'Size', value: 'Size : H 500 x W 1000 x D 0.1mm (20" x 40" x 0.0039")', shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 0.01 });
    expect(buildVariantSizeSummary(variant, unit)).toBe(`${metric} (20" x 40" x 0.0039")`);
    expect(formatVariantDimensionValue(variant, unit)).toBe(`Size : ${metric} (20" x 40" x 0.0039")`);
    expect(variant.value).toBe('Size : H 500 x W 1000 x D 0.1mm (20" x 40" x 0.0039")');
    expect(formatVariantDimensionValue(variant)).toBe(variant.value);
  });

  it('does not reinterpret custom, incomplete or mismatched size labels', () => {
    const dimensions = { shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20 };
    for (const value of ['Custom size 1000mm', 'Size : 1000mm', 'Size : H 1 x W 1 x D 1mm (1" x 1" x 1")']) {
      expect(formatVariantDimensionValue({ ...dimensions, value }, 'm')).toBe(value);
    }
    const value = 'Size : H 500 x W 1000 x D 200mm (20" x 40" x 8")';
    expect(formatVariantDimensionValue({ value }, 'm')).toBe(value);
  });

  it('shows decimal millimetres and nonzero inches for new small dimensions', () => {
    expect(buildVariantSizeSummary({ shipping_length_cm: 0.01, shipping_width_cm: 0.02, shipping_height_cm: 0.99 }))
      .toBe('H 0.2 x W 0.1 x D 9.9mm (0.0079" x 0.0039" x 0.3898")');
  });

  it('preserves existing size summaries', () => {
    expect(buildVariantSizeSummary({ shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20 }))
      .toBe('H 500 x W 1000 x D 200mm (20" x 40" x 8")');
  });
});

describe("normalizeVariantOptionName", () => {
  it("trims whitespace", () => {
    expect(normalizeVariantOptionName("  Size  ")).toBe("Size");
  });

  it("handles null/undefined", () => {
    expect(normalizeVariantOptionName(null)).toBe("");
    expect(normalizeVariantOptionName(undefined)).toBe("");
  });

  it("converts non-string to string", () => {
    expect(normalizeVariantOptionName(42)).toBe("42");
  });
});

describe("getVariantAttributes", () => {
  it("returns attributes from combination variant", () => {
    const variant = { attributes: { Material: "Steel", Size: "Large" } };
    expect(getVariantAttributes(variant)).toEqual({ Material: "Steel", Size: "Large" });
  });

  it("returns empty object for null variant", () => {
    expect(getVariantAttributes(null)).toEqual({});
  });

  it("returns empty object for variant without attributes", () => {
    expect(getVariantAttributes({ option: "Size", value: "Large" })).toEqual({});
  });

  it("trims attribute keys and values", () => {
    const variant = { attributes: { "  Material  ": "  Steel  " } };
    expect(getVariantAttributes(variant)).toEqual({ Material: "Steel" });
  });

  it("filters out empty keys or values", () => {
    const variant = { attributes: { Material: "Steel", "": "ghost", Size: "" } };
    expect(getVariantAttributes(variant)).toEqual({ Material: "Steel" });
  });
});

describe("isCombinationVariant", () => {
  it("returns true for variant with non-empty attributes", () => {
    expect(isCombinationVariant({ attributes: { Material: "Steel" } })).toBe(true);
  });

  it("returns false for legacy variant", () => {
    expect(isCombinationVariant({ option: "Size", value: "Large" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCombinationVariant(null)).toBe(false);
  });

  it("returns false for empty attributes", () => {
    expect(isCombinationVariant({ attributes: {} })).toBe(false);
  });
});

describe("getProductVariantMode", () => {
  it("returns 'legacy' for null product", () => {
    expect(getProductVariantMode(null)).toBe("legacy");
  });

  it("returns 'combination' when explicit variant_mode is set", () => {
    expect(getProductVariantMode({ variant_mode: "combination" })).toBe("combination");
  });

  it("returns 'combination' when variants have attributes", () => {
    const product = {
      variants: [{ attributes: { Material: "Steel", Size: "Large" } }],
    };
    expect(getProductVariantMode(product)).toBe("combination");
  });

  it("returns 'legacy' for products with option/value variants", () => {
    const product = {
      variants: [{ option: "Size", value: "Large" }],
    };
    expect(getProductVariantMode(product)).toBe("legacy");
  });

  it("returns 'legacy' for product with no variants", () => {
    expect(getProductVariantMode({ variants: [] })).toBe("legacy");
  });
});

describe("getVariantOptionNames", () => {
  it("returns unique option names from legacy variants", () => {
    const product = {
      variants: [
        { option: "Size", value: "Small" },
        { option: "Size", value: "Large" },
        { option: "Colour", value: "Red" },
      ],
    };
    expect(getVariantOptionNames(product)).toEqual(["Size", "Colour"]);
  });

  it("returns attribute keys from combination variants", () => {
    const product = {
      variant_mode: "combination",
      variant_options: ["Material", "Size"],
      variants: [
        { attributes: { Material: "Steel", Size: "Large" } },
      ],
    };
    expect(getVariantOptionNames(product)).toEqual(["Material", "Size"]);
  });

  it("merges explicit options with attribute keys", () => {
    const product = {
      variant_mode: "combination",
      variant_options: ["Material"],
      variants: [
        { attributes: { Material: "Steel", Size: "Large" } },
      ],
    };
    expect(getVariantOptionNames(product)).toEqual(["Material", "Size"]);
  });

  it("returns empty array for null product", () => {
    expect(getVariantOptionNames(null)).toEqual([]);
  });
});

describe("getSelectedVariantValue", () => {
  it("returns the selected value for a given option", () => {
    const selected = { Size: { option: "Size", value: "Large" } };
    expect(getSelectedVariantValue(selected, "Size")).toBe("Large");
  });

  it("returns empty string for unselected option", () => {
    expect(getSelectedVariantValue({}, "Size")).toBe("");
  });

  it("returns empty string for null selectedVariants", () => {
    expect(getSelectedVariantValue(null, "Size")).toBe("");
  });
});

describe("buildSelectedVariantsFromCombination", () => {
  it("converts combination variant to selected variant map", () => {
    const variant = { attributes: { Material: "Steel", Size: "Large" } };
    const result = buildSelectedVariantsFromCombination(variant, ["Material", "Size"]);
    expect(result).toEqual({
      Material: { option: "Material", value: "Steel" },
      Size: { option: "Size", value: "Large" },
    });
  });

  it("skips option names not present in attributes", () => {
    const variant = { attributes: { Material: "Steel" } };
    const result = buildSelectedVariantsFromCombination(variant, ["Material", "Size"]);
    expect(result).toEqual({
      Material: { option: "Material", value: "Steel" },
    });
  });

  it("returns empty map for null variant", () => {
    expect(buildSelectedVariantsFromCombination(null, ["Size"])).toEqual({});
  });
});

describe("findMatchingCombinationVariant", () => {
  const variants = [
    { attributes: { Material: "Steel", Size: "Large" }, price: "£250" },
    { attributes: { Material: "Aluminium", Size: "Small" }, price: "£180" },
  ];

  it("finds exact matching variant", () => {
    const selected = {
      Material: { option: "Material", value: "Steel" },
      Size: { option: "Size", value: "Large" },
    };
    expect(findMatchingCombinationVariant(variants, selected)).toBe(variants[0]);
  });

  it("returns null when no match", () => {
    const selected = {
      Material: { option: "Material", value: "Plastic" },
      Size: { option: "Size", value: "Large" },
    };
    expect(findMatchingCombinationVariant(variants, selected)).toBeNull();
  });

  it("returns null for incomplete selection", () => {
    const selected = {
      Material: { option: "Material", value: "Steel" },
    };
    expect(findMatchingCombinationVariant(variants, selected)).toBeNull();
  });

  it("returns null for empty variants array", () => {
    expect(findMatchingCombinationVariant([], {})).toBeNull();
  });

  it("returns null for null variants", () => {
    expect(findMatchingCombinationVariant(null, {})).toBeNull();
  });
});

describe("getCompatibleCombinationVariants", () => {
  const product = {
    variant_mode: "combination" as const,
    variant_options: ["Material", "Size"],
    variants: [
      { attributes: { Material: "Steel", Size: "Large" } },
      { attributes: { Material: "Steel", Size: "Small" } },
      { attributes: { Material: "Aluminium", Size: "Large" } },
    ],
  };

  it("filters by selected options", () => {
    const selected = {
      Material: { option: "Material", value: "Steel" },
    };
    const result = getCompatibleCombinationVariants(product, selected);
    expect(result).toHaveLength(2);
  });

  it("ignores specified option when filtering", () => {
    const selected = {
      Material: { option: "Material", value: "Steel" },
      Size: { option: "Size", value: "Large" },
    };
    // Ignore Size → should return all Steel variants regardless of size
    const result = getCompatibleCombinationVariants(product, selected, "Size");
    expect(result).toHaveLength(2);
  });

  it("returns all variants when nothing is selected", () => {
    const result = getCompatibleCombinationVariants(product, {});
    expect(result).toHaveLength(3);
  });
});

describe("getVariantOptionValues", () => {
  it("returns unique values for legacy option", () => {
    const product = {
      variants: [
        { option: "Size", value: "Small" },
        { option: "Size", value: "Large" },
        { option: "Size", value: "Small" }, // duplicate
        { option: "Colour", value: "Red" },
      ],
    };
    expect(getVariantOptionValues(product, "Size")).toEqual(["Small", "Large"]);
  });

  it("returns values for combination option respecting selection", () => {
    const product = {
      variant_mode: "combination" as const,
      variant_options: ["Material", "Size"],
      variants: [
        { attributes: { Material: "Steel", Size: "Large" } },
        { attributes: { Material: "Steel", Size: "Small" } },
        { attributes: { Material: "Aluminium", Size: "Large" } },
      ],
    };
    const selected = {
      Material: { option: "Material", value: "Steel" },
    };
    // When Material=Steel is selected, only Large and Small are available for Size
    expect(getVariantOptionValues(product, "Size", selected)).toEqual(["Large", "Small"]);
  });

  it("returns empty for null product", () => {
    expect(getVariantOptionValues(null, "Size")).toEqual([]);
  });
});

describe("isCompleteVariantSelection", () => {
  it("returns true when all options have values", () => {
    const product = {
      variants: [
        { option: "Size", value: "Large" },
        { option: "Colour", value: "Red" },
      ],
    };
    const selected = {
      Size: { option: "Size", value: "Large" },
      Colour: { option: "Colour", value: "Red" },
    };
    expect(isCompleteVariantSelection(product, selected)).toBe(true);
  });

  it("returns false when some options are missing", () => {
    const product = {
      variants: [
        { option: "Size", value: "Large" },
        { option: "Colour", value: "Red" },
      ],
    };
    const selected = {
      Size: { option: "Size", value: "Large" },
    };
    expect(isCompleteVariantSelection(product, selected)).toBe(false);
  });

  it("returns true for product with no variants", () => {
    expect(isCompleteVariantSelection({ variants: [] }, {})).toBe(true);
  });

  it("returns true for null product", () => {
    expect(isCompleteVariantSelection(null, null)).toBe(true);
  });
});
