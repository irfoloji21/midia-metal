import {
  Heart,
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  Star,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Twitter,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useModalFocus } from '@/hooks/use-modal-focus';
import { apiFetch, ApiError } from "@/lib/api";
import { useReviewEligibility } from "@/lib/use-review-eligibility";
import { normalizeMediaUrl } from "@/lib/media";
import ProductImage from "@/components/ProductImage";
import { hasProductEditorial, insertProductSpecifications } from "@/lib/product-editorial";
import "@/product-editorial.css";
import { useStore } from "@nanostores/react";
import { addToCart } from "@/stores/cart";
import withErrorBoundary from "@/lib/withErrorBoundary";
import { $wishlist, addToWishlist, removeFromWishlist } from "@/stores/wishlist";
import { $customer, logoutCustomer } from "@/stores/auth";
import { toast } from "sonner";
import Breadcrumb from "@/components/Breadcrumb";
import SelectionTableSection from "@/components/product/SelectionTableSection";
import { formatMoneyValue, resolveSelectedVariantUnitPrice, getStandardizedDisplayPrice, getStandardizedDisplayTitle, shouldShowOldPrice, PRICE_ON_REQUEST_LABEL, getProductQuoteUrl } from "@/lib/pricing";
import { getAvailableStock, MAX_ORDER_QUANTITY } from "@/lib/stock";
import {
  buildVariantSizeSummary,
  findMatchingCombinationVariant,
  getVariantAttributes,
  getProductVariantMode,
  getVariantOptionNames,
  getVariantOptionValues,
  isCompleteVariantSelection,
  resolveSelectedVariantRecord,
} from "@/lib/variants";
import {
  getSelectionTableTabValues,
  normalizeFrontendVariantLayout,
  normalizeSelectionTableConfig,
} from "@/lib/selectionTable";
import type { Product, VariantTableSection, VariantTableColumn, VariantTableColumns } from "@/types/product";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.52 3.48A11.91 11.91 0 0 0 12.05 0C5.47 0 .11 5.35.1 11.94c0 2.1.55 4.15 1.6 5.96L0 24l6.25-1.64a11.94 11.94 0 0 0 5.8 1.48h.01C18.64 23.84 24 18.49 24 11.9c0-3.19-1.24-6.18-3.48-8.42ZM12.06 21.82a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.87 9.87 0 0 1-1.51-5.27c0-5.47 4.45-9.92 9.92-9.92a9.85 9.85 0 0 1 7.02 2.91 9.84 9.84 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.97 9.87Zm5.44-7.43c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.68-.51h-.57c-.2 0-.53.07-.8.37-.28.3-1.05 1.02-1.05 2.49s1.07 2.89 1.22 3.09c.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.11.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

// DOMPurify needs a DOM — only import on the client. Backend sanitizes on save,
// so SSR pass-through is safe. We lazy-load via dynamic import on first use.
let _purify: { sanitize: (html: string, opts?: Record<string, unknown>) => string } | null = null;

function ensurePurify(): void {
  if (_purify || typeof window === "undefined") return;
  import("dompurify").then((m) => { _purify = m.default; });
}

function sanitizeHtml(html: string): string {
  if (!_purify) return html; // SSR or not yet loaded — backend already sanitized
  return _purify.sanitize(html, { ADD_ATTR: ["target"], FORBID_TAGS: ["style"] });
}

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const cmToInches = (value: number): string => formatNumber(value / 2.54);

const formatSpecValue = (value: unknown): string => String(value ?? "").trim();
const formatVariantOptionLabel = (value: unknown): string => String(value ?? "").trim().replace(/([a-z])([A-Z0-9])/g, "$1 $2");
const stripVariantLabelPrefix = (value: unknown, label: string): string => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^${escapedLabel}\\s*:?\\s*`, "i"), "").trim() || text;
};

const dedupeSpecEntries = (entries: Array<[string, string]>): Array<[string, string]> => {
  const seen = new Set<string>();

  return entries.filter(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey || !String(value).trim() || seen.has(normalizedKey)) {
      return false;
    }

    seen.add(normalizedKey);
    return true;
  });
};

const normalizeProductSpecEntries = (specifications: unknown): Array<[string, string]> => {
  if (Array.isArray(specifications)) {
    return specifications.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const key = formatSpecValue((entry as Record<string, unknown>).key);
      const value = formatSpecValue((entry as Record<string, unknown>).value);
      return key && value ? [[key, value] as [string, string]] : [];
    });
  }

  if (specifications && typeof specifications === "object") {
    return Object.entries(specifications as Record<string, unknown>).flatMap(([key, value]) => {
      const normalizedKey = formatSpecValue(key);
      const normalizedValue = formatSpecValue(value);
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue] as [string, string]] : [];
    });
  }

  return [];
};

const DEFAULT_VARIANT_TABLE_COLUMNS: VariantTableColumns = {
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

const SIZE_RESERVED_COLUMN_KEYS = new Set(["value", "shipping_class", "ships_separately"]);

const normalizeVariantTableColumns = (value: unknown): VariantTableColumns => {
  if (!value || typeof value !== "object") {
    return {
      size: DEFAULT_VARIANT_TABLE_COLUMNS.size.map((column) => ({ ...column })),
      general: DEFAULT_VARIANT_TABLE_COLUMNS.general.map((column) => ({ ...column })),
      combination: DEFAULT_VARIANT_TABLE_COLUMNS.combination.map((column) => ({ ...column })),
    };
  }

  const provided = value as Partial<Record<VariantTableSection, VariantTableColumn[]>>;

  const normalizeSectionColumns = (
    section: VariantTableSection,
    defaults: VariantTableColumn[],
    providedColumns: VariantTableColumn[] | undefined,
  ) => {
    const safeProvided = Array.isArray(providedColumns) ? providedColumns : [];
    const defaultKeys = new Set(defaults.map((column) => column.key));
    const reservedKeys = section === "size" ? SIZE_RESERVED_COLUMN_KEYS : new Set<string>();

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

function ProductDetailIsland({ id, initialProduct, initialRelated }: { id: string; initialProduct?: any; initialRelated?: any[] }) {
  const wishlist = useStore($wishlist);
  const customer = useStore($customer);
  
  // Track hydration to avoid SSR mismatch for wishlist heart icon
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => { setIsHydrated(true); ensurePurify(); }, []);
  
  // Only check wishlist after hydration to avoid server/client mismatch
  const isInWishlist = (productId: number | string) => isHydrated && wishlist.some((w) => w.id === productId);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"description" | "reviews">("description");

  const [product, setProduct] = useState<any>(initialProduct || null);
  const [related, setRelated] = useState<any[]>(initialRelated || []);
  const [loading, setLoading] = useState(!initialProduct);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, any>>(() => {
    // Pre-compute initial variant selection from initialProduct if available
    if (!initialProduct?.variants?.length) return {};
    const prodRes = initialProduct;
    const variants: Record<string, any> = {};
    if (getProductVariantMode(prodRes) === "combination") {
      const productOptionNames = getVariantOptionNames(prodRes);
      productOptionNames.forEach((optionName) => {
        const values = getVariantOptionValues(prodRes, optionName, {});
        if (values.length === 1) {
          variants[optionName] = { option: optionName, value: values[0] };
        }
      });
    } else {
      const validVariants = prodRes.variants.filter((v: any) => v.price !== null && v.price !== undefined && String(v.price).trim() !== "");
      if (validVariants.length > 0) {
        const cheapest = validVariants.reduce((min: any, curr: any) => {
          const currPrice = parseFloat(String(curr.price).replace(/[^\d.-]/g, "")) || 0;
          const minPrice = parseFloat(String(min.price).replace(/[^\d.-]/g, "")) || 0;
          return currPrice < minPrice ? curr : min;
        }, validVariants[0]);
        variants[cheapest.option] = cheapest;
        const otherOptions = Array.from(new Set(prodRes.variants.map((v: any) => v.option))).filter(o => o !== cheapest.option);
        otherOptions.forEach(opt => {
          const firstMatch = prodRes.variants.find((v: any) => v.option === opt);
          if (firstMatch) variants[opt as string] = firstMatch;
        });
      } else {
        const allOptions = Array.from(new Set(prodRes.variants.map((v: any) => v.option)));
        allOptions.forEach(opt => {
          const firstMatch = prodRes.variants.find((v: any) => v.option === opt);
          if (firstMatch) variants[opt as string] = firstMatch;
        });
      }
    }
    return variants;
  });

  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<HTMLDivElement>(null);
  useModalFocus(isLightboxOpen, lightboxRef, () => setIsLightboxOpen(false));

  const { status: canReviewStatus, retry: retryReviewEligibility, markReviewed } = useReviewEligibility(id);

  const allImages = product ? [product.image, ...(product.gallery || [])].filter(Boolean).map((img: unknown) => normalizeMediaUrl(img)) : [];
  const variantMode = getProductVariantMode(product);
  const isCombinationMode = variantMode === "combination";
  const variantOptions = getVariantOptionNames(product);
  const variantGroups = variantOptions.map((option, optionIndex) => {
    const selectionScope = isCombinationMode
      ? Object.fromEntries(
        variantOptions
          .slice(0, optionIndex)
          .flatMap((optionName) => {
            const selectedValue = String(selectedVariants?.[optionName]?.value ?? "").trim();
            return selectedValue ? [[optionName, { option: optionName, value: selectedValue }]] : [];
          }),
      )
      : selectedVariants;
    const variants = getVariantOptionValues(product, option, selectionScope).map((value) => ({
      option,
      value,
    }));

    return {
      option,
      label: formatVariantOptionLabel(option),
      variants,
    };
  });
  const hasSelectableVariantChoices = variantGroups.some((group) => group.variants.length > 1);
  const fixedVariantSummaryEntries: Array<[string, string]> = variantGroups
    .filter((group) => group.variants.length === 1)
    .map((group) => {
      const onlyValue = group.variants[0]?.value ?? "";
      return [group.label, stripVariantLabelPrefix(onlyValue, group.label)] as [string, string];
    })
    .filter(([, value]) => Boolean(String(value ?? "").trim()));
  const variantTableColumns = normalizeVariantTableColumns(product?.variant_table_columns);
  const frontendVariantLayout = normalizeFrontendVariantLayout(product?.frontend_variant_layout);
  const selectionTableSourceKeys = [
    ...variantOptions,
    ...variantTableColumns.combination.map((column) => column.key),
  ];
  const selectionTableConfig = normalizeSelectionTableConfig(product?.selection_table_config, variantOptions, product?.variants || [], selectionTableSourceKeys);
  const selectionTableTabs = getSelectionTableTabValues(selectionTableConfig, product?.variants || []);
  const isSelectionTableMode = (
    !product?.price_on_request
    && frontendVariantLayout === "selection_table"
    && isCombinationMode
    && Boolean(selectionTableConfig.tab_option)
    && selectionTableTabs.length > 0
  );
  const generalColumnsByKey = new Map(variantTableColumns.general.map((column) => [column.key, column]));
  const selectedVariantList = Object.values(selectedVariants) as Array<Record<string, any>>;
  const resolvedSelectedVariant = resolveSelectedVariantRecord(product, selectedVariants);
  const selectedCombinationVariant = isCombinationMode
    ? (resolvedSelectedVariant ?? findMatchingCombinationVariant(product?.variants || [], selectedVariants, variantOptions))
    : null;
  const selectedSizeVariant = isCombinationMode
    ? selectedCombinationVariant
    : selectedVariantList.find(
      (variant) => String(variant?.option ?? "").trim().toLowerCase() === "size",
    ) ?? (String(resolvedSelectedVariant?.option ?? "").trim().toLowerCase() === "size" ? resolvedSelectedVariant : null);
  const selectedGeneralVariants = isCombinationMode
    ? []
    : (selectedVariantList.length > 0 ? selectedVariantList : (resolvedSelectedVariant ? [resolvedSelectedVariant] : [])).filter(
      (variant) => String(variant?.option ?? "").trim().toLowerCase() !== "size",
    );
  const selectedShippingVariant = isCombinationMode
    ? selectedCombinationVariant
    : selectedSizeVariant ?? selectedGeneralVariants[0] ?? resolvedSelectedVariant ?? null;
  const hasCompleteSelection = isCompleteVariantSelection(product, selectedVariants);
  const availableStock = product ? getAvailableStock({ ...product, selected_variants: selectedVariants }) : null;
  const selectedUnitPrice = product ? resolveSelectedVariantUnitPrice(product.price, selectedVariants, product) : null;
  const displayedUnitPrice = selectedUnitPrice ?? product?.price;
  const displayedTotalPrice = typeof displayedUnitPrice === "number"
    ? displayedUnitPrice * qty
    : displayedUnitPrice;
  const isOutOfStock = availableStock !== null && availableStock <= 0;
  const stockLabel = isSelectionTableMode && !selectedCombinationVariant
    ? "Stock: Choose a row below"
    : variantOptions.length > 0 && !hasCompleteSelection
    ? "Stock: Select options"
    : availableStock === null
    ? "Stock: Available"
    : isOutOfStock
      ? "Stock: Not available"
      : `Stock: ${availableStock}`;

  const getProductStockLabel = (item: any): string => {
    if (!item?.track_stock) return "Stock: Available";

    const quantity = Number(item.stock_quantity ?? 0);
    return quantity > 0 ? `Stock: ${quantity}` : "Stock: Out of stock";
  };
  const shareUrl = isHydrated && typeof window !== "undefined"
    ? new URL(window.location.pathname, window.location.origin).href
    : new URL(`/shop/${product?.slug || id}`, import.meta.env.SITE || 'https://midiammetal.com').href;
  const shareText = encodeURIComponent(`${product?.name || "Product"} | Midia M Metal`);
  const description = (product?.description || "").trim();
  const descriptionHasHtml = /<\/?[a-z][\s\S]*>/i.test(description);
  const hasEditorial = hasProductEditorial(description);
  const formatVariantColumnValue = (columnKey: string, variant: Record<string, any> | null): string => {
    if (!variant && !product) return "";

    const allowProductShippingFallback = variantOptions.length === 0;

    switch (columnKey) {
      case "price":
        return product?.price_on_request ? PRICE_ON_REQUEST_LABEL : formatMoneyValue(variant?.price ?? selectedUnitPrice ?? product?.price ?? "");
      case "stock": {
        const stockValue = variant?.stock ?? product?.stock_quantity;
        return stockValue === null || stockValue === undefined || stockValue === ""
          ? ""
          : String(stockValue);
      }
      case "shipping_weight_kg": {
        const weight = Number(
          variant?.shipping_weight_kg
          ?? (allowProductShippingFallback ? product?.shipping_weight_kg : null)
          ?? 0,
        );
        return weight > 0 ? `${formatNumber(weight)} kg` : "";
      }
      case "shipping_length_cm": {
        const length = Number(
          variant?.shipping_length_cm
          ?? (allowProductShippingFallback ? product?.shipping_length_cm : null)
          ?? 0,
        );
        return length > 0 ? `${formatNumber(length)} cm (${cmToInches(length)} in)` : "";
      }
      case "shipping_width_cm": {
        const width = Number(
          variant?.shipping_width_cm
          ?? (allowProductShippingFallback ? product?.shipping_width_cm : null)
          ?? 0,
        );
        return width > 0 ? `${formatNumber(width)} cm (${cmToInches(width)} in)` : "";
      }
      case "shipping_height_cm": {
        const height = Number(
          variant?.shipping_height_cm
          ?? (allowProductShippingFallback ? product?.shipping_height_cm : null)
          ?? 0,
        );
        return height > 0 ? `${formatNumber(height)} cm (${cmToInches(height)} in)` : "";
      }
      case "option":
        return formatSpecValue(variant?.option);
      case "value":
        return formatSpecValue(variant?.value);
      default: {
        if (!columnKey.startsWith("custom:")) {
          return "";
        }

        const customKey = columnKey.slice("custom:".length);
        return formatSpecValue(variant?.custom_fields?.[customKey]);
      }
    }
  };
  const showGeneralSelectionOnFrontend = Boolean(generalColumnsByKey.get("option")?.frontendVisible)
    && Boolean(generalColumnsByKey.get("value")?.frontendVisible);
  const selectedVariantSpecEntries: Array<[string, string]> = variantOptions.map((option) => {
    const selectedValue = selectedVariants[option]?.value;
    const normalizedOption = String(option ?? "").trim().toLowerCase();

    if (normalizedOption !== "size" && !showGeneralSelectionOnFrontend) {
      return null;
    }

    if (!selectedValue) {
      return null;
    }

    const label = normalizedOption === "size"
      ? "Size"
      : formatVariantOptionLabel(option);

    return [label, formatSpecValue(selectedValue)] as [string, string];
  }).filter((entry): entry is [string, string] => Boolean(entry));
  const resolvedVariantSummaryEntries: Array<[string, string]> = (() => {
    if (!resolvedSelectedVariant) {
      return [];
    }

    const attributeEntries = Object.entries(getVariantAttributes(resolvedSelectedVariant))
      .map(([option, value]) => [formatVariantOptionLabel(option), formatSpecValue(value)] as [string, string])
      .filter(([, value]) => Boolean(value));

    if (attributeEntries.length > 0) {
      return attributeEntries;
    }

    const option = formatSpecValue(resolvedSelectedVariant.option);
    const value = formatSpecValue(resolvedSelectedVariant.value);

    return option && value ? [[formatVariantOptionLabel(option), value]] : [];
  })();
  const selectedCombinationMetadataEntries: Array<[string, string]> = (() => {
    if (!isCombinationMode) {
      return [];
    }

    const sourceVariant = selectedCombinationVariant ?? resolvedSelectedVariant;
    if (!sourceVariant) {
      return [];
    }

    const explicitSizeEntry = Object.entries(getVariantAttributes(sourceVariant)).find(([key, value]) => (
      String(key).trim().toLowerCase() === "size" && Boolean(String(value ?? "").trim())
    ));

    if (explicitSizeEntry) {
      return [["Size", formatSpecValue(explicitSizeEntry[1])]];
    }

    const showDerivedDimensions = variantTableColumns.size.some((column) => (
      column.frontendVisible && ["shipping_length_cm", "shipping_width_cm", "shipping_height_cm"].includes(column.key)
    ));
    const derivedSize = showDerivedDimensions ? buildVariantSizeSummary(sourceVariant) : "";

    return derivedSize ? [["Size", derivedSize]] : [];
  })();
  const sizeFrontendSpecEntries: Array<[string, string]> = variantTableColumns.size.flatMap((column) => {
    if (!column.frontendVisible) {
      return [];
    }

    const sourceVariant = column.key.startsWith("custom:")
      ? selectedSizeVariant
      : selectedShippingVariant;
    const value = formatVariantColumnValue(column.key, sourceVariant);

    return value ? [[column.label, value] as [string, string]] : [];
  });
  const combinationFrontendSpecEntries: Array<[string, string]> = (
    selectedCombinationVariant
      ? variantTableColumns.combination
        .filter((column) => column.frontendVisible && column.key.startsWith("custom:"))
        .flatMap((column) => {
          const value = formatVariantColumnValue(column.key, selectedCombinationVariant);
          return value ? [[column.label, value] as [string, string]] : [];
        })
      : []
  );
  const generalStockColumn = generalColumnsByKey.get("stock");
  const generalFrontendCustomColumns = variantTableColumns.general.filter(
    (column) => column.frontendVisible && column.key.startsWith("custom:"),
  );
  const generalFrontendSpecEntries: Array<[string, string]> = selectedGeneralVariants.flatMap((variant) => {
    const optionLabel = String(variant?.option ?? "").trim().replace(/([a-z])([A-Z0-9])/g, "$1 $2");
    const labelPrefix = selectedGeneralVariants.length > 1 && optionLabel ? `${optionLabel} ` : "";
    const entries: Array<[string, string]> = [];

    if (generalStockColumn?.frontendVisible) {
      const stockValue = formatVariantColumnValue("stock", variant);
      if (stockValue) {
        entries.push([`${labelPrefix}${generalStockColumn.label}`, stockValue]);
      }
    }

    generalFrontendCustomColumns.forEach((column) => {
      const columnValue = formatVariantColumnValue(column.key, variant);
      if (columnValue) {
        entries.push([`${labelPrefix}${column.label}`, columnValue]);
      }
    });

    return entries;
  });
  const productSpecEntries = normalizeProductSpecEntries(product?.specifications);
  const shouldShowVariantSpecifications = Boolean(selectedShippingVariant)
    || selectedGeneralVariants.length > 0
    || selectedVariantSpecEntries.length > 0;

  const generatedSpecificationEntries: Array<[string, string]> = [
    ...productSpecEntries,
    ...(shouldShowVariantSpecifications ? [
      ...selectedVariantSpecEntries,
      ...sizeFrontendSpecEntries,
      ...combinationFrontendSpecEntries,
      ...generalFrontendSpecEntries,
    ] : []).map(([label, value]): [string, string] => [
      productSpecEntries.some(([key, staticValue]) => key.toLowerCase() === label.toLowerCase() && staticValue !== value)
        ? `${label} (selected variant)`
        : label,
      value,
    ]),
  ];
  const specificationEntries: Array<[string, string]> = dedupeSpecEntries(generatedSpecificationEntries);
  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`,
    whatsapp: `https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`,
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prodRes, relRes] = await Promise.all([
          apiFetch<Product>(`/v1/products/${id}`),
          apiFetch<Product[]>(`/v1/products/${id}/related`)
        ]);

        const initialVariants: Record<string, { option: string; value: string; price?: string | null }> = {};
        if (prodRes.variants && prodRes.variants.length > 0) {
          if (getProductVariantMode(prodRes) === "combination") {
            const productOptionNames = getVariantOptionNames(prodRes);
            productOptionNames.forEach((optionName) => {
              const values = getVariantOptionValues(prodRes, optionName, {});
              if (values.length === 1) {
                initialVariants[optionName] = {
                  option: optionName,
                  value: values[0],
                };
              }
            });
          } else {
            const validVariants = prodRes.variants.filter((v) => 'price' in v && v.price !== null && v.price !== undefined && String(v.price).trim() !== "");
            if (validVariants.length > 0) {
              const cheapest = validVariants.reduce((min, curr) => {
                const currPrice = parseFloat(String(curr.price).replace(/[^\d.-]/g, "")) || 0;
                const minPrice = parseFloat(String(min.price).replace(/[^\d.-]/g, "")) || 0;
                return currPrice < minPrice ? curr : min;
              }, validVariants[0]);

              const cheapestLegacy = cheapest as { option: string; value: string; price?: string | null };
              initialVariants[cheapestLegacy.option] = cheapestLegacy;

              const otherOptions = Array.from(new Set(prodRes.variants.map((v) => 'option' in v ? v.option : ''))).filter(o => o !== cheapestLegacy.option);
              otherOptions.forEach(opt => {
                const firstMatch = prodRes.variants!.find((v) => 'option' in v && v.option === opt);
                if (firstMatch && 'option' in firstMatch) initialVariants[opt as string] = firstMatch as { option: string; value: string; price?: string | null };
              });
            } else {
              const allOptions = Array.from(new Set(prodRes.variants.map((v) => 'option' in v ? v.option : '')));
              allOptions.forEach(opt => {
                const firstMatch = prodRes.variants!.find((v) => 'option' in v && v.option === opt);
                if (firstMatch && 'option' in firstMatch) initialVariants[opt as string] = firstMatch as { option: string; value: string; price?: string | null };
              });
            }
          }
          setSelectedVariants(initialVariants);
        } else {
          setSelectedVariants({});
        }

        setProduct(prodRes);
        setRelated(relRes.slice(0, 3));
      } catch (err) {
        console.error("Failed to load product", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      setMainImageIndex(0);
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    const cap = availableStock !== null
      ? Math.min(availableStock, MAX_ORDER_QUANTITY)
      : MAX_ORDER_QUANTITY;
    if (cap > 0 && qty > cap) {
      setQty(cap);
    }
  }, [availableStock, qty]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      toast.error("Please login to submit a review.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const data = await apiFetch(`/v1/customer/products/${id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment })
      });

      toast.success("Review submitted successfully!");
      setProduct({ ...product, reviews: [data, ...(product.reviews || [])] });
      markReviewed();
      setReviewComment("");
      setReviewRating(5);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review.");
      if (err instanceof ApiError && err.status === 401) logoutCustomer();
      else retryReviewEligibility();
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handlePurchaseAction = (mode: "add_to_basket" | "buy_now") => {
    if (product.price_on_request) {
      window.location.href = getProductQuoteUrl(product, selectedVariants);
      return;
    }
    const missingOptions = variantOptions
      .filter((option) => !selectedVariants[option]?.value)
      .map((option) => formatVariantOptionLabel(option));
    if (missingOptions.length > 0) {
      toast.error(`Please select ${missingOptions.join(", ")}.`);
      return;
    }

    if (isOutOfStock) {
      toast.error("This product is out of stock.");
      return;
    }

    if (availableStock !== null && qty > availableStock) {
      toast.error(`Only ${availableStock} unit(s) are in stock.`);
      setQty(availableStock);
      return;
    }

    if (qty > MAX_ORDER_QUANTITY) {
      toast.error(`Maximum order quantity is ${MAX_ORDER_QUANTITY}.`);
      setQty(MAX_ORDER_QUANTITY);
      return;
    }

    const cartProduct = {
      ...product,
      price: formatMoneyValue(selectedUnitPrice ?? product.price),
      selected_variants: selectedVariants,
      available_stock: availableStock,
    };

    addToCart(cartProduct, qty);

    if (mode === "buy_now") {
      toast.success("Added to basket. Proceeding to checkout.");
      window.location.href = "/checkout";
      return;
    }

    toast.success("Added to basket!");
  };

  const handleVariantSelectionChange = (option: string, nextValue: string) => {
    setSelectedVariants((prev) => {
      if (!product || !isCombinationMode) {
        const updated = { ...prev };
        if (!nextValue) {
          delete updated[option];
          return updated;
        }

        const selectedVariant = product?.variants?.find(
          (variant: any) => variant.option === option && variant.value === nextValue,
        );

        if (selectedVariant) {
          updated[option] = selectedVariant;
        }

        return updated;
      }

      const updated: Record<string, any> = {
        ...prev,
        [option]: { option, value: nextValue },
      };

      if (!nextValue) {
        delete updated[option];
      }

      const changedOptionIndex = variantOptions.indexOf(option);
      if (changedOptionIndex === -1) {
        return updated;
      }

      variantOptions.slice(changedOptionIndex + 1).forEach((optionName, relativeIndex) => {
        const optionIndex = changedOptionIndex + 1 + relativeIndex;
        const scopedSelections = Object.fromEntries(
          variantOptions
            .slice(0, optionIndex)
            .flatMap((scopedOptionName) => {
              const scopedValue = String(updated?.[scopedOptionName]?.value ?? "").trim();
              return scopedValue ? [[scopedOptionName, { option: scopedOptionName, value: scopedValue }]] : [];
            }),
        );

        const availableValues = getVariantOptionValues(product, optionName, scopedSelections);
        const currentValue = String(updated[optionName]?.value ?? "").trim();

        if (currentValue && availableValues.includes(currentValue)) {
          return;
        }

        if (availableValues.length === 1) {
          updated[optionName] = { option: optionName, value: availableValues[0] };
          return;
        }

        delete updated[optionName];
      });

      return updated;
    });
  };

  if (loading && !product) {
    return (
      <section className="container mx-auto px-4 lg:px-8 py-20 text-center">
        <p className="text-[#6e7a92]">Loading...</p>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="container mx-auto px-4 lg:px-8 py-20 text-center">
        <h1 className="text-3xl font-bold">Product not found.</h1>
      </section>
    );
  }

  return (
    <>
      <section className="container mx-auto px-4 lg:px-8 pt-12 md:pt-14 pb-10">
        <Breadcrumb
          className="mb-6"
          items={[
            { name: "Shop", href: "/shop" },
            ...(product.category?.slug ? [{ name: product.category.name, href: `/shop/category/${product.category.slug}` }] : []),
            { name: product.name },
          ]}
        />
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] gap-10 xl:gap-12 items-start">
          <div className="flex flex-col gap-4 max-w-[550px]">
            <div className="relative group bg-white border border-[#e1e5eb] p-8 flex items-center justify-center">
              <ProductImage src={allImages[mainImageIndex]} alt={product.name} className="w-full aspect-square" />
              <button
                aria-label="Enlarge product image"
                onClick={() => {
                  setLightboxIndex(mainImageIndex);
                  setIsLightboxOpen(true);
                }}
                className="absolute top-4 right-4 w-10 h-10 bg-white shadow-md rounded-full flex items-center justify-center text-primary transition-colors hover:bg-orange hover:text-white"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                {allImages.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    aria-label={`View product image ${idx + 1}`}
                    aria-pressed={idx === mainImageIndex}
                    onClick={() => setMainImageIndex(idx)}
                    className={`border-2 transition-colors overflow-hidden bg-white ${idx === mainImageIndex ? 'border-orange' : 'border-[#e1e5eb] hover:border-[#cad4e4]'}`}
                  >
                    <ProductImage src={img} alt={idx === 0 ? product.name : `${product.name} - image ${idx + 1}`} className="w-full aspect-square" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 pt-2">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-sans text-[30px] md:text-[40px] leading-[1] font-semibold text-[#10275c]">{getStandardizedDisplayTitle(product, selectedVariants)}</h1>
              <button
                onClick={() => {
                  if (isInWishlist(product.id)) {
                    removeFromWishlist(product.id);
                    toast.success("Removed from wishlist");
                  } else {
                    addToWishlist({ id: product.id, name: product.name, price: product.price, price_on_request: product.price_on_request, slug: product.slug, image: normalizeMediaUrl(product.image) });
                    toast.success("Added to wishlist!");
                  }
                }}
                className={`mt-1 shrink-0 w-[50px] h-[50px] rounded-full border transition-colors grid place-items-center ${isInWishlist(product.id) ? 'bg-red-50 border-orange text-orange' : 'border-[#d1dbe8] text-[#7f8ca5] hover:text-orange hover:border-orange'}`}
                title={isInWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart className={`w-5 h-5 ${isInWishlist(product.id) ? 'fill-orange' : ''}`} />
              </button>
            </div>
            {hasEditorial && (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
                {productSpecEntries.filter(([key]) => ["Motor power", "Supply", "Speed control"].includes(key)).map(([key, value]) => (
                  <div key={key} className="border border-[#d1dbe8] bg-white/60 p-4">
                    <dt className="text-[11px] text-[#6e7a92] uppercase tracking-wide mb-2">{key}</dt>
                    <dd className="text-sm text-primary font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex items-baseline gap-3 mt-3 mb-3">
              <p className="text-orange text-[28px] md:text-[34px] leading-none font-medium">
                {product.price_on_request ? PRICE_ON_REQUEST_LABEL : formatMoneyValue(displayedTotalPrice)}
              </p>
              {!product.price_on_request && qty > 1 && (
                <p className="text-[#6e7a92] text-[13px] md:text-[15px] font-medium">
                  {formatMoneyValue(displayedUnitPrice)} each
                </p>
              )}
              {!product.price_on_request && shouldShowOldPrice(product.old_price, displayedUnitPrice) && (
                <p className="text-[#9aa6bc] text-[20px] md:text-[24px] line-through font-normal">
                  {product.old_price}
                </p>
              )}
            </div>
            {product.price_on_request ? (
              <p className="mb-4 text-sm text-[#6e7a92]">Request a quotation based on your required dimensions, material and specification.</p>
            ) : (
              <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#6e7a92]">VAT included</p>
            )}

            <div className="flex items-center gap-3 flex-wrap mb-3">
              {product.price_on_request && (
                <a href={getProductQuoteUrl(product, selectedVariants)} className="min-h-[50px] px-8 py-3 bg-orange text-white text-sm font-semibold inline-flex items-center hover:bg-orange-hover transition-colors">
                  Request a quote
                </a>
              )}
              {!product.price_on_request && !isSelectionTableMode && (
                <>
                  <div>
                    <div className="w-[118px] h-[50px] border border-[#cad4e4] flex items-center px-5 bg-[#eaf0f3]">
                      <span className="text-base text-primary">{qty}</span>
                      <div className="ml-auto flex flex-col">
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => setQty((currentQty) => {
                            const cap = availableStock !== null
                              ? Math.min(availableStock, MAX_ORDER_QUANTITY)
                              : MAX_ORDER_QUANTITY;
                            return Math.min(currentQty + 1, cap);
                          })}
                          disabled={isOutOfStock || qty >= (availableStock !== null ? Math.min(availableStock, MAX_ORDER_QUANTITY) : MAX_ORDER_QUANTITY)}
                          className="text-[#7f8ca5] hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => setQty((currentQty) => Math.max(1, currentQty - 1))}
                          className="text-[#7f8ca5] hover:text-primary"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchaseAction("add_to_basket")}
                    disabled={isOutOfStock}
                    className="h-[50px] px-8 border border-[#d1dbe8] bg-white text-primary text-sm font-semibold inline-flex items-center gap-2 hover:border-orange hover:text-orange transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to basket
                  </button>

                  <button
                    onClick={() => handlePurchaseAction("buy_now")}
                    disabled={isOutOfStock}
                    className="h-[50px] px-10 bg-orange text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-orange-hover transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Buy now
                  </button>
                </>
              )}

            </div>
            {!product.price_on_request && !isSelectionTableMode && (
              <p className="mb-8 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6e7a92]">
                {stockLabel}
              </p>
            )}

            <div className="space-y-2 text-[12px] md:text-[14px]">
              <>
                {Array.isArray(product.tags) && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag: string, index: number) => (
                      <span
                        key={`${tag}-${index}`}
                        className="inline-flex items-center rounded-full border border-[#d7e0eb] bg-white/70 px-3 py-1 text-[11px] font-medium text-[#6e7a92] md:text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p>
                  <span className="font-semibold text-primary">SKU:</span>{" "}
                  <span className="text-[#6e7a92]">{product.id}</span>
                </p>
                {product.product_code && (
                  <p>
                    <span className="font-semibold text-primary">Product Code:</span>{" "}
                    <span className="text-[#6e7a92]">{product.product_code}</span>
                  </p>
                )}
                {!isSelectionTableMode &&
                  dedupeSpecEntries([
                    ...fixedVariantSummaryEntries,
                    ...selectedCombinationMetadataEntries,
                    ...(!hasSelectableVariantChoices ? resolvedVariantSummaryEntries : []),
                  ]).map(([label, value]) => (
                    <p key={`${label}-${value}`}>
                      <span className="font-semibold text-primary">{label}:</span>{" "}
                      <span className="text-[#6e7a92]">{stripVariantLabelPrefix(value, label)}</span>
                    </p>
                  ))}
              </>

              {/* Variants Selection */}
              {!isSelectionTableMode && hasSelectableVariantChoices && product.variants && product.variants.length > 0 && (
                variantGroups.filter(({ variants }) => variants.length > 1).map(({ option, label, variants }) => {
                  const selectedValue = selectedVariants[option]?.value || variants[0]?.value || "";
                  const singleValueText = stripVariantLabelPrefix(selectedValue, label);
                  const hasSingleValue = variants.length === 1;

                  return (
                    <div key={option} className="mt-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <label htmlFor={`variant-${encodeURIComponent(option)}`} className="font-semibold text-primary text-[13px] md:text-[14px] capitalize shrink-0 sm:w-[120px]">
                        {label}:
                      </label>
                      <div className="relative flex-1 md:max-w-[420px]">
                        {hasSingleValue ? (
                          <p className="text-[13px] md:text-[14px] font-medium text-primary">{singleValueText}</p>
                        ) : (
                          <>
                            <select
                              id={`variant-${encodeURIComponent(option)}`}
                              value={selectedVariants[option]?.value || ""}
                              onChange={(e) => handleVariantSelectionChange(option, e.target.value)}
                              className="w-full h-12 appearance-none border border-[#d1dbe8] bg-[#f8fafc] px-4 pr-10 text-[13px] md:text-[14px] font-medium text-primary outline-none transition-all hover:border-[#b4c4d4] focus:border-orange focus:bg-white focus:ring-1 focus:ring-orange cursor-pointer"
                            >
                              <option value="">Select {label}</option>
                              {variants.map((variant: any, idx: number) => (
                                <option key={idx} value={variant.value}>
                                  {variant.value}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95ac] pointer-events-none" />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {isSelectionTableMode && (
                <SelectionTableSection
                  product={product}
                  variantOptions={variantOptions}
                  selectedVariants={selectedVariants}
                  setSelectedVariants={setSelectedVariants}
                  selectionTableConfig={selectionTableConfig}
                  combinationColumns={variantTableColumns.combination}
                  embedded
                />
              )}

              <div className={`flex items-center gap-3 ${isSelectionTableMode ? "pt-6" : "pt-2"}`}>
                <span className="shrink-0 font-semibold text-primary">Share:</span>
                <div className="flex shrink-0 items-center gap-2">
                  {[
                    { key: "facebook", href: shareLinks.facebook, Icon: Facebook, label: "Share on Facebook" },
                    { key: "twitter", href: shareLinks.twitter, Icon: Twitter, label: "Share on Twitter" },
                    { key: "whatsapp", href: shareLinks.whatsapp, Icon: WhatsAppIcon, label: "Share on WhatsApp" },
                  ].map(({ key, href, Icon, label }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="w-9 h-9 rounded-full border border-[#d1dbe8] bg-white text-[#6e7a92] grid place-items-center transition-colors hover:border-orange hover:text-orange"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section >

      <section className="container mx-auto px-4 lg:px-8 pb-14">
        <div className={`grid grid-cols-1 ${specificationEntries.length > 0 && !hasEditorial ? "xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]" : ""} gap-10 xl:gap-12 items-start`}>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-0 mb-10">
              <button
                onClick={() => setTab("description")}
                className={`w-[170px] md:w-[220px] h-[48px] md:h-[52px] text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${tab === "description"
                  ? "bg-[#f4f5f7] text-primary border-t-2 border-primary"
                  : "bg-[#f4f5f7] text-primary/70 hover:text-primary"
                  }`}
              >
                Description
              </button>
              <button
                onClick={() => setTab("reviews")}
                className={`w-[170px] md:w-[220px] h-[48px] md:h-[52px] text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${tab === "reviews"
                  ? "bg-[#f4f5f7] text-primary border-t-2 border-primary"
                  : "bg-[#f4f5f7] text-primary/70 hover:text-primary"
                  }`}
              >
                Reviews ({product.reviews?.length || 0})
              </button>
            </div>

            {tab === "description" ? (
              <div className="w-full">
                {description ? (
                  descriptionHasHtml ? (
                    hasEditorial ? <div className="product-story" dangerouslySetInnerHTML={{ __html: sanitizeHtml(insertProductSpecifications(description, specificationEntries)) }} /> : <div
                      className="prose prose-sm max-w-none text-[#6e7a92] leading-7 prose-p:my-3 prose-headings:text-primary prose-strong:text-primary prose-a:text-orange prose-a:no-underline hover:prose-a:underline prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-blockquote:border-orange prose-blockquote:text-[#5f6f8d] prose-ul:list-disc prose-ol:list-decimal [&_table]:w-full [&_table]:border-separate [&_table]:[border-spacing:18px_0] [&_td]:align-top [&_td]:pr-4 [&_td]:pb-3 [&_th]:align-top [&_th]:pr-4 [&_th]:pb-3 [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
                    />
                  ) : (
                    <p className="text-[13px] md:text-[14px] text-[#6e7a92] leading-7 whitespace-pre-wrap">
                      {description}
                    </p>
                  )
                ) : (
                  <p className="text-[13px] md:text-[14px] text-[#6e7a92] leading-7">No description provided.</p>
                )}
              </div>
            ) : (
              <div className="w-full">
                <div className="mb-12">
                  <h3 className="text-xl font-semibold text-primary mb-6">Write a review</h3>
                  {canReviewStatus === "loading" ? (
                    <p className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm animate-pulse">Checking eligibility...</p>
                  ) : canReviewStatus === "error" ? (
                    <div role="alert" className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm">
                      <p>We could not check your review eligibility. Please try again.</p>
                      <button type="button" onClick={retryReviewEligibility} className="mt-3 font-semibold text-primary underline">Try again</button>
                    </div>
                  ) : canReviewStatus === "unauthenticated" ? (
                    <p className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm">
                      You must be <a href="/login" className="text-orange underline">logged in</a> and have purchased this product to write a review.
                    </p>
                  ) : canReviewStatus === "not_purchased" ? (
                    <p className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm">
                      You can only write a review for this product if you have purchased it.
                    </p>
                  ) : canReviewStatus === "not_delivered" ? (
                    <p className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm">
                      You can write a review once your order has been delivered or collected.
                    </p>
                  ) : canReviewStatus === "not_paid" ? (
                    <p className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm">
                      A paid order is required to review this product. Orders awaiting payment or with a refund status are not eligible.
                    </p>
                  ) : canReviewStatus === "order_cancelled" ? (
                    <p className="text-[#6e7a92] bg-[#f4f5f7] p-4 text-sm">Reviews are not available for cancelled orders.</p>
                  ) : canReviewStatus === "already_reviewed" ? (
                    <p className="text-[#6e7a92] bg-[#eaf0f3] p-4 text-sm font-medium">
                      You have already reviewed this product. Thank you for your feedback!
                    </p>
                  ) : canReviewStatus === "allowed" ? (
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm text-[#6e7a92] mb-2 font-medium">Your Rating</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              aria-label={`Rate ${star} out of 5`}
                              onClick={() => setReviewRating(star)}
                              className={`hover:scale-110 transition-transform ${star <= reviewRating ? 'text-orange' : 'text-gray-300'}`}
                            >
                              <Star className={`w-6 h-6 ${star <= reviewRating ? 'fill-orange' : ''}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="product-review-comment" className="block text-sm text-[#6e7a92] mb-2 font-medium">Your Review (Optional)</label>
                        <textarea
                          id="product-review-comment"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="w-full h-32 border border-[#d1dbe8] bg-[#f8fafc] p-4 text-sm focus:outline-none focus:border-orange resize-none"
                          placeholder="Share your thoughts about this product..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="h-12 px-8 bg-primary text-white font-semibold flex items-center justify-center hover:bg-orange transition-colors disabled:opacity-50"
                      >
                        {isSubmittingReview ? "Submitting..." : "Submit Review"}
                      </button>
                    </form>
                  ) : null}
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-primary mb-6">Customer Reviews</h3>
                  {(!product.reviews || product.reviews.length === 0) ? (
                    <p className="text-[15px] text-[#6e7a92]">No reviews yet. Be the first to review this product!</p>
                  ) : (
                    product.reviews.map((review: any) => (
                      <div key={review.id} className="border-b border-[#efefef] pb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-primary text-[15px]">
                            {review.customer?.name}
                          </span>
                          <span className="text-xs text-[#9aa6bc]">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${star <= review.rating ? 'fill-orange text-orange' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        {review.comment && (
                          <p className="text-[14px] text-[#6e7a92] leading-relaxed">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {specificationEntries.length > 0 && !hasEditorial && (
            <aside className="min-w-0">
              <div className="overflow-hidden rounded border border-[#d5deea] bg-white">
                <div className="border-b border-[#d5deea] px-8 py-6">
                  <h3 className="font-sans text-[24px] md:text-[28px] font-semibold text-primary">Specifications</h3>
                </div>
                <div>
                  {specificationEntries.map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[42%_58%] border-b border-[#d5deea] last:border-b-0">
                      <div className="bg-[#f7f8fa] px-8 py-5 text-[16px] md:text-[18px] font-semibold text-primary">
                        {key}
                      </div>
                      <div className="px-8 py-5 text-[16px] md:text-[18px] text-[#4b5565]">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-8 pb-24">
        <h2 className="font-sans text-[34px] md:text-[46px] leading-none font-semibold text-[#10275c] mb-10">Related products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {related.map((p) => (
            <a
              href={`/shop/${p.slug || p.id}`}
              key={p.id}
              className="group"
            >
              <div className="mb-5 bg-[#f7f8fa] border border-[#d5deea]">
                      <ProductImage src={p.image} alt={p.name} className="w-full aspect-[1.02]" imageClassName="transition-transform duration-300 group-hover:scale-[1.02]" />
              </div>
              <h3 className="font-sans text-[18px] md:text-[20px] leading-tight font-semibold text-orange">
                {getStandardizedDisplayTitle(p)}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-[18px] md:text-[20px] leading-none font-semibold text-[#1f2f52]">{getStandardizedDisplayPrice(p)}</p>
                  {shouldShowOldPrice(p.old_price, getStandardizedDisplayPrice(p)) && (
                    <p className="text-[14px] md:text-[16px] text-[#9aa6bc] line-through font-normal">
                      {p.old_price}
                    </p>
                  )}
                </div>
                <p className="text-[13px] md:text-[15px] font-medium text-[#5e6e8c]">
                  {getProductStockLabel(p)}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Lightbox Modal */}
      {
        isLightboxOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12 cursor-pointer"
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label="Product gallery"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setLightboxIndex(index => (index + (event.key === 'ArrowLeft' ? -1 : 1) + allImages.length) % allImages.length);
              }
            }}
            onClick={() => setIsLightboxOpen(false)}
          >
            <button
              aria-label="Close product gallery"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-50 p-2 cursor-pointer"
            >
              <X className="w-10 h-10" />
            </button>

            <div
              className="relative w-full max-w-[1400px] h-full flex flex-col items-center justify-center cursor-default bg-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              {allImages.length > 1 && (
                <button
                  aria-label="Previous product image"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1)); }}
                  className="absolute left-2 md:left-0 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-[60] cursor-pointer backdrop-blur-sm"
                >
                  <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                </button>
              )}

              <img
                src={allImages[lightboxIndex]}
                alt={product.name}
                className="max-w-full max-h-[92vh] object-contain select-none shadow-2xl"
              />

              {allImages.length > 1 && (
                <button
                  aria-label="Next product image"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0)); }}
                  className="absolute right-2 md:right-0 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-[60] cursor-pointer backdrop-blur-sm"
                >
                  <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                </button>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm tracking-widest">
                {lightboxIndex + 1} / {allImages.length}
              </div>
            )}
          </div>
        )
      }
    </>
  );
}

export default withErrorBoundary(ProductDetailIsland, "ProductDetail");
