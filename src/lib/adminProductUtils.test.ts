import { describe, it, expect } from "vitest";
import {
  normalizeVariantStock,
  normalizeVariantCustomFields,
  normalizeShippingNumber,
  shouldAutoGenerateVariantValue,
  buildVariantValueFromDimensions,
  stripCurrencyForAdmin,
  formatPriceForStorage,
  normalizeVariantPrice,
  normalizeVariantOptionName,
  slugifyVariantGroupKey,
  normalizeVariantOptionList,
  normalizeSpecifications,
  normalizeCombinationAttributes,
  isCombinationVariant,
  getVariantModeForProduct,
  buildCustomColumnKey,
  isCustomColumnKey,
  getDraftField,
  createEmptySizeVariant,
  createEmptyGeneralVariant,
  createSuggestedVariant,
  scaleWeight,
  getVariantSuggestion,
} from "@/lib/adminProductUtils";

// -- Variant field normalization --

describe("normalizeVariantStock", () => {
  it("parses valid integer", () => {
    expect(normalizeVariantStock(10)).toBe(10);
    expect(normalizeVariantStock("25")).toBe(25);
  });

  it("returns null for non-numeric", () => {
    expect(normalizeVariantStock("abc")).toBeNull();
    expect(normalizeVariantStock(null)).toBeNull();
    expect(normalizeVariantStock(undefined)).toBeNull();
    expect(normalizeVariantStock("")).toBeNull();
  });

  it("truncates floats to integer", () => {
    expect(normalizeVariantStock("5.9")).toBe(5);
  });
});

describe("normalizeVariantCustomFields", () => {
  it("normalizes valid object", () => {
    expect(normalizeVariantCustomFields({ weight: "5kg", colour: "red" })).toEqual({
      weight: "5kg",
      colour: "red",
    });
  });

  it("returns empty for null/undefined", () => {
    expect(normalizeVariantCustomFields(null)).toEqual({});
    expect(normalizeVariantCustomFields(undefined)).toEqual({});
  });

  it("returns empty for array", () => {
    expect(normalizeVariantCustomFields([1, 2, 3])).toEqual({});
  });

  it("filters out empty keys", () => {
    expect(normalizeVariantCustomFields({ "": "ghost", valid: "yes" })).toEqual({ valid: "yes" });
  });

  it("converts non-string values to strings", () => {
    expect(normalizeVariantCustomFields({ count: 42 })).toEqual({ count: "42" });
  });
});

describe("normalizeShippingNumber", () => {
  it("parses valid float", () => {
    expect(normalizeShippingNumber(5.5)).toBe(5.5);
    expect(normalizeShippingNumber("3.14")).toBe(3.14);
  });

  it("returns null for non-numeric", () => {
    expect(normalizeShippingNumber("abc")).toBeNull();
    expect(normalizeShippingNumber(null)).toBeNull();
    expect(normalizeShippingNumber("")).toBeNull();
  });
});

// -- Variant value auto-generation --

describe("shouldAutoGenerateVariantValue", () => {
  it("returns true for size-related options", () => {
    expect(shouldAutoGenerateVariantValue("Size")).toBe(true);
    expect(shouldAutoGenerateVariantValue("Canopy Measurement")).toBe(true);
    expect(shouldAutoGenerateVariantValue("Panel Size")).toBe(true);
    expect(shouldAutoGenerateVariantValue("Filter Size")).toBe(true);
  });

  it("returns false for non-size options", () => {
    expect(shouldAutoGenerateVariantValue("Colour")).toBe(false);
    expect(shouldAutoGenerateVariantValue("Material")).toBe(false);
  });

  it("handles null/undefined", () => {
    expect(shouldAutoGenerateVariantValue(null)).toBe(false);
    expect(shouldAutoGenerateVariantValue(undefined)).toBe(false);
  });
});

describe("buildVariantValueFromDimensions", () => {
  it("keeps sub-millimetre sizes in generated labels", () => {
    expect(buildVariantValueFromDimensions("Size", 0.01, 0.02, 0.99)).toBe('Size : H 0.2 x W 0.1 x D 9.9mm (0.0079" x 0.0039" x 0.3898")');
  });

  it("builds dimension string for size-like options", () => {
    const result = buildVariantValueFromDimensions("Size", 49.5, 24.5, 4.8);
    expect(result).toContain("Size :");
    expect(result).toContain("mm");
  });

  it("returns empty for non-size options", () => {
    expect(buildVariantValueFromDimensions("Colour", 10, 20, 30)).toBe("");
  });

  it("returns empty when dimensions are null", () => {
    expect(buildVariantValueFromDimensions("Size", null, null, null)).toBe("");
  });
});

// -- Price formatting --

describe("stripCurrencyForAdmin", () => {
  it("strips £ symbol", () => {
    expect(stripCurrencyForAdmin("£150.00")).toBe("150.00");
  });

  it("handles multiple £ symbols", () => {
    expect(stripCurrencyForAdmin("£1£50")).toBe("150");
  });

  it("returns empty for null/undefined", () => {
    expect(stripCurrencyForAdmin(null)).toBe("");
    expect(stripCurrencyForAdmin(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(stripCurrencyForAdmin("  £42  ")).toBe("42");
  });
});

describe("formatPriceForStorage", () => {
  it("formats plain number string", () => {
    expect(formatPriceForStorage("150")).toBe("£150.00");
  });

  it("formats value with £", () => {
    expect(formatPriceForStorage("£42.50")).toBe("£42.50");
  });

  it("handles commas", () => {
    expect(formatPriceForStorage("1,250.99")).toBe("£1250.99");
  });

  it("returns fallback for empty", () => {
    expect(formatPriceForStorage("", "£0.00")).toBe("£0.00");
  });

  it("returns empty string for empty with no fallback", () => {
    expect(formatPriceForStorage("")).toBe("");
  });

  it("returns raw value for unparseable with no fallback", () => {
    expect(formatPriceForStorage("abc")).toBe("abc");
  });
});

describe("normalizeVariantPrice", () => {
  it("returns stripped value when valid", () => {
    expect(normalizeVariantPrice("£150.00", "100")).toBe("150.00");
  });

  it("returns fallback when value is empty", () => {
    expect(normalizeVariantPrice("", "100")).toBe("100");
    expect(normalizeVariantPrice(null, "50")).toBe("50");
  });
});

describe("slugifyVariantGroupKey", () => {
  it("slugifies a label", () => {
    expect(slugifyVariantGroupKey("Canopy Length")).toBe("canopy-length");
  });

  it("handles special characters", () => {
    expect(slugifyVariantGroupKey("Size (mm)")).toBe("size-mm");
  });

  it("returns 'other' for empty input", () => {
    expect(slugifyVariantGroupKey("")).toBe("other");
  });
});

// -- Specifications --

describe("normalizeSpecifications", () => {
  it("returns object format as-is", () => {
    expect(normalizeSpecifications({ Material: "Steel", Weight: "5kg" })).toEqual({
      Material: "Steel",
      Weight: "5kg",
    });
  });

  it("normalizes legacy array format", () => {
    const legacy = [
      { key: "Material", value: "Steel" },
      { key: "Weight", value: "5kg" },
    ];
    expect(normalizeSpecifications(legacy)).toEqual({ Material: "Steel", Weight: "5kg" });
  });

  it("returns empty for null/undefined", () => {
    expect(normalizeSpecifications(null)).toEqual({});
    expect(normalizeSpecifications(undefined)).toEqual({});
  });

  it("returns empty for non-object", () => {
    expect(normalizeSpecifications("string")).toEqual({});
  });
});

// -- Combination variant helpers --

describe("normalizeCombinationAttributes", () => {
  it("normalizes attributes to match option names", () => {
    const result = normalizeCombinationAttributes(
      { Material: "Steel", Size: "Large", Extra: "ignored" },
      ["Material", "Size"],
    );
    expect(result).toEqual({ Material: "Steel", Size: "Large" });
  });

  it("fills missing options with empty string", () => {
    const result = normalizeCombinationAttributes({}, ["Material", "Size"]);
    expect(result).toEqual({ Material: "", Size: "" });
  });

  it("handles null value", () => {
    const result = normalizeCombinationAttributes(null, ["Size"]);
    expect(result).toEqual({ Size: "" });
  });
});

describe("isCombinationVariant (adminProductUtils)", () => {
  it("returns true for variant with non-empty attributes", () => {
    expect(isCombinationVariant({ attributes: { Material: "Steel" } })).toBe(true);
  });

  it("returns false for legacy variant", () => {
    expect(isCombinationVariant({ option: "Size", value: "Large" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCombinationVariant(null)).toBe(false);
  });
});

describe("getVariantModeForProduct (adminProductUtils)", () => {
  it("returns 'combination' for explicit mode", () => {
    expect(getVariantModeForProduct({ variant_mode: "combination" })).toBe("combination");
  });

  it("returns 'combination' when variants have attributes", () => {
    expect(getVariantModeForProduct({
      variants: [{ attributes: { Material: "Steel" } }],
    })).toBe("combination");
  });

  it("returns 'legacy' by default", () => {
    expect(getVariantModeForProduct({})).toBe("legacy");
  });
});

// -- Column management --

describe("buildCustomColumnKey", () => {
  it("builds a key from label", () => {
    expect(buildCustomColumnKey("Weight", [])).toBe("custom:weight");
  });

  it("avoids duplicates with suffix", () => {
    expect(buildCustomColumnKey("Weight", ["custom:weight"])).toBe("custom:weight_2");
  });

  it("sanitizes special characters", () => {
    expect(buildCustomColumnKey("Max Load (kg)", [])).toBe("custom:max_load_kg");
  });
});

describe("isCustomColumnKey", () => {
  it("returns true for custom: prefix", () => {
    expect(isCustomColumnKey("custom:weight")).toBe(true);
  });

  it("returns false for standard keys", () => {
    expect(isCustomColumnKey("price")).toBe(false);
    expect(isCustomColumnKey("stock")).toBe(false);
  });
});

// -- Misc helpers --

describe("getDraftField", () => {
  it("returns value when defined", () => {
    expect(getDraftField("hello", "default")).toBe("hello");
  });

  it("returns fallback when undefined", () => {
    expect(getDraftField(undefined, "default")).toBe("default");
  });

  it("returns value even when falsy (null, 0, empty)", () => {
    expect(getDraftField(null, "default")).toBeNull();
    expect(getDraftField(0, 99)).toBe(0);
    expect(getDraftField("", "default")).toBe("");
  });
});

describe("createEmptySizeVariant", () => {
  it("returns object with expected keys", () => {
    const empty = createEmptySizeVariant();
    expect(empty).toEqual({
      value: "",
      price: "",
      stock: "",
      shipping_weight_kg: "",
      shipping_length_cm: "",
      shipping_width_cm: "",
      shipping_height_cm: "",
      shipping_class: "standard",
      ships_separately: false,
      custom_fields: {},
    });
  });
});

describe("createEmptyGeneralVariant", () => {
  it("returns object with expected keys", () => {
    const empty = createEmptyGeneralVariant();
    expect(empty).toHaveProperty("option", "");
    expect(empty).toHaveProperty("value", "");
    expect(empty).toHaveProperty("price", "");
    expect(empty).toHaveProperty("stock", "");
    expect(empty).toHaveProperty("custom_fields");
  });
});

// -- Variant suggestion helpers --

describe("createSuggestedVariant", () => {
  it("creates variant with defaults", () => {
    const v = createSuggestedVariant("Size", "Large");
    expect(v.option).toBe("Size");
    expect(v.value).toBe("Large");
    expect(v.stock).toBeNull();
    expect(v.shipping_class).toBe("");
    expect(v.ships_separately).toBe(false);
  });

  it("applies overrides", () => {
    const v = createSuggestedVariant("Size", "Large", {
      shipping_class: "freight",
      ships_separately: true,
      shipping_weight_kg: 25,
    });
    expect(v.shipping_class).toBe("freight");
    expect(v.ships_separately).toBe(true);
    expect(v.shipping_weight_kg).toBe(25);
  });
});

describe("scaleWeight", () => {
  it("scales weight with multiplier", () => {
    expect(scaleWeight(10, 1.5)).toBe(15);
  });

  it("enforces minimum of 0.5", () => {
    expect(scaleWeight(0.1, 0.1)).toBe(0.5);
  });

  it("rounds to 3 decimal places", () => {
    expect(scaleWeight(1.111, 1.111)).toBe(1.234);
  });
});

describe("getVariantSuggestion", () => {
  it("returns filter suggestions for filter products", () => {
    const result = getVariantSuggestion({ name: "Canopy Grease Filter" });
    expect(result.option).toBe("Canopy Measurement");
    expect(result.variants.length).toBeGreaterThan(0);
    expect(result.variants[0].shipping_class).toBe("standard");
  });

  it("returns canopy suggestions for canopy products", () => {
    const result = getVariantSuggestion({ name: "Wall Mounted Canopy" });
    expect(result.option).toBe("Canopy Length");
    expect(result.variants[0].shipping_class).toBe("freight");
    expect(result.variants[0].ships_separately).toBe(true);
  });

  it("returns fan suggestions for fan products", () => {
    const result = getVariantSuggestion({ name: "Axial Fan" });
    expect(result.option).toBe("Fan Size");
  });

  it("returns generic suggestions for unknown products", () => {
    const result = getVariantSuggestion({ name: "Mystery Widget" });
    expect(result.option).toBe("Model");
    expect(result.variants.length).toBe(2);
  });

  it("uses product shipping dimensions as base", () => {
    const result = getVariantSuggestion({
      name: "Industrial Hood",
      shipping_weight_kg: 50,
    });
    expect(result.option).toBe("Canopy Length");
    // First variant uses 0.8 multiplier
    expect(result.variants[0].shipping_weight_kg).toBe(scaleWeight(50, 0.8));
  });
});

// -- normalizeVariantOptionList --

describe("normalizeVariantOptionList", () => {
  it("normalizes array of option names", () => {
    expect(normalizeVariantOptionList(["  Material  ", "Size"])).toEqual(["Material", "Size"]);
  });

  it("filters empty strings", () => {
    expect(normalizeVariantOptionList(["Material", "", "  "])).toEqual(["Material"]);
  });

  it("returns empty for non-array", () => {
    expect(normalizeVariantOptionList(null)).toEqual([]);
    expect(normalizeVariantOptionList("string")).toEqual([]);
  });
});

describe("normalizeVariantOptionName (adminProductUtils)", () => {
  it("trims whitespace", () => {
    expect(normalizeVariantOptionName("  Size  ")).toBe("Size");
  });

  it("handles null", () => {
    expect(normalizeVariantOptionName(null)).toBe("");
  });
});
