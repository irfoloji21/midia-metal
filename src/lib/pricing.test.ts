import { describe, it, expect } from "vitest";
import {
  parseMoneyValue,
  formatMoneyValue,
  resolveSelectedVariantUnitPrice,
  getStandardizedDisplayPrice,
  getStandardizedDisplayTitle,
} from "@/lib/pricing";

describe("parseMoneyValue", () => {
  it("parses a plain number", () => {
    expect(parseMoneyValue(150)).toBe(150);
  });

  it("rounds to 2 decimal places", () => {
    expect(parseMoneyValue(19.999)).toBe(20);
    expect(parseMoneyValue(19.994)).toBe(19.99);
  });

  it("parses a string with £ symbol", () => {
    expect(parseMoneyValue("£150.00")).toBe(150);
  });

  it("parses a string with commas", () => {
    expect(parseMoneyValue("£1,250.99")).toBe(1250.99);
  });

  it("parses a plain numeric string", () => {
    expect(parseMoneyValue("42.50")).toBe(42.5);
  });

  it("returns null for empty string", () => {
    expect(parseMoneyValue("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseMoneyValue(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseMoneyValue(undefined)).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseMoneyValue("abc")).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(parseMoneyValue(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(parseMoneyValue(Infinity)).toBeNull();
  });

  it("handles negative values", () => {
    expect(parseMoneyValue("-5.50")).toBe(-5.5);
  });

  it("handles zero", () => {
    expect(parseMoneyValue(0)).toBe(0);
    expect(parseMoneyValue("0")).toBe(0);
    expect(parseMoneyValue("£0.00")).toBe(0);
  });
});

describe("formatMoneyValue", () => {
  it("formats a number as £XX.XX", () => {
    expect(formatMoneyValue(150)).toBe("£150.00");
  });

  it("formats a string with £ symbol", () => {
    expect(formatMoneyValue("£42.50")).toBe("£42.50");
  });

  it("formats zero", () => {
    expect(formatMoneyValue(0)).toBe("£0.00");
  });

  it("returns original string for non-parseable values", () => {
    expect(formatMoneyValue("N/A")).toBe("N/A");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatMoneyValue(null)).toBe("");
    expect(formatMoneyValue(undefined)).toBe("");
  });

  it("formats with correct decimal places", () => {
    expect(formatMoneyValue(9.9)).toBe("£9.90");
    expect(formatMoneyValue(100)).toBe("£100.00");
  });
});

describe("resolveSelectedVariantUnitPrice", () => {
  it("returns base price when no variants selected", () => {
    expect(resolveSelectedVariantUnitPrice("£100.00", null, null)).toBe(100);
  });

  it("returns base price when empty variants selected", () => {
    expect(resolveSelectedVariantUnitPrice("£100.00", {}, [])).toBe(100);
  });

  it("returns null when base price is invalid and no variants", () => {
    expect(resolveSelectedVariantUnitPrice("abc", null, null)).toBeNull();
  });

  it("returns size variant price when available (legacy mode)", () => {
    const selected = {
      Size: { option: "Size", value: "Large", price: "£200.00" },
    };
    expect(resolveSelectedVariantUnitPrice("£100.00", selected, [])).toBe(200);
  });

  it("falls back to first variant with price (legacy mode)", () => {
    const selected = {
      Colour: { option: "Colour", value: "Red", price: "£180.00" },
    };
    expect(resolveSelectedVariantUnitPrice("£100.00", selected, [])).toBe(180);
  });

  it("falls back to base when no variant has price (legacy mode)", () => {
    const selected = {
      Colour: { option: "Colour", value: "Red" },
    };
    expect(resolveSelectedVariantUnitPrice("£100.00", selected, [])).toBe(100);
  });

  it("uses combination variant price when mode is combination", () => {
    const variants = [
      { attributes: { Material: "Steel", Size: "Large" }, price: "£250.00" },
      { attributes: { Material: "Aluminium", Size: "Small" }, price: "£180.00" },
    ];
    const selected = {
      Material: { option: "Material", value: "Steel" },
      Size: { option: "Size", value: "Large" },
    };
    const product = { variant_mode: "combination", variant_options: ["Material", "Size"], variants };
    expect(resolveSelectedVariantUnitPrice("£100.00", selected, product)).toBe(250);
  });

  it("falls back to base when combination variant not matched", () => {
    const variants = [
      { attributes: { Material: "Steel", Size: "Large" }, price: "£250.00" },
    ];
    const selected = {
      Material: { option: "Material", value: "Plastic" },
      Size: { option: "Size", value: "Large" },
    };
    const product = { variant_mode: "combination", variant_options: ["Material", "Size"], variants };
    expect(resolveSelectedVariantUnitPrice("£100.00", selected, product)).toBe(100);
  });
});

describe("getStandardizedDisplayPrice", () => {
  it("returns £0.00 for null product", () => {
    expect(getStandardizedDisplayPrice(null)).toBe("£0.00");
  });

  it("returns base price when no variants", () => {
    expect(getStandardizedDisplayPrice({ price: "£150.00" })).toBe("£150.00");
  });

  it("returns min variant price when variants exist", () => {
    const product = {
      price: "£200.00",
      variants: [
        { price: "£150.00" },
        { price: "£180.00" },
        { price: "£120.00" },
      ],
    };
    expect(getStandardizedDisplayPrice(product)).toBe("£120.00");
  });

  it("falls back to base price when no variant has valid price", () => {
    const product = {
      price: "£200.00",
      variants: [{ option: "Colour", value: "Red" }],
    };
    expect(getStandardizedDisplayPrice(product)).toBe("£200.00");
  });

  it("returns raw string when price is not parseable", () => {
    expect(getStandardizedDisplayPrice({ price: "POA" })).toBe("POA");
  });
});

describe("getStandardizedDisplayTitle", () => {
  it('converts only product-detail legacy title text while keeping shared callers and selections unchanged', () => {
    const variant = { option: 'Size', value: 'Size : H 500 x W 1000 x D 200mm (20" x 40" x 8")', price: '£10.00', shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20 };
    const product = { name: 'Panel', show_variant_in_title: true, variants: [variant] };
    const selection = { Size: { option: 'Size', value: variant.value } };
    expect(getStandardizedDisplayTitle(product, selection, 'm')).toBe('Panel - Size : H 0.5 x W 1 x D 0.2m (20" x 40" x 8")');
    expect(getStandardizedDisplayTitle(product, null, 'cm')).toBe('Panel - Size : H 50 x W 100 x D 20cm (20" x 40" x 8")');
    expect(getStandardizedDisplayTitle(product, selection)).toBe(`Panel - ${variant.value}`);
    expect(selection.Size.value).toBe(variant.value);
  });

  it('uses the selected unit for derived combination titles and preserves explicit Size attributes', () => {
    const variant = { attributes: { Finish: 'Brushed' }, price: '£10.00', shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20 };
    const product = { name: 'Panel', show_variant_in_title: true, variant_mode: 'combination', variant_options: ['Finish'], variants: [variant] };
    expect(getStandardizedDisplayTitle(product, null, 'm')).toBe('Panel - Brushed / H 0.5 x W 1 x D 0.2m (20" x 40" x 8")');
    expect(getStandardizedDisplayTitle(product)).toBe('Panel - Brushed / H 500 x W 1000 x D 200mm (20" x 40" x 8")');
    const custom = { ...product, variant_options: ['Size'], variants: [{ ...variant, attributes: { Size: 'Custom 500mm' } }] };
    expect(getStandardizedDisplayTitle(custom, null, 'm')).toBe('Panel - Custom 500mm');
  });

  it("returns empty string for null product", () => {
    expect(getStandardizedDisplayTitle(null)).toBe("");
  });

  it("returns name without append when show_variant_in_title is false", () => {
    expect(getStandardizedDisplayTitle({ name: "Canopy Hood", show_variant_in_title: false })).toBe("Canopy Hood");
  });

  it("appends size variant value when active and show_variant_in_title is true", () => {
    const product = { name: "Canopy Hood", show_variant_in_title: true, variants: [] };
    const activeVariantMap = { Size: { option: "Size", value: "1800mm" } };
    expect(getStandardizedDisplayTitle(product, activeVariantMap)).toBe("Canopy Hood - 1800mm");
  });

  it("does not append when active variant is not size-like", () => {
    const product = { name: "Filter", show_variant_in_title: true, variants: [] };
    const activeVariantMap = { Colour: { option: "Colour", value: "Red" } };
    expect(getStandardizedDisplayTitle(product, activeVariantMap)).toBe("Filter");
  });

  it("appends cheapest size variant from legacy mode when no active map", () => {
    const product = {
      name: "Canopy Hood",
      show_variant_in_title: true,
      variants: [
        { option: "Size", value: "2400mm", price: "£500.00" },
        { option: "Size", value: "1800mm", price: "£400.00" },
      ],
    };
    expect(getStandardizedDisplayTitle(product)).toBe("Canopy Hood - 1800mm");
  });
});
