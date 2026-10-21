// ---------------------------------------------------------------------------
// Admin product utility functions — extracted from AdminProducts.tsx
// Pure functions with no React or component dependencies
// ---------------------------------------------------------------------------

import type { VariantTableSection, VariantTableColumn, VariantTableColumns, VariantSuggestion } from "@/types/product";

// -- Variant field normalization ---------------------------------------------

export const normalizeVariantStock = (value: unknown): number | null => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeVariantCustomFields = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([key, fieldValue]) => [key, String(fieldValue ?? "")])
            .filter(([key]) => key.trim() !== ""),
    );
};

export const normalizeShippingNumber = (value: unknown): number | null => {
    const parsed = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : null;
};

// -- Variant value auto-generation -------------------------------------------

export const shouldAutoGenerateVariantValue = (option: unknown): boolean => {
    const normalized = String(option ?? "").trim().toLowerCase();
    return normalized.includes("size") || normalized.includes("measurement") || normalized.includes("panel") || normalized.includes("filter");
};

export const buildVariantValueFromDimensions = (
    option: unknown,
    lengthCm: unknown,
    widthCm: unknown,
    heightCm: unknown,
): string => {
    if (!shouldAutoGenerateVariantValue(option)) return "";

    const length = normalizeShippingNumber(lengthCm);
    const width = normalizeShippingNumber(widthCm);
    const height = normalizeShippingNumber(heightCm);

    if (length === null || width === null || height === null) {
        return "";
    }

    const widthMm = Math.round(length * 10);
    const heightMm = Math.round(width * 10);
    const depthMm = Math.round(height * 10);

    const widthInches = Math.round(widthMm / 25);
    const heightInches = Math.round(heightMm / 25);
    const depthInches = Math.round(depthMm / 25);

    return `Size : H ${heightMm} x W ${widthMm} x D ${depthMm}mm (${heightInches}" x ${widthInches}" x ${depthInches}")`;
};

// -- Price formatting --------------------------------------------------------

export const stripCurrencyForAdmin = (value: unknown): string =>
    String(value ?? "").replace(/£/g, "").trim();

export const formatPriceForStorage = (value: unknown, fallback = ""): string => {
    const raw = stripCurrencyForAdmin(value);
    if (!raw) return fallback;

    const normalized = raw.replace(/,/g, "");
    const parsed = Number.parseFloat(normalized);

    if (!Number.isFinite(parsed)) {
        return fallback || raw;
    }

    return `£${parsed.toFixed(2)}`;
};

export const normalizeVariantPrice = (value: unknown, fallbackPrice: string): string => {
    const normalized = stripCurrencyForAdmin(value);
    return normalized || fallbackPrice;
};

export const normalizeVariantOptionName = (value: unknown): string => String(value ?? "").trim();

/** Create a stable, lowercase key from a group label (for collapsible group state). */
export const slugifyVariantGroupKey = (label: string): string =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";

// -- Variant option list normalization ---------------------------------------

export const normalizeVariantOptionList = (value: unknown): string[] => (
    Array.isArray(value)
        ? value.map((option) => normalizeVariantOptionName(option)).filter(Boolean)
        : []
);

// -- Specifications normalization --------------------------------------------

/**
 * Specifications are stored in two formats in the DB:
 *   - Correct:  { "Key": "Value", ... }          (plain object / associative array)
 *   - Legacy:   [{ key: "Key", value: "Value" }]  (array of key-value pairs)
 * This normalises both to the plain-object format the admin UI expects.
 */
export const normalizeSpecifications = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== "object") return {};
    if (Array.isArray(value)) {
        const result: Record<string, string> = {};
        for (const item of value) {
            if (item && typeof item === "object" && "key" in item && "value" in item) {
                result[String((item as any).key)] = String((item as any).value);
            }
        }
        return result;
    }
    return value as Record<string, string>;
};

// -- Combination variant helpers ---------------------------------------------

export const normalizeCombinationAttributes = (
    value: unknown,
    optionNames: string[],
): Record<string, string> => {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

    return Object.fromEntries(
        optionNames.map((optionName) => [optionName, String(source[optionName] ?? "")]),
    );
};

export const isCombinationVariant = (variant: any): boolean => {
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
        return false;
    }

    return Object.keys(variant.attributes || {}).some((key) => normalizeVariantOptionName(key));
};

export const getVariantModeForProduct = (product: any): "legacy" | "combination" => {
    const explicitMode = String(product?.variant_mode ?? "").trim().toLowerCase();
    if (explicitMode === "combination") {
        return "combination";
    }

    return (product?.variants || []).some((variant: any) => isCombinationVariant(variant))
        ? "combination"
        : "legacy";
};

// -- Variant mapping (admin ↔ storage) ---------------------------------------

export const mapVariantsToProductPrice = (variants: any[] = [], productPrice: string) =>
    variants
        .filter((variant) => variant?.option && variant?.value)
        .map((variant) => ({
            ...variant,
            option: String(variant.option).trim(),
            value: buildVariantValueFromDimensions(
                variant.option,
                variant.shipping_length_cm,
                variant.shipping_width_cm,
                variant.shipping_height_cm,
            ) || String(variant.value).trim(),
            price: String(variant.option ?? "").toLowerCase() === "size"
                ? normalizeVariantPrice(variant.price, productPrice)
                : (variant.price || null),
            stock: normalizeVariantStock(variant.stock),
            shipping_weight_kg: normalizeShippingNumber(variant.shipping_weight_kg),
            shipping_length_cm: normalizeShippingNumber(variant.shipping_length_cm),
            shipping_width_cm: normalizeShippingNumber(variant.shipping_width_cm),
            shipping_height_cm: normalizeShippingNumber(variant.shipping_height_cm),
            shipping_class: typeof variant.shipping_class === "string" ? variant.shipping_class : "",
            ships_separately: Boolean(variant.ships_separately),
            custom_fields: normalizeVariantCustomFields(variant.custom_fields),
        }));

export const mapVariantsForStorage = (variants: any[] = [], productPrice: string) =>
    variants
        .filter((variant) => variant?.option && variant?.value)
        .map((variant) => {
            const isSize = String(variant.option ?? "").toLowerCase() === "size";
            return {
                ...variant,
                option: String(variant.option).trim(),
                value: buildVariantValueFromDimensions(
                    variant.option,
                    variant.shipping_length_cm,
                    variant.shipping_width_cm,
                    variant.shipping_height_cm,
                ) || String(variant.value).trim(),
                price: isSize
                    ? formatPriceForStorage(variant.price, productPrice)
                    : (variant.price || null),
                stock: normalizeVariantStock(variant.stock),
                shipping_weight_kg: normalizeShippingNumber(variant.shipping_weight_kg),
                shipping_length_cm: normalizeShippingNumber(variant.shipping_length_cm),
                shipping_width_cm: normalizeShippingNumber(variant.shipping_width_cm),
                shipping_height_cm: normalizeShippingNumber(variant.shipping_height_cm),
                shipping_class: typeof variant.shipping_class === "string" ? variant.shipping_class : "",
                ships_separately: Boolean(variant.ships_separately),
                custom_fields: normalizeVariantCustomFields(variant.custom_fields),
            };
        });

export const createEmptyCombinationVariant = (optionNames: string[] = []) => ({
    attributes: Object.fromEntries(optionNames.map((optionName) => [optionName, ""])),
    price: "",
    stock: "",
    shipping_weight_kg: "",
    shipping_length_cm: "",
    shipping_width_cm: "",
    shipping_height_cm: "",
    shipping_class: "",
    ships_separately: false,
    custom_fields: {},
});

export const mapCombinationVariantsToAdmin = (
    variants: any[] = [],
    productPrice: string,
    optionNames: string[],
) => variants
    .map((variant) => ({
        ...variant,
        attributes: normalizeCombinationAttributes(
            isCombinationVariant(variant)
                ? variant.attributes
                : (variant?.option && variant?.value ? { [String(variant.option).trim()]: String(variant.value).trim() } : {}),
            optionNames,
        ),
        price: normalizeVariantPrice(variant.price, productPrice),
        stock: normalizeVariantStock(variant.stock),
        shipping_weight_kg: normalizeShippingNumber(variant.shipping_weight_kg),
        shipping_length_cm: normalizeShippingNumber(variant.shipping_length_cm),
        shipping_width_cm: normalizeShippingNumber(variant.shipping_width_cm),
        shipping_height_cm: normalizeShippingNumber(variant.shipping_height_cm),
        shipping_class: typeof variant.shipping_class === "string" ? variant.shipping_class : "",
        ships_separately: Boolean(variant.ships_separately),
        custom_fields: normalizeVariantCustomFields(variant.custom_fields),
    }));

export const mapCombinationVariantsForStorage = (
    variants: any[] = [],
    productPrice: string,
    optionNames: string[],
) => variants
    .map((variant) => ({
        ...variant,
        attributes: normalizeCombinationAttributes(variant.attributes, optionNames),
        price: formatPriceForStorage(variant.price, productPrice),
        stock: normalizeVariantStock(variant.stock),
        shipping_weight_kg: normalizeShippingNumber(variant.shipping_weight_kg),
        shipping_length_cm: normalizeShippingNumber(variant.shipping_length_cm),
        shipping_width_cm: normalizeShippingNumber(variant.shipping_width_cm),
        shipping_height_cm: normalizeShippingNumber(variant.shipping_height_cm),
        shipping_class: typeof variant.shipping_class === "string" ? variant.shipping_class : "",
        ships_separately: Boolean(variant.ships_separately),
        custom_fields: normalizeVariantCustomFields(variant.custom_fields),
    }))
    .filter((variant) => optionNames.every((optionName) => String(variant.attributes?.[optionName] ?? "").trim()));

// -- Shipping class options --------------------------------------------------

export const SHIPPING_CLASS_OPTIONS = [
    { value: "standard", label: "Standard" },
    { value: "freight", label: "Freight (Pallet)" },
];

// -- Variant table column config ---------------------------------------------

export const DEFAULT_VARIANT_TABLE_COLUMNS: VariantTableColumns = {
    size: [
        { key: "price", label: "Price", visible: true, frontendVisible: false },
        { key: "stock", label: "Stock", visible: true, frontendVisible: false },
        { key: "shipping_weight_kg", label: "Weight (kg)", visible: true, frontendVisible: true },
        { key: "shipping_length_cm", label: "Length (cm)", visible: true, frontendVisible: true },
        { key: "shipping_width_cm", label: "Width (cm)", visible: true, frontendVisible: true },
        { key: "shipping_height_cm", label: "Height (cm)", visible: true, frontendVisible: true },
    ],
    general: [
        { key: "option", label: "Option", visible: true, frontendVisible: true },
        { key: "value", label: "Value", visible: true, frontendVisible: true },
        { key: "stock", label: "Stock", visible: true, frontendVisible: false },
    ],
    combination: [],
};

export const FIXED_SIZE_COLUMNS: VariantTableColumn[] = [
    { key: "shipping_class", label: "Delivery Type", visible: true, frontendVisible: true },
    { key: "ships_separately", label: "Own Parcel", visible: true, frontendVisible: true },
];
export const HIDDEN_SIZE_COLUMN_KEYS = new Set(["value"]);
export const FIXED_SIZE_COLUMN_KEYS = new Set(FIXED_SIZE_COLUMNS.map((column) => column.key));

export const buildCustomColumnKey = (label: string, existingKeys: string[]) => {
    const base = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "column";

    let candidate = `custom:${base}`;
    let suffix = 2;

    while (existingKeys.includes(candidate)) {
        candidate = `custom:${base}_${suffix}`;
        suffix += 1;
    }

    return candidate;
};

export const isCustomColumnKey = (key: string) => key.startsWith("custom:");

export const cloneVariantTableColumns = (columns: VariantTableColumns): VariantTableColumns => ({
    size: columns.size.map((column) => ({ ...column })),
    general: columns.general.map((column) => ({ ...column })),
    combination: (columns.combination || []).map((column) => ({ ...column })),
});

export const normalizeVariantTableColumns = (value: unknown): VariantTableColumns => {
    if (!value || typeof value !== "object") {
        return cloneVariantTableColumns(DEFAULT_VARIANT_TABLE_COLUMNS);
    }

    const provided = value as Partial<Record<VariantTableSection, VariantTableColumn[]>>;

    const normalizeSectionColumns = (
        section: VariantTableSection,
        defaults: VariantTableColumn[],
        providedColumns: VariantTableColumn[] | undefined,
    ) => {
        const safeProvided = Array.isArray(providedColumns) ? providedColumns : [];
        const defaultKeys = new Set(defaults.map((column) => column.key));
        const reservedKeys = section === "size"
            ? new Set([...FIXED_SIZE_COLUMN_KEYS, ...HIDDEN_SIZE_COLUMN_KEYS])
            : new Set<string>();
        const normalizedDefaults = defaults.map((defaultColumn) => {
            const candidate = safeProvided.find((column) => column?.key === defaultColumn.key);
            return {
                ...defaultColumn,
                label: String(candidate?.label ?? defaultColumn.label).trim() || defaultColumn.label,
                visible: typeof candidate?.visible === "boolean" ? candidate.visible : defaultColumn.visible,
                frontendVisible: typeof candidate?.frontendVisible === "boolean"
                    ? candidate.frontendVisible
                    : defaultColumn.frontendVisible,
            };
        });
        const customColumns = safeProvided
            .filter((column) => (
                column
                && typeof column.key === "string"
                && !defaultKeys.has(column.key)
                && !reservedKeys.has(column.key)
            ))
            .map((column) => ({
                key: column.key,
                label: String(column.label ?? "").trim() || "Custom Column",
                visible: typeof column.visible === "boolean" ? column.visible : true,
                frontendVisible: typeof column.frontendVisible === "boolean" ? column.frontendVisible : true,
            }));

        return [...normalizedDefaults, ...customColumns];
    };

    return {
        size: normalizeSectionColumns("size", DEFAULT_VARIANT_TABLE_COLUMNS.size, provided.size),
        general: normalizeSectionColumns("general", DEFAULT_VARIANT_TABLE_COLUMNS.general, provided.general),
        combination: normalizeSectionColumns("combination", DEFAULT_VARIANT_TABLE_COLUMNS.combination, provided.combination),
    };
};

// -- Misc helpers ------------------------------------------------------------

export const getDraftField = <T,>(value: unknown, fallback: T): T => value === undefined ? fallback : value as T;

export const createEmptySizeVariant = () => ({
    value: "",
    price: "",
    stock: "",
    shipping_weight_kg: "",
    shipping_length_cm: "",
    shipping_width_cm: "",
    shipping_height_cm: "",
    shipping_class: "standard",
    ships_separately: false, // derived from shipping_class at save time
    custom_fields: {},
});

export const createEmptyGeneralVariant = () => ({
    option: "",
    value: "",
    price: "",
    stock: "",
    custom_fields: {} as Record<string, string>,
});

// -- Variant suggestion helpers ----------------------------------------------

export const createSuggestedVariant = (
    option: string,
    value: string,
    overrides: Record<string, any> = {},
) => ({
    option,
    value,
    stock: null,
    shipping_weight_kg: null,
    shipping_length_cm: null,
    shipping_width_cm: null,
    shipping_height_cm: null,
    shipping_class: "",
    ships_separately: false,
    ...overrides,
});

export const scaleWeight = (baseWeight: number, multiplier: number) =>
    Math.max(0.5, Math.round(baseWeight * multiplier * 1000) / 1000);

export const getVariantSuggestion = (product: any): VariantSuggestion => {
    const name = String(product?.name || "").toLowerCase();
    const baseWeight = normalizeShippingNumber(product?.shipping_weight_kg) ?? 2;
    const baseWidth = normalizeShippingNumber(product?.shipping_width_cm) ?? 20;
    const baseHeight = normalizeShippingNumber(product?.shipping_height_cm) ?? 10;

    if (name.includes("filter")) {
        const option = "Canopy Measurement";
        return {
            option,
            description: "Suggested filter sizes with shipping dimensions matching the selected panel size.",
            variants: [
                createSuggestedVariant(option, 'H 245 x W 495 x D 48mm (10" x 20" x 2")', {
                    shipping_weight_kg: 2.8,
                    shipping_length_cm: 49.5,
                    shipping_width_cm: 24.5,
                    shipping_height_cm: 4.8,
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, 'H 445 x W 445 x D 48mm (18" x 18" x 2")', {
                    shipping_weight_kg: 4.6,
                    shipping_length_cm: 44.5,
                    shipping_width_cm: 44.5,
                    shipping_height_cm: 4.8,
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, 'H 395 x W 495 x D 48mm (16" x 20" x 2")', {
                    shipping_weight_kg: 4.5,
                    shipping_length_cm: 49.5,
                    shipping_width_cm: 39.5,
                    shipping_height_cm: 4.8,
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, 'H 395 x W 395 x D 48mm (16" x 16" x 2")', {
                    shipping_weight_kg: 3.7,
                    shipping_length_cm: 39.5,
                    shipping_width_cm: 39.5,
                    shipping_height_cm: 4.8,
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, 'H 495 x W 495 x D 48mm (20" x 20" x 2")', {
                    shipping_weight_kg: 5.3,
                    shipping_length_cm: 49.5,
                    shipping_width_cm: 49.5,
                    shipping_height_cm: 4.8,
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, 'H 495 x W 395 x D 48mm (20" x 16" x 2")', {
                    shipping_weight_kg: 4.6,
                    shipping_length_cm: 49.5,
                    shipping_width_cm: 39.5,
                    shipping_height_cm: 4.8,
                    shipping_class: "standard",
                }),
            ],
        };
    }

    if (name.includes("canopy") || name.includes("hood")) {
        const option = "Canopy Length";
        return {
            option,
            description: "Starter canopy sizes. Adjust lengths and shipping dimensions to your actual fabricated sizes.",
            variants: [
                createSuggestedVariant(option, "1800mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 0.8),
                    shipping_length_cm: 180,
                    shipping_width_cm: baseWidth,
                    shipping_height_cm: baseHeight,
                    shipping_class: "freight",
                    ships_separately: true,
                }),
                createSuggestedVariant(option, "2400mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1),
                    shipping_length_cm: 240,
                    shipping_width_cm: baseWidth,
                    shipping_height_cm: baseHeight,
                    shipping_class: "freight",
                    ships_separately: true,
                }),
                createSuggestedVariant(option, "3000mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1.2),
                    shipping_length_cm: 300,
                    shipping_width_cm: baseWidth,
                    shipping_height_cm: baseHeight,
                    shipping_class: "freight",
                    ships_separately: true,
                }),
            ],
        };
    }

    if (name.includes("fan")) {
        const option = "Fan Size";
        return {
            option,
            description: "Suggested diameter-based variants for fan products.",
            variants: [
                createSuggestedVariant(option, "250mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 0.7),
                    shipping_length_cm: 45,
                    shipping_width_cm: 45,
                    shipping_height_cm: 35,
                    shipping_class: "freight",
                    ships_separately: true,
                }),
                createSuggestedVariant(option, "315mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 0.9),
                    shipping_length_cm: 55,
                    shipping_width_cm: 55,
                    shipping_height_cm: 40,
                    shipping_class: "freight",
                    ships_separately: true,
                }),
                createSuggestedVariant(option, "400mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1.1),
                    shipping_length_cm: 70,
                    shipping_width_cm: 70,
                    shipping_height_cm: 50,
                    shipping_class: "freight",
                    ships_separately: true,
                }),
            ],
        };
    }

    if (name.includes("light")) {
        const option = "Length";
        return {
            option,
            description: "Suggested length variants for light bars and lighting units.",
            variants: [
                createSuggestedVariant(option, "600mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 0.8),
                    shipping_length_cm: 60,
                    shipping_width_cm: Math.max(10, baseWidth),
                    shipping_height_cm: Math.max(8, baseHeight),
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, "900mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1),
                    shipping_length_cm: 90,
                    shipping_width_cm: Math.max(10, baseWidth),
                    shipping_height_cm: Math.max(8, baseHeight),
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, "1200mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1.2),
                    shipping_length_cm: 120,
                    shipping_width_cm: Math.max(10, baseWidth),
                    shipping_height_cm: Math.max(8, baseHeight),
                    shipping_class: "standard",
                    ships_separately: true,
                }),
            ],
        };
    }

    if (name.includes("feet")) {
        const option = "Height";
        return {
            option,
            description: "Suggested height variants for adjustable feet.",
            variants: [
                createSuggestedVariant(option, "100mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 0.8),
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, "150mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1),
                    shipping_class: "standard",
                }),
                createSuggestedVariant(option, "200mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1.2),
                    shipping_class: "standard",
                }),
            ],
        };
    }

    if (name.includes("sheet") || name.includes("panel") || name.includes("cladding")) {
        const option = "Panel Size";
        return {
            option,
            description: "Starter panel sizes. These ship as pallet freight.",
            variants: [
                createSuggestedVariant(option, "1000 x 2000mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 0.8),
                    shipping_length_cm: 200,
                    shipping_width_cm: 100,
                    shipping_height_cm: Math.max(1, baseHeight),
                    shipping_class: "freight",
                    ships_separately: true,
                }),
                createSuggestedVariant(option, "1250 x 2500mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1),
                    shipping_length_cm: 250,
                    shipping_width_cm: 125,
                    shipping_height_cm: Math.max(1, baseHeight),
                    shipping_class: "freight",
                    ships_separately: true,
                }),
                createSuggestedVariant(option, "1500 x 3000mm", {
                    shipping_weight_kg: scaleWeight(baseWeight, 1.25),
                    shipping_length_cm: 300,
                    shipping_width_cm: 150,
                    shipping_height_cm: Math.max(1, baseHeight),
                    shipping_class: "freight",
                    ships_separately: true,
                }),
            ],
        };
    }

    if (name.includes("disk")) {
        const option = "Diameter";
        return {
            option,
            description: "Suggested diameter variants for disk products.",
            variants: [
                createSuggestedVariant(option, "200mm", { shipping_class: "standard" }),
                createSuggestedVariant(option, "250mm", { shipping_class: "standard" }),
                createSuggestedVariant(option, "300mm", { shipping_class: "standard" }),
            ],
        };
    }

    return {
        option: "Model",
        description: "Generic starter variant. Rename and replace values to match the real product range.",
        variants: [
            createSuggestedVariant("Model", "Standard", { shipping_class: product?.shipping_class || "standard" }),
            createSuggestedVariant("Model", "Large", { shipping_class: product?.shipping_class || "standard" }),
        ],
    };
};
