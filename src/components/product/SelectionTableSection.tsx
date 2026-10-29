import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { addToCart } from "@/stores/cart";
import { $customer } from "@/stores/auth";
import { clampQuantityToStock, getAvailableStock, MAX_ORDER_QUANTITY } from "@/lib/stock";
import { formatMoneyValue } from "@/lib/pricing";
import {
  buildSelectedVariantsFromCombination,
  getVariantAttributes,
  type SelectedVariantMap,
} from "@/lib/variants";
import {
  getSelectionTableTabConfig,
  getSelectionTableTabValues,
  getSelectionTableVariantValue,
  isSelectionTableCustomKey,
  type SelectionTableConfig,
} from "@/lib/selectionTable";

type VariantTableColumn = {
  key: string;
  label: string;
  visible: boolean;
  frontendVisible: boolean;
};

type Props = {
  product: any;
  variantOptions: string[];
  selectedVariants: Record<string, any>;
  setSelectedVariants: Dispatch<SetStateAction<Record<string, any>>>;
  selectionTableConfig: SelectionTableConfig;
  combinationColumns: VariantTableColumn[];
  embedded?: boolean;
};

const formatVariantOptionLabel = (value: unknown): string =>
  String(value ?? "").trim().replace(/([a-z])([A-Z0-9])/g, "$1 $2");

const buildCombinationVariantKey = (variant: Record<string, any>, optionNames: string[]): string => {
  const attributes = getVariantAttributes(variant);
  return optionNames.map((optionName) => `${optionName}:${attributes[optionName] ?? ""}`).join("|");
};

const formatCustomFieldValue = (variant: Record<string, any>, columnKey: string): string => {
  const customKey = columnKey.startsWith("custom:") ? columnKey.slice("custom:".length) : "";
  return customKey ? String(variant?.custom_fields?.[customKey] ?? "").trim() : "";
};

const parseQuantityInput = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_ORDER_QUANTITY) : 1;
};

const isPartNumberLabel = (label: string): boolean => /part\s*number/i.test(label);

const createQuoteFormState = (customer: any, productName: string) => ({
  name: customer?.name || "",
  companyName: "",
  email: customer?.email || "",
  postcode: "",
  phone: customer?.phone || "",
  filterType: productName || "",
  filterHeight: "",
  filterWidth: "",
  filterDepth: "",
  quantity: "",
  message: "",
});

export default function SelectionTableSection({
  product,
  variantOptions,
  selectedVariants,
  setSelectedVariants,
  selectionTableConfig,
  combinationColumns,
  embedded = false,
}: Props) {
  const customer = useStore($customer);
  const [activeTab, setActiveTab] = useState("");
  const [rowQuantities, setRowQuantities] = useState<Record<string, number>>({});
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [quoteForm, setQuoteForm] = useState(() => createQuoteFormState(customer, product?.name || ""));
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);

  const tabOption = selectionTableConfig.tab_option;
  const tabs = getSelectionTableTabValues(selectionTableConfig, product?.variants || []);
  const tabKey = tabs.join("||");
  const isTabAttributeSource = Boolean(tabOption) && !isSelectionTableCustomKey(tabOption);
  const tabSourceLabel = isTabAttributeSource
    ? formatVariantOptionLabel(tabOption)
    : combinationColumns.find((column) => column.key === tabOption)?.label || "Category";
  const safeActiveTab = tabs.includes(activeTab)
    ? activeTab
    : selectionTableConfig.default_tab && tabs.includes(selectionTableConfig.default_tab)
      ? selectionTableConfig.default_tab
      : tabs[0] || "";
  const activeTabConfig = getSelectionTableTabConfig(selectionTableConfig, safeActiveTab);
  const isQuoteTab = Boolean(safeActiveTab) && activeTabConfig.mode === "quote";
  const isCallTab = Boolean(safeActiveTab) && activeTabConfig.mode === "call";
  const rowAttributeOptions = isTabAttributeSource
    ? variantOptions.filter((optionName) => optionName !== tabOption)
    : variantOptions;
  const activeRows = Array.isArray(product?.variants)
    ? product.variants.filter((variant: Record<string, any>) => getSelectionTableVariantValue(variant, tabOption) === safeActiveTab)
    : [];
  const frontendColumns = combinationColumns.filter((column) => column.frontendVisible);
  const selectedVariantKey = variantOptions
    .map((optionName) => `${optionName}:${String(selectedVariants?.[optionName]?.value ?? "").trim()}`)
    .join("|");
  const contactPhone = siteSettings.contact_phone || "";
  const quotePhoneLabel = contactPhone || "+44 123 456 7890";
  const activeTabIntroText = activeTabConfig.intro_text || (isQuoteTab ? selectionTableConfig.quote_intro_text : "");
  const showPriceColumn = !isCallTab && activeRows.some((variant: Record<string, any>) => {
    const priceLabel = formatMoneyValue(variant?.price ?? product?.price ?? "");
    return Boolean(String(priceLabel).trim());
  });
  const hasGroupedAttributeHeader = rowAttributeOptions.length > 1;
  const attributeGroupLabel = useMemo(() => {
    if (!hasGroupedAttributeHeader) {
      return "";
    }

    const joinedLabels = rowAttributeOptions.join(" ").toLowerCase();
    return /(size|actual|inch|inches|mm|width|height|length|depth|ot)/.test(joinedLabels)
      ? "Size"
      : "Details";
  }, [hasGroupedAttributeHeader, rowAttributeOptions]);
  const tabButtonClass = embedded
    ? "min-h-[42px] rounded-t-[12px] px-3 py-2 text-[13px] md:min-w-[172px]"
    : "min-h-[64px] rounded-t-[18px] px-6 py-4 text-[17px] md:min-w-[240px]";
  const panelClass = embedded
    ? "overflow-hidden rounded-[16px] rounded-tl-none border border-[#cad4e4] bg-white shadow-[0_12px_28px_rgba(16,39,92,0.07)]"
    : "overflow-hidden rounded-[22px] rounded-tl-none border border-[#cad4e4] bg-white shadow-[0_20px_60px_rgba(16,39,92,0.08)]";
  const headingWrapClass = embedded
    ? "border-b border-[#cad4e4] bg-primary px-4 pb-2 pt-4 text-center text-white"
    : "border-b border-[#cad4e4] bg-primary px-6 pb-4 pt-8 text-center text-white";
  const headingTextClass = embedded
    ? "text-[17px] font-semibold tracking-[-0.03em] md:text-[22px]"
    : "text-[24px] font-semibold tracking-[-0.03em] md:text-[34px]";
  const headerGroupCellClass = embedded
    ? "border-b border-white/10 px-3 py-2 text-center text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] whitespace-nowrap"
    : "border-b border-white/10 px-6 py-5 text-center text-[17px] font-semibold uppercase tracking-[0.12em]";
  const headerCellClass = embedded
    ? "px-3 py-2 text-center text-[11px] font-semibold leading-tight whitespace-nowrap"
    : "px-6 py-5 text-center text-[16px] font-semibold";
  const headerSubCellClass = embedded
    ? "px-3 pb-2 text-center text-[11px] font-semibold leading-tight whitespace-nowrap"
    : "px-6 pb-5 text-center text-[16px] font-semibold";
  const cartHeaderClass = embedded
    ? "px-2 py-2 text-center"
    : "px-6 py-5 text-center";
  const bodyCellClass = embedded
    ? "border-t border-[#e3eaf2] px-3 py-3 text-center text-[13px] font-medium leading-tight text-primary whitespace-nowrap"
    : "border-t border-[#e3eaf2] px-6 py-7 text-center text-[18px] font-medium text-primary";
  const customBodyCellClass = embedded
    ? "border-t border-[#e3eaf2] px-3 py-3 text-center text-[13px] leading-tight whitespace-nowrap"
    : "border-t border-[#e3eaf2] px-6 py-7 text-center text-[18px]";
  const priceCellClass = embedded
    ? "border-t border-[#e3eaf2] px-3 py-3 text-center text-[14px] font-semibold leading-tight text-primary whitespace-nowrap"
    : "border-t border-[#e3eaf2] px-6 py-7 text-center text-[19px] font-semibold text-primary";
  const actionCellClass = embedded
    ? "border-t border-[#e3eaf2] px-2 py-2"
    : "border-t border-[#e3eaf2] px-6 py-5";
  const quantityInputClass = embedded
    ? "h-[36px] w-[46px] border border-[#cad4e4] bg-white px-2 text-[14px] text-primary outline-none transition-colors focus:border-orange"
    : "h-[56px] w-[84px] border border-[#cad4e4] bg-white px-4 text-[18px] text-primary outline-none transition-colors focus:border-orange";
  const cartButtonClass = embedded
    ? "inline-flex h-[36px] w-[36px] items-center justify-center border border-orange bg-orange text-white transition-colors hover:bg-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex h-[56px] w-[68px] items-center justify-center border border-orange bg-orange text-white transition-colors hover:bg-orange-hover disabled:cursor-not-allowed disabled:opacity-50";

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await apiFetch("/v1/settings");
        if (cancelled || !Array.isArray(response)) {
          return;
        }

        const mapped = response.reduce((acc: Record<string, string>, setting: any) => {
          acc[String(setting?.key ?? "")] = String(setting?.value ?? "");
          return acc;
        }, {});

        setSiteSettings(mapped);
      } catch (error) {
        console.error("Failed to load selection table settings", error);
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setQuoteForm(createQuoteFormState(customer, product?.name || ""));
    setRowQuantities({});
  }, [customer, product?.id]);

  useEffect(() => {
    setActiveTab((prev) => {
      if (tabs.includes(prev)) {
        return prev;
      }

      if (selectionTableConfig.default_tab && tabs.includes(selectionTableConfig.default_tab)) {
        return selectionTableConfig.default_tab;
      }

      return tabs[0] || "";
    });
  }, [product?.id, tabKey, selectionTableConfig.default_tab]);

  useEffect(() => {
    if (!tabOption || !safeActiveTab) {
      return;
    }

    setSelectedVariants((prev) => {
      if (isQuoteTab || !isTabAttributeSource) {
        return {};
      }

      const currentTabValue = String(prev?.[tabOption]?.value ?? "").trim();
      if (currentTabValue === safeActiveTab && Object.keys(prev || {}).length > 1) {
        return prev;
      }

      return {
        [tabOption]: {
          option: tabOption,
          value: safeActiveTab,
        },
      };
    });
  }, [isQuoteTab, isTabAttributeSource, safeActiveTab, setSelectedVariants, tabOption]);

  const handleRowSelect = (variant: Record<string, any>) => {
    setSelectedVariants(buildSelectedVariantsFromCombination(variant, variantOptions));
  };

  const updateRowQuantity = (rowKey: string, value: string) => {
    setRowQuantities((prev) => ({
      ...prev,
      [rowKey]: parseQuantityInput(value),
    }));
  };

  const handleAddRowToCart = (variant: Record<string, any>) => {
    const variantSelection = buildSelectedVariantsFromCombination(variant, variantOptions) as SelectedVariantMap;
    const rowKey = buildCombinationVariantKey(variant, variantOptions);
    const availableStock = getAvailableStock({
      ...product,
      selected_variants: variantSelection,
    });
    const requestedQty = rowQuantities[rowKey] || 1;
    const nextQty = clampQuantityToStock(requestedQty, availableStock);

    if (availableStock !== null && availableStock <= 0) {
      toast.error("This row is out of stock.");
      return;
    }

    if (availableStock !== null && nextQty < requestedQty) {
      toast.error(`Only ${availableStock} unit(s) are available for this row.`);
    }

    if (nextQty <= 0) {
      return;
    }

    setSelectedVariants(variantSelection);
    const added = addToCart(
      {
        ...product,
        selected_variants: variantSelection,
        available_stock: availableStock,
      },
      nextQty,
    );
    if (added) toast.success("Added to basket!");
  };

  const handleQuoteSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const isBaffleQuoteLayout = selectionTableConfig.quote_form_layout === "baffle_non_standard";

    if (isBaffleQuoteLayout) {
      if (!quoteForm.companyName.trim() || !quoteForm.email.trim() || !quoteForm.postcode.trim() || !quoteForm.filterType.trim()) {
        toast.error("Please fill in the required company, email, postcode, and filter type fields.");
        return;
      }
    } else if (!quoteForm.name.trim() || !quoteForm.email.trim() || !quoteForm.message.trim()) {
      toast.error("Please fill in your name, email, and requirements.");
      return;
    }

    setIsSubmittingQuote(true);

    try {
      const descriptionParts = isBaffleQuoteLayout
        ? [
          `Selection table enquiry for ${product?.name || "Product"}.`,
          safeActiveTab && tabOption ? `${tabSourceLabel}: ${safeActiveTab}` : "",
          quoteForm.name.trim() ? `Full name: ${quoteForm.name.trim()}` : "",
          `Company name: ${quoteForm.companyName.trim()}`,
          `Email: ${quoteForm.email.trim()}`,
          quoteForm.phone.trim() ? `Telephone: ${quoteForm.phone.trim()}` : "",
          `Postcode: ${quoteForm.postcode.trim()}`,
          `Filter type: ${quoteForm.filterType.trim()}`,
          quoteForm.filterHeight.trim() ? `Filter height (mm): ${quoteForm.filterHeight.trim()}` : "",
          quoteForm.filterWidth.trim() ? `Filter width (mm): ${quoteForm.filterWidth.trim()}` : "",
          quoteForm.filterDepth.trim() ? `Filter depth (mm): ${quoteForm.filterDepth.trim()}` : "",
          quoteForm.quantity.trim() ? `Quantity: ${quoteForm.quantity.trim()}` : "",
          quoteForm.message.trim() ? `Additional requirements: ${quoteForm.message.trim()}` : "",
        ].filter(Boolean)
        : [
          `Selection table enquiry for ${product?.name || "Product"}.`,
          safeActiveTab && tabOption ? `${tabSourceLabel}: ${safeActiveTab}` : "",
          quoteForm.message.trim(),
        ].filter(Boolean);

      await apiFetch("/v1/quote", {
        method: "POST",
        body: JSON.stringify({
          name: isBaffleQuoteLayout
            ? (quoteForm.name.trim() || quoteForm.companyName.trim())
            : quoteForm.name.trim(),
          email: quoteForm.email.trim(),
          phone: quoteForm.phone.trim(),
          service: safeActiveTab ? `${product?.name || "Product"} - ${safeActiveTab}` : (product?.name || "Product"),
          description: descriptionParts.join("\n\n"),
        }),
      });

      setQuoteForm(createQuoteFormState(customer, product?.name || ""));
      toast.success("Quote request submitted. We'll be in touch soon.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit quote request.");
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  if (!tabOption || tabs.length === 0) {
    return null;
  }

  return (
    <div className={embedded ? " min-w-0" : "container mx-auto px-4 lg:px-8 pb-14"}>
      {selectionTableConfig.intro_text && (
        <div className={embedded ? "mb-6 text-[14px] leading-7 text-[#6e7a92]" : "mb-8 max-w-6xl text-[15px] leading-8 text-[#6e7a92]"}>
          {selectionTableConfig.intro_text}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className={`inline-flex min-w-max items-end ${embedded ? "gap-2" : "gap-2 md:gap-3"}`}>
          {tabs.map((tabValue) => {
            const isActive = tabValue === safeActiveTab;

            return (
              <button
                key={tabValue}
                type="button"
                onClick={() => setActiveTab(tabValue)}
                className={`${tabButtonClass} border text-left font-semibold tracking-[-0.02em] transition-all ${
                  isActive
                    ? "border-primary bg-primary text-white shadow-[0_14px_34px_rgba(16,39,92,0.16)]"
                    : "border-[#cad4e4] bg-white text-primary hover:border-orange hover:text-orange"
                }`}
              >
                {tabValue}
              </button>
            );
          })}
        </div>
      </div>

      <div className={panelClass}>
        {isQuoteTab ? (
          <div className="bg-white px-6 py-8 md:px-10 md:py-10">
            {activeTabIntroText && (
              <div className="space-y-3 text-[15px] leading-8 text-[#6e7a92]">
                {activeTabIntroText.split(/\n+/).filter(Boolean).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}

            {selectionTableConfig.quote_form_layout === "baffle_non_standard" ? (
              <form onSubmit={handleQuoteSubmit} className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Full name</label>
                  <input
                    type="text"
                    value={quoteForm.name}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Company name <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={quoteForm.companyName}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Email <span className="text-red-600">*</span></label>
                  <input
                    type="email"
                    value={quoteForm.email}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Postcode <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={quoteForm.postcode}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, postcode: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Telephone</label>
                  <input
                    type="text"
                    value={quoteForm.phone}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Filter type <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={quoteForm.filterType}
                    readOnly
                    className="h-12 w-full border border-[#cad4e4] bg-white px-4 text-[14px] text-[#6e7a92] outline-none"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Filter height (mm)</label>
                  <input
                    type="text"
                    value={quoteForm.filterHeight}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, filterHeight: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Filter width (mm)</label>
                  <input
                    type="text"
                    value={quoteForm.filterWidth}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, filterWidth: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Filter depth (mm)</label>
                  <input
                    type="text"
                    value={quoteForm.filterDepth}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, filterDepth: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Quantity</label>
                  <input
                    type="text"
                    value={quoteForm.quantity}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, quantity: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-3 block text-[14px] font-semibold text-primary">Additional requirements</label>
                  <textarea
                    rows={5}
                    value={quoteForm.message}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, message: event.target.value }))}
                    className="w-full border border-[#cad4e4] bg-[#f8fafc] px-4 py-3 text-[14px] text-primary outline-none transition-colors focus:border-orange focus:bg-white resize-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmittingQuote}
                    className="inline-flex min-h-[52px] items-center justify-center bg-orange px-8 text-[14px] font-semibold text-white transition-colors hover:bg-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmittingQuote
                      ? "Submitting..."
                      : (selectionTableConfig.quote_submit_label || "Request quote")}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-primary">Full name *</label>
                  <input
                    type="text"
                    value={quoteForm.name}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-sm text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-primary">Email Address *</label>
                  <input
                    type="email"
                    value={quoteForm.email}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-sm text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-[13px] font-semibold text-primary">Phone Number</label>
                  <input
                    type="text"
                    value={quoteForm.phone}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="h-12 w-full border border-[#cad4e4] bg-[#f8fafc] px-4 text-sm text-primary outline-none transition-colors focus:border-orange focus:bg-white"
                    placeholder="+44 7700 900000"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-[13px] font-semibold text-primary">Requirements *</label>
                  <textarea
                    rows={6}
                    value={quoteForm.message}
                    onChange={(event) => setQuoteForm((prev) => ({ ...prev, message: event.target.value }))}
                    className="w-full border border-[#cad4e4] bg-[#f8fafc] px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-orange focus:bg-white resize-none"
                    placeholder="Describe the size, material, quantity, and any non-standard requirements."
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmittingQuote}
                    className="inline-flex min-h-[52px] items-center justify-center bg-orange px-8 text-sm font-semibold text-white transition-colors hover:bg-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmittingQuote
                      ? "Submitting..."
                      : (selectionTableConfig.quote_submit_label || "Request quote")}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : activeRows.length === 0 ? (
          <div className="bg-[#f8fafc] px-5 py-6 text-[14px] text-[#6e7a92]">
            No rows are configured for {safeActiveTab} yet.
          </div>
        ) : (
          <>
            {activeTabConfig.heading && (
              <div className={headingWrapClass}>
                <p className={headingTextClass}>
                  {activeTabConfig.heading}
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="bg-primary text-white">
                  {hasGroupedAttributeHeader ? (
                    <>
                      <tr>
                        <th
                          colSpan={rowAttributeOptions.length}
                          className={headerGroupCellClass}
                        >
                          {attributeGroupLabel}
                        </th>
                        {frontendColumns.map((column) => (
                          <th
                            key={column.key}
                            rowSpan={2}
                            className={headerGroupCellClass}
                          >
                            {column.label}
                          </th>
                        ))}
                        {showPriceColumn && (
                          <th rowSpan={2} className={headerGroupCellClass}>
                            Price
                          </th>
                        )}
                        <th rowSpan={2} className={cartHeaderClass}>
                          <ShoppingCart className={`mx-auto ${embedded ? "h-5 w-5" : "h-6 w-6"}`} />
                        </th>
                      </tr>
                      <tr>
                        {rowAttributeOptions.map((optionName) => (
                          <th key={optionName} className={headerSubCellClass}>
                            {formatVariantOptionLabel(optionName)}
                          </th>
                        ))}
                      </tr>
                    </>
                  ) : (
                    <tr>
                      {rowAttributeOptions.map((optionName) => (
                        <th key={optionName} className={headerCellClass}>
                          {formatVariantOptionLabel(optionName)}
                        </th>
                      ))}
                      {frontendColumns.map((column) => (
                        <th key={column.key} className={headerCellClass}>
                          {column.label}
                        </th>
                      ))}
                      {showPriceColumn && (
                        <th className={headerCellClass}>
                          Price
                        </th>
                      )}
                      <th className={cartHeaderClass}>
                        <ShoppingCart className={`mx-auto ${embedded ? "h-5 w-5" : "h-6 w-6"}`} />
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody className="bg-white">
                  {activeRows.map((variant: Record<string, any>, index: number) => {
                    const attributes = getVariantAttributes(variant);
                    const rowKey = buildCombinationVariantKey(variant, variantOptions);
                    const rowSelection = buildSelectedVariantsFromCombination(variant, variantOptions);
                    const rowAvailableStock = getAvailableStock({
                      ...product,
                      selected_variants: rowSelection,
                    });
                    const rowOutOfStock = rowAvailableStock !== null && rowAvailableStock <= 0;
                    const rowQuantity = rowQuantities[rowKey] || 1;
                    const rowBgClass = index % 2 === 0 ? "bg-[#f8fafc]" : "bg-white";

                    return (
                      <tr
                        key={rowKey}
                        onClick={() => {
                          if (!isCallTab) {
                            handleRowSelect(variant);
                          }
                        }}
                        className={`transition-colors ${
                          isCallTab
                            ? ""
                            : rowKey === selectedVariantKey
                              ? "cursor-pointer bg-orange-light/40"
                              : "cursor-pointer hover:bg-[#f4f7fb]"
                        }`}
                      >
                        {rowAttributeOptions.map((optionName) => (
                          <td
                            key={optionName}
                            className={`${bodyCellClass} ${rowBgClass}`}
                          >
                            {attributes[optionName] || "-"}
                          </td>
                        ))}
                        {frontendColumns.map((column) => (
                          <td
                            key={column.key}
                            className={`${customBodyCellClass} ${
                              isPartNumberLabel(column.label) ? "font-semibold text-orange" : "text-[#6e7a92]"
                            } ${rowBgClass}`}
                          >
                            {formatCustomFieldValue(variant, column.key) || "-"}
                          </td>
                        ))}
                        {showPriceColumn && (
                          <td className={`${priceCellClass} ${rowBgClass}`}>
                            {formatMoneyValue(variant?.price ?? product?.price ?? "") || "-"}
                          </td>
                        )}
                        <td className={`${actionCellClass} ${rowBgClass}`}>
                          {isCallTab ? (
                            <div className={`text-center text-[#6e7a92] ${embedded ? "text-[14px]" : "text-[16px]"}`}>
                              <span>Call </span>
                              <a
                                href={`tel:${contactPhone || quotePhoneLabel}`}
                                onClick={(event) => event.stopPropagation()}
                                className="font-semibold text-orange hover:underline"
                              >
                                {quotePhoneLabel}
                              </a>
                            </div>
                          ) : (
                            <div className="flex items-stretch justify-center">
                              <input
                                type="number"
                                min={1}
                                max={rowAvailableStock !== null ? Math.min(rowAvailableStock, MAX_ORDER_QUANTITY) : MAX_ORDER_QUANTITY}
                                value={rowQuantity}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => updateRowQuantity(rowKey, event.target.value)}
                                className={quantityInputClass}
                              />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleAddRowToCart(variant);
                                }}
                                disabled={rowOutOfStock}
                                className={cartButtonClass}
                              >
                                <ShoppingCart className={embedded ? "h-4 w-4" : "h-5 w-5"} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
