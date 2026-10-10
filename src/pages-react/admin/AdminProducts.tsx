import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X, Copy, ChevronDown, ChevronRight } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import ProductImage from "@/components/ProductImage";
import RichTextEditor from "@/components/admin/RichTextEditor";
import VariantColumnManager from "@/components/admin/VariantColumnManager";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";
import {
    getSelectionTableSourceValues,
    getSelectionTableTabValues,
    normalizeFrontendVariantLayout,
    normalizeSelectionTableConfig,
    type FrontendVariantLayout,
} from "@/lib/selectionTable";
import type { VariantTableSection, VariantTableColumn } from "@/types/product";
import {
    normalizeVariantStock,
    normalizeVariantCustomFields,
    normalizeShippingNumber,
    buildVariantValueFromDimensions,
    stripCurrencyForAdmin,
    formatPriceForStorage,
    normalizeVariantPrice,
    normalizeVariantOptionName,
    slugifyVariantGroupKey,
    normalizeVariantOptionList,
    normalizeSpecifications,
    normalizeCombinationAttributes,
    getVariantModeForProduct,
    mapVariantsToProductPrice,
    mapVariantsForStorage,
    createEmptyCombinationVariant,
    mapCombinationVariantsToAdmin,
    mapCombinationVariantsForStorage,
    SHIPPING_CLASS_OPTIONS,
    DEFAULT_VARIANT_TABLE_COLUMNS,
    FIXED_SIZE_COLUMNS,
    buildCustomColumnKey,
    cloneVariantTableColumns,
    normalizeVariantTableColumns,
    getDraftField,
    createEmptySizeVariant,
} from "@/lib/adminProductUtils";

export default function AdminProducts() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);

    const [isEditing, setIsEditing] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<any>(null);
    const [tagsInput, setTagsInput] = useState("");
    const [newSizeVariant, setNewSizeVariant] = useState(createEmptySizeVariant());
    const [newCombinationVariant, setNewCombinationVariant] = useState(createEmptyCombinationVariant());
    const [collapsedCombinationGroups, setCollapsedCombinationGroups] = useState<Record<string, boolean>>({});
    const [newCombinationOptionName, setNewCombinationOptionName] = useState("");
    const [newSelectionTableTabValue, setNewSelectionTableTabValue] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const { sort, toggleSort } = useTableSort("name");

    useEffect(() => {
        loadProducts();
        loadCategories();
    }, []);

    const loadProducts = async () => {
        try {
            const res = await apiFetch<{ data: any[] }>("/admin/products?per_page=500");
            setProducts(res.data);
        } catch (e) {
            toast.error("Failed to load products");
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const res = await apiFetch<any[]>("/admin/product-category-list");
            setCategories(res);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        try {
            await apiFetch(`/admin/products/${id}`, { method: "DELETE" });
            toast.success("Product deleted successfully");
            loadProducts();
        } catch (e) {
            toast.error("Failed to delete product");
        }
    };

    const handleDuplicate = async (id: number) => {
        try {
            await apiFetch(`/admin/products/${id}/duplicate`, { method: "POST" });
            toast.success("Product copied successfully");
            loadProducts();
        } catch (e) {
            toast.error("Failed to copy product");
        }
    };

    const openEdit = (product: any = null) => {
        const prod = product ? (() => {
            const rawVariantMode = getVariantModeForProduct(product);
            const combinationOptions = normalizeVariantOptionList(product.variant_options);
            const inferredCombinationOptions = (product.variants || []).flatMap((variant: any) => Object.keys(variant?.attributes || {}).map((key) => normalizeVariantOptionName(key)));
            const legacyOptionNames = Array.from(
                new Set((product.variants || []).map((variant: any) => String(variant?.option ?? "").trim()).filter(Boolean))
            );
            const variantTableColumns = normalizeVariantTableColumns(product.variant_table_columns);
            const combinationOptionNames = Array.from(new Set([...combinationOptions, ...inferredCombinationOptions].filter(Boolean)));
            const normalizedFrontendLayout = normalizeFrontendVariantLayout(product.frontend_variant_layout);
            const isLegacyLikeCombination = rawVariantMode === "combination"
                && combinationOptionNames.length <= 1
                && normalizedFrontendLayout !== "selection_table"
                && variantTableColumns.combination.length === 0;
            const variantMode = isLegacyLikeCombination ? "legacy" : rawVariantMode;
            const legacyOptionName = legacyOptionNames[0]
                || combinationOptionNames[0]
                || String(product.variant_option ?? "").trim()
                || "Size";
            const legacyVariantsSource = (product.variants || []).map((variant: any) => {
                if (String(variant?.option ?? "").trim() && String(variant?.value ?? "").trim()) {
                    return variant;
                }

                const attributeEntries = Object.entries(variant?.attributes || {})
                    .map(([key, value]) => [normalizeVariantOptionName(key), String(value ?? "").trim()] as const)
                    .filter(([key, value]) => key && value);

                if (attributeEntries.length !== 1) {
                    return variant;
                }

                const [option, value] = attributeEntries[0];

                return {
                    ...variant,
                    option,
                    value,
                };
            });
            const productPrice = stripCurrencyForAdmin(product.price || "");
            const selectionTableSourceKeys = [
                ...combinationOptionNames,
                ...variantTableColumns.combination.map((column) => column.key),
            ];
            const legacyVariants = mapVariantsToProductPrice(legacyVariantsSource, productPrice);
            const combinationVariants = mapCombinationVariantsToAdmin(product.variants || [], productPrice, combinationOptionNames);

            return {
                ...product,
                product_code: product.product_code || "",
                variant_mode: variantMode,
                variant_options: variantMode === "combination" ? combinationOptionNames : [],
                frontend_variant_layout: variantMode === "combination" ? normalizedFrontendLayout : "default",
                selection_table_config: variantMode === "combination"
                    ? normalizeSelectionTableConfig(product.selection_table_config, combinationOptionNames, product.variants || [], selectionTableSourceKeys)
                    : null,
                price: stripCurrencyForAdmin(product.price),
                old_price: stripCurrencyForAdmin(product.old_price),
                show_variant_in_title: Boolean(product.show_variant_in_title),
                specifications: normalizeSpecifications(product.specifications),
                variants: variantMode === "combination" ? combinationVariants : legacyVariants,
                legacy_variants_draft: legacyVariants,
                combination_variants_draft: combinationVariants,
                legacy_variant_option_draft: legacyOptionName,
                combination_variant_options_draft: combinationOptionNames,
                combination_frontend_variant_layout_draft: normalizedFrontendLayout,
                combination_selection_table_config_draft: normalizeSelectionTableConfig(product.selection_table_config, combinationOptionNames, product.variants || [], selectionTableSourceKeys),
                variant_table_columns: variantTableColumns,
                variant_option: legacyOptionName,
            };
        })() : null;
        const nextProduct = prod || {
                name: "",
                product_code: "",
                variant_mode: "legacy",
                variant_options: [],
                frontend_variant_layout: "default" satisfies FrontendVariantLayout,
                selection_table_config: null,
                price: "",
                old_price: "",
                image: "",
                gallery: [],
                description: "",
                product_category_id: "",
                tags: [],
                badge: "",
                active: true,
                featured: false,
                track_stock: false,
                stock_quantity: "",
                shipping_weight_kg: null,
                shipping_length_cm: null,
                shipping_width_cm: null,
                shipping_height_cm: null,
                shipping_class: "standard",
                ships_separately: false,
                order: 0,
                specifications: {},
                variants: [],
                legacy_variants_draft: [],
                combination_variants_draft: [],
                legacy_variant_option_draft: "Size",
                combination_variant_options_draft: [],
                combination_frontend_variant_layout_draft: "default" satisfies FrontendVariantLayout,
                combination_selection_table_config_draft: normalizeSelectionTableConfig(null),
                variant_table_columns: cloneVariantTableColumns(DEFAULT_VARIANT_TABLE_COLUMNS),
                variant_option: "Size",
                show_variant_in_title: false,
            }
        ;
        setCurrentProduct(nextProduct);
        setTagsInput(Array.isArray(nextProduct.tags) ? nextProduct.tags.join(", ") : "");
        setNewSizeVariant(createEmptySizeVariant());
        setNewCombinationVariant(createEmptyCombinationVariant(prod?.combination_variant_options_draft || prod?.variant_options || []));
        setNewCombinationOptionName("");
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Check if there's a pending specification to add
            const keyEl = document.getElementById('new_spec_key') as HTMLInputElement;
            const valEl = document.getElementById('new_spec_value') as HTMLInputElement;
            const finalProduct = { ...currentProduct };

            if (keyEl && valEl) {
                const key = keyEl.value.trim();
                const val = valEl.value.trim();
                if (key && val) {
                    finalProduct.specifications = {
                        ...(finalProduct.specifications || {}),
                        [key]: val
                    };
                    keyEl.value = "";
                    valEl.value = "";
                }
            }

            finalProduct.tags = tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);
            finalProduct.product_code = String(finalProduct.product_code ?? "").trim() || null;

            if (!String(finalProduct.price ?? "").trim()) {
                const firstVariantPrice = (finalProduct.variants || []).find((variant: any) => String(variant?.price ?? "").trim())?.price;
                if (firstVariantPrice) {
                    finalProduct.price = firstVariantPrice;
                }
            }

            finalProduct.price = formatPriceForStorage(finalProduct.price);
            finalProduct.old_price = finalProduct.old_price ? formatPriceForStorage(finalProduct.old_price) : "";
            delete finalProduct.legacy_variants_draft;
            delete finalProduct.combination_variants_draft;
            delete finalProduct.legacy_variant_option_draft;
            delete finalProduct.combination_variant_options_draft;
            delete finalProduct.combination_frontend_variant_layout_draft;
            delete finalProduct.combination_selection_table_config_draft;
            finalProduct.variant_mode = finalProduct.variant_mode === "combination" ? "combination" : "legacy";
            finalProduct.frontend_variant_layout = normalizeFrontendVariantLayout(finalProduct.frontend_variant_layout);
            finalProduct.variant_table_columns = normalizeVariantTableColumns(finalProduct.variant_table_columns);

            if (finalProduct.variant_mode === "combination") {
                finalProduct.variant_options = normalizeVariantOptionList(finalProduct.variant_options);

                const completeCombinationRows = (finalProduct.variants || []).filter((variant: any) => (
                    finalProduct.variant_options.every((optionName: string) => String(variant?.attributes?.[optionName] ?? "").trim())
                ));

                if ((finalProduct.variant_options.length > 0 ? completeCombinationRows : (finalProduct.variants || [])).length === 0) {
                    toast.error("Add at least one sellable combination row before saving.");
                    return;
                }

                finalProduct.variants = mapCombinationVariantsForStorage(finalProduct.variants || [], finalProduct.price || "", finalProduct.variant_options);

                const selectionTableSourceKeys = [
                    ...finalProduct.variant_options,
                    ...finalProduct.variant_table_columns.combination.map((column: VariantTableColumn) => column.key),
                ];
                finalProduct.selection_table_config = normalizeSelectionTableConfig(
                    finalProduct.selection_table_config,
                    finalProduct.variant_options,
                    finalProduct.variants || [],
                    selectionTableSourceKeys,
                );

                if (finalProduct.frontend_variant_layout === "selection_table") {
                    if (!finalProduct.selection_table_config?.tab_option) {
                        const tabOptionName = finalProduct.variant_options?.find((o: string) => o.toLowerCase() === "tab") || "Tab";
                        if (!finalProduct.selection_table_config) finalProduct.selection_table_config = {};
                        finalProduct.selection_table_config.tab_option = tabOptionName;
                    }
                } else {
                    finalProduct.selection_table_config = null;
                }
            } else {
                finalProduct.variant_options = null;
                finalProduct.frontend_variant_layout = "default";
                finalProduct.selection_table_config = null;
                finalProduct.variants = mapVariantsForStorage(finalProduct.variants || [], finalProduct.price || "");

                if ((finalProduct.variants || []).length === 0) {
                    toast.error("Add at least one simple option row before saving.");
                    return;
                }
            }

            finalProduct.shipping_weight_kg = normalizeShippingNumber(finalProduct.shipping_weight_kg);
            finalProduct.shipping_length_cm = normalizeShippingNumber(finalProduct.shipping_length_cm);
            finalProduct.shipping_width_cm = normalizeShippingNumber(finalProduct.shipping_width_cm);
            finalProduct.shipping_height_cm = normalizeShippingNumber(finalProduct.shipping_height_cm);
            if (finalProduct.shipping_class !== "freight") {
                finalProduct.freight_delivery_price = null;
            } else {
                const fdp = parseFloat(String(finalProduct.freight_delivery_price ?? ""));
                finalProduct.freight_delivery_price = isNaN(fdp) || fdp < 0 ? null : fdp;
            }

            if (finalProduct.id) {
                await apiFetch(`/admin/products/${finalProduct.id}`, {
                    method: "PUT",
                    body: JSON.stringify(finalProduct),
                });
                toast.success("Product updated");
            } else {
                await apiFetch("/admin/products", {
                    method: "POST",
                    body: JSON.stringify(finalProduct),
                });
                toast.success("Product created");
            }
            setIsEditing(false);
            loadProducts();
        } catch (err: any) {
            toast.error(err.message || "Failed to save product");
        }
    };

    const filteredProducts = sortRows(products
        .filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === "all" || p.product_category_id?.toString() === categoryFilter;
            const price = Number.parseFloat(String(p.price ?? "").replace(/[£,]/g, "").trim());
            const min = minPrice.trim() === "" ? null : Number(minPrice);
            const max = maxPrice.trim() === "" ? null : Number(maxPrice);
            const matchesPrice = Number.isFinite(price)
                ? (min === null || price >= min) && (max === null || price <= max)
                : min === null && max === null;
            return matchesSearch && matchesCategory && matchesPrice;
        }), sort.key, sort.direction);

    const updateVariantTableColumn = (
        section: VariantTableSection,
        key: string,
        patch: Partial<VariantTableColumn>,
    ) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const config = normalizeVariantTableColumns(prev.variant_table_columns);

            return {
                ...prev,
                variant_table_columns: {
                    ...config,
                    [section]: config[section].map((column) => (
                        column.key === key ? { ...column, ...patch } : column
                    )),
                },
            };
        });
    };

    const addVariantTableColumn = (section: VariantTableSection, label: string) => {
        const trimmedLabel = label.trim();
        if (!trimmedLabel) {
            return;
        }

        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const config = normalizeVariantTableColumns(prev.variant_table_columns);
            const fixedKeys = section === "size" ? FIXED_SIZE_COLUMNS.map((column) => column.key) : [];
            const allSectionColumns = [...config[section], ...FIXED_SIZE_COLUMNS.filter(() => section === "size")];
            const duplicateLabel = allSectionColumns.some((column) => column.label.trim().toLowerCase() === trimmedLabel.toLowerCase());

            if (duplicateLabel) {
                toast.error("That column already exists.");
                return prev;
            }

            const newColumn: VariantTableColumn = {
                key: buildCustomColumnKey(trimmedLabel, [...config[section].map((column) => column.key), ...fixedKeys]),
                label: trimmedLabel,
                visible: true,
                frontendVisible: true,
            };

            return {
                ...prev,
                variant_table_columns: {
                    ...config,
                    [section]: [...config[section], newColumn],
                },
            };
        });
    };

    const updateSelectionTableConfig = (patch: Record<string, unknown>) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;
            const selectionTableSourceKeys = [
                ...normalizeVariantOptionList(prev.variant_options),
                ...normalizeVariantTableColumns(prev.variant_table_columns).combination.map((column) => column.key),
            ];

            return {
                ...prev,
                selection_table_config: {
                    ...normalizeSelectionTableConfig(prev.selection_table_config, normalizeVariantOptionList(prev.variant_options), prev.variants || [], selectionTableSourceKeys),
                    ...patch,
                },
            };
        });
    };

    const updateSelectionTableTab = (tabValue: string, patch: Record<string, unknown>) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const optionNames = normalizeVariantOptionList(prev.variant_options);
            const selectionTableSourceKeys = [
                ...optionNames,
                ...normalizeVariantTableColumns(prev.variant_table_columns).combination.map((column) => column.key),
            ];
            const config = normalizeSelectionTableConfig(prev.selection_table_config, optionNames, prev.variants || [], selectionTableSourceKeys);

            return {
                ...prev,
                selection_table_config: {
                    ...config,
                    tabs: config.tabs.map((tab) => tab.value === tabValue ? { ...tab, ...patch } : tab),
                },
            };
        });
    };

    const addSelectionTableTab = () => {
        const trimmedValue = newSelectionTableTabValue.trim();
        if (!trimmedValue) {
            return;
        }

        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const optionNames = normalizeVariantOptionList(prev.variant_options);
            const selectionTableSourceKeys = [
                ...optionNames,
                ...normalizeVariantTableColumns(prev.variant_table_columns).combination.map((column) => column.key),
            ];
            const config = normalizeSelectionTableConfig(prev.selection_table_config, optionNames, prev.variants || [], selectionTableSourceKeys);

            if (config.tabs.some((tab) => tab.value.trim().toLowerCase() === trimmedValue.toLowerCase())) {
                toast.error("That tab already exists.");
                return prev;
            }

            const isQuoteTab = config.quote_tab_values.some((value) => value.trim().toLowerCase() === trimmedValue.toLowerCase());

            // Ensure "Tab" exists as the first combination option
            const TAB_OPTION_NAME = "Tab";
            const hasTabOption = optionNames.some((o) => o.toLowerCase() === TAB_OPTION_NAME.toLowerCase());
            const nextOptionNames = hasTabOption ? optionNames : [TAB_OPTION_NAME, ...optionNames];

            // Build a new blank variant with the tab pre-filled
            const tabKey = config.tab_option || nextOptionNames[0] || TAB_OPTION_NAME;
            const newVariantAttributes: Record<string, string> = Object.fromEntries(nextOptionNames.map((o) => [o, ""]));
            if (tabKey && !tabKey.startsWith("custom:") && Object.prototype.hasOwnProperty.call(newVariantAttributes, tabKey)) {
                newVariantAttributes[tabKey] = trimmedValue;
            }
            const newVariant = {
                attributes: newVariantAttributes,
                price: "",
                stock: null,
                shipping_weight_kg: null,
                shipping_length_cm: null,
                shipping_width_cm: null,
                shipping_height_cm: null,
                shipping_class: "standard",
                ships_separately: false,
                custom_fields: {},
            };

            return {
                ...prev,
                variant_options: nextOptionNames,
                combination_variant_options_draft: nextOptionNames,
                variants: [
                    ...(hasTabOption
                        ? prev.variants || []
                        : (prev.variants || []).map((variant: any) => ({
                            ...variant,
                            attributes: {
                                [TAB_OPTION_NAME]: "",
                                ...normalizeCombinationAttributes(variant.attributes, optionNames),
                            },
                        }))),
                    newVariant,
                ],
                selection_table_config: {
                    ...config,
                    tabs: [
                        ...config.tabs,
                        {
                            value: trimmedValue,
                            mode: isQuoteTab ? "quote" : "table",
                            heading: "",
                            intro_text: "",
                        },
                    ],
                },
            };
        });

        setNewSelectionTableTabValue("");
    };

    const addVariantForGroup = (groupLabel: string) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;
            const optionNames = normalizeVariantOptionList(prev.variant_options);
            const stSourceKeys = [
                ...optionNames,
                ...normalizeVariantTableColumns(prev.variant_table_columns).combination.map((column: VariantTableColumn) => column.key),
            ];
            const stConfig = normalizeSelectionTableConfig(prev.selection_table_config, optionNames, prev.variants || [], stSourceKeys);
            const tabKey = stConfig.tab_option || optionNames[0] || "";
            const attributes: Record<string, string> = Object.fromEntries(optionNames.map((o) => [o, ""]));
            if (tabKey && !tabKey.startsWith("custom:") && Object.prototype.hasOwnProperty.call(attributes, tabKey)) {
                attributes[tabKey] = groupLabel;
            }
            return {
                ...prev,
                variants: [
                    ...(prev.variants || []),
                    {
                        attributes,
                        price: "",
                        stock: null,
                        shipping_weight_kg: null,
                        shipping_length_cm: null,
                        shipping_width_cm: null,
                        shipping_height_cm: null,
                        shipping_class: "standard",
                        ships_separately: false,
                        custom_fields: {},
                    },
                ],
            };
        });
    };

    const removeSelectionTableTab = (tabValue: string) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const optionNames = normalizeVariantOptionList(prev.variant_options);
            const selectionTableSourceKeys = [
                ...optionNames,
                ...normalizeVariantTableColumns(prev.variant_table_columns).combination.map((column) => column.key),
            ];
            const config = normalizeSelectionTableConfig(prev.selection_table_config, optionNames, prev.variants || [], selectionTableSourceKeys);

            const tabKey = config.tab_option || optionNames.find((o) => o.toLowerCase() === "tab") || "Tab";

            return {
                ...prev,
                variants: (prev.variants || []).filter((variant: any) => {
                    const variantTabValue = tabKey.startsWith("custom:")
                        ? String(variant?.custom_fields?.[tabKey.slice("custom:".length)] ?? "").trim()
                        : String(variant?.attributes?.[tabKey] ?? "").trim();
                    return variantTabValue.toLowerCase() !== tabValue.toLowerCase();
                }),
                selection_table_config: {
                    ...config,
                    default_tab: config.default_tab === tabValue ? "" : config.default_tab,
                    tabs: config.tabs.filter((tab) => tab.value !== tabValue),
                },
            };
        });
    };

    const updateVariantCustomField = (index: number, customKey: string, value: string) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            const variant = variants[index] || {};
            const customFields = normalizeVariantCustomFields(variant.custom_fields);
            variants[index] = {
                ...variant,
                custom_fields: {
                    ...customFields,
                    [customKey]: value,
                },
            };

            return {
                ...prev,
                variants,
            };
        });
    };

    const updateNewVariantCustomField = (
        section: VariantTableSection,
        customKey: string,
        value: string,
    ) => {
        if (section !== "size") {
            return;
        }

        setNewSizeVariant((prev) => ({
            ...prev,
            custom_fields: {
                ...normalizeVariantCustomFields(prev.custom_fields),
                [customKey]: value,
            },
        }));
    };

    const updateSizeVariantField = (index: number, field: string, value: unknown) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            const nextVariant = {
                ...variants[index],
                [field]: value,
            };

            if (["shipping_length_cm", "shipping_width_cm", "shipping_height_cm"].includes(field)) {
                const generatedValue = buildVariantValueFromDimensions(
                    "Size",
                    nextVariant.shipping_length_cm,
                    nextVariant.shipping_width_cm,
                    nextVariant.shipping_height_cm,
                );

                if (generatedValue) {
                    nextVariant.value = generatedValue;
                }
            }

            variants[index] = nextVariant;

            return {
                ...prev,
                variants,
            };
        });
    };

    const updateOtherVariantField = (index: number, field: string, value: unknown) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            variants[index] = {
                ...variants[index],
                [field]: value,
            };

            return {
                ...prev,
                variants,
            };
        });
    };

    const removeVariantAtIndex = (index: number) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            variants.splice(index, 1);

            return {
                ...prev,
                variants,
            };
        });
    };

    const cloneVariantAtIndex = (index: number) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            const source = variants[index];
            if (!source) return prev;

            variants.splice(index + 1, 0, {
                ...source,
                attributes: source.attributes ? { ...source.attributes } : source.attributes,
                custom_fields: normalizeVariantCustomFields(source.custom_fields),
            });

            return {
                ...prev,
                variants,
            };
        });
    };

    const appendNewSizeVariant = () => {
        const generatedValue = buildVariantValueFromDimensions(
            "Size",
            newSizeVariant.shipping_length_cm,
            newSizeVariant.shipping_width_cm,
            newSizeVariant.shipping_height_cm,
        );
        const manualValue = String(newSizeVariant.value ?? "").trim();
        const finalValue = generatedValue || manualValue || "Standard";

        setCurrentProduct((prev: any) => ({
            ...prev,
            variants: [
                ...(prev?.variants || []),
                {
                    option: "Size",
                    value: finalValue,
                    price: normalizeVariantPrice(newSizeVariant.price, prev?.price || ""),
                    stock: normalizeVariantStock(newSizeVariant.stock),
                    shipping_weight_kg: normalizeShippingNumber(newSizeVariant.shipping_weight_kg),
                    shipping_length_cm: normalizeShippingNumber(newSizeVariant.shipping_length_cm),
                    shipping_width_cm: normalizeShippingNumber(newSizeVariant.shipping_width_cm),
                    shipping_height_cm: normalizeShippingNumber(newSizeVariant.shipping_height_cm),
                    shipping_class: newSizeVariant.shipping_class || "",
                    ships_separately: Boolean(newSizeVariant.ships_separately),
                    custom_fields: normalizeVariantCustomFields(newSizeVariant.custom_fields),
                },
            ],
        }));

        setNewSizeVariant(createEmptySizeVariant());
    };

    const setProductVariantMode = (nextMode: "legacy" | "combination") => {
        setCurrentProduct((prev: any) => {
            if (!prev || prev.variant_mode === nextMode) {
                return prev;
            }

            const currentVariantMode = prev.variant_mode === "combination" ? "combination" : "legacy";
            const variantTableColumns = normalizeVariantTableColumns(prev.variant_table_columns);

            const legacyVariantsDraft = currentVariantMode === "legacy"
                ? (prev.variants || [])
                : getDraftField(prev.legacy_variants_draft, []);
            const combinationVariantsDraft = currentVariantMode === "combination"
                ? (prev.variants || [])
                : getDraftField(prev.combination_variants_draft, []);
            const legacyVariantOptionDraft = currentVariantMode === "legacy"
                ? String(prev.variant_option ?? "")
                : String(getDraftField(prev.legacy_variant_option_draft, ""));
            const combinationVariantOptionsDraft = currentVariantMode === "combination"
                ? normalizeVariantOptionList(prev.variant_options)
                : normalizeVariantOptionList(getDraftField(prev.combination_variant_options_draft, []));
            const combinationFrontendLayoutDraft = currentVariantMode === "combination"
                ? normalizeFrontendVariantLayout(prev.frontend_variant_layout)
                : normalizeFrontendVariantLayout(getDraftField(prev.combination_frontend_variant_layout_draft, "default"));
            const combinationSelectionConfigDraft = currentVariantMode === "combination"
                ? prev.selection_table_config
                : getDraftField(prev.combination_selection_table_config_draft, normalizeSelectionTableConfig(null));

            const nextVariantOptions = nextMode === "combination" ? combinationVariantOptionsDraft : [];
            const nextVariants = nextMode === "combination" ? combinationVariantsDraft : legacyVariantsDraft;
            const nextFrontendLayout = nextMode === "combination" ? combinationFrontendLayoutDraft : "default";
            const nextSelectionTableSourceKeys = [
                ...nextVariantOptions,
                ...variantTableColumns.combination.map((column) => column.key),
            ];

            return {
                ...prev,
                variant_mode: nextMode,
                variants: nextVariants,
                variant_options: nextVariantOptions,
                variant_option: nextMode === "legacy" ? legacyVariantOptionDraft : String(prev.variant_option ?? ""),
                legacy_variants_draft: legacyVariantsDraft,
                combination_variants_draft: combinationVariantsDraft,
                legacy_variant_option_draft: legacyVariantOptionDraft,
                combination_variant_options_draft: combinationVariantOptionsDraft,
                combination_frontend_variant_layout_draft: combinationFrontendLayoutDraft,
                combination_selection_table_config_draft: combinationSelectionConfigDraft,
                frontend_variant_layout: nextFrontendLayout,
                selection_table_config: nextMode === "combination"
                    ? normalizeSelectionTableConfig(
                        combinationSelectionConfigDraft,
                        nextVariantOptions,
                        nextVariants,
                        nextSelectionTableSourceKeys,
                    )
                    : prev.selection_table_config,
            };
        });

        setNewSizeVariant(createEmptySizeVariant());
        setNewCombinationVariant(createEmptyCombinationVariant(
            nextMode === "combination"
                ? normalizeVariantOptionList(currentProduct?.combination_variant_options_draft || currentProduct?.variant_options || [])
                : [],
        ));
        setNewCombinationOptionName("");
    };

    const addCombinationOption = () => {
        const optionName = normalizeVariantOptionName(newCombinationOptionName);
        if (!optionName) {
            toast.error("Enter an option name such as Height or Feature.");
            return;
        }

        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const existingOptions = normalizeVariantOptionList(prev.variant_options);
            if (existingOptions.includes(optionName)) {
                toast.error("That option already exists.");
                return prev;
            }

            const nextOptions = [...existingOptions, optionName];

            return {
                ...prev,
                variant_options: nextOptions,
                variants: (prev.variants || []).map((variant: any) => ({
                    ...variant,
                    attributes: {
                        ...normalizeCombinationAttributes(variant.attributes, existingOptions),
                        [optionName]: "",
                    },
                })),
            };
        });

        setNewCombinationVariant((prev) => ({
            ...prev,
            attributes: {
                ...normalizeCombinationAttributes(prev.attributes, normalizeVariantOptionList(currentProduct?.variant_options)),
                [optionName]: "",
            },
        }));
        setNewCombinationOptionName("");
    };

    const removeCombinationOption = (optionName: string) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const nextOptions = normalizeVariantOptionList(prev.variant_options).filter((option) => option !== optionName);
            const nextSelectionTableConfig = normalizeSelectionTableConfig(
                prev.selection_table_config,
                nextOptions,
                prev.variants || [],
                [
                    ...nextOptions,
                    ...normalizeVariantTableColumns(prev.variant_table_columns).combination.map((column) => column.key),
                ],
            );
            return {
                ...prev,
                variant_options: nextOptions,
                selection_table_config: nextSelectionTableConfig,
                variants: (prev.variants || []).map((variant: any) => ({
                    ...variant,
                    attributes: normalizeCombinationAttributes(variant.attributes, nextOptions),
                })),
            };
        });

        setNewCombinationVariant((prev) => ({
            ...prev,
            attributes: Object.fromEntries(
                Object.entries(prev.attributes || {}).filter(([key]) => key !== optionName),
            ),
        }));
    };

    const updateCombinationVariantAttribute = (index: number, optionName: string, value: string) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            variants[index] = {
                ...variants[index],
                attributes: {
                    ...normalizeCombinationAttributes(variants[index]?.attributes, normalizeVariantOptionList(prev.variant_options)),
                    [optionName]: value,
                },
            };

            return {
                ...prev,
                variants,
            };
        });
    };

    const updateCombinationVariantField = (index: number, field: string, value: unknown) => {
        setCurrentProduct((prev: any) => {
            if (!prev) return prev;

            const variants = [...(prev.variants || [])];
            const nextVariant = {
                ...variants[index],
                [field]: value,
            };

            variants[index] = nextVariant;

            return {
                ...prev,
                variants,
            };
        });
    };

    const appendNewCombinationVariant = () => {
        const optionNames = normalizeVariantOptionList(currentProduct?.variant_options);

        const attributes = normalizeCombinationAttributes(newCombinationVariant.attributes, optionNames);
        const missingOption = optionNames.find((optionName) => !String(attributes[optionName] ?? "").trim());
        if (missingOption) {
            toast.error(`Please enter a value for ${missingOption}.`);
            return;
        }

        setCurrentProduct((prev: any) => ({
            ...prev,
            variants: [
                ...(prev?.variants || []),
                {
                    attributes,
                    price: normalizeVariantPrice(newCombinationVariant.price, prev?.price || ""),
                    stock: normalizeVariantStock(newCombinationVariant.stock),
                    shipping_weight_kg: normalizeShippingNumber(newCombinationVariant.shipping_weight_kg),
                    shipping_length_cm: normalizeShippingNumber(newCombinationVariant.shipping_length_cm),
                    shipping_width_cm: normalizeShippingNumber(newCombinationVariant.shipping_width_cm),
                    shipping_height_cm: normalizeShippingNumber(newCombinationVariant.shipping_height_cm),
                    shipping_class: newCombinationVariant.shipping_class || "",
                    ships_separately: Boolean(newCombinationVariant.ships_separately),
                    custom_fields: normalizeVariantCustomFields(newCombinationVariant.custom_fields),
                },
            ],
        }));

        setNewCombinationVariant(createEmptyCombinationVariant(optionNames));
    };

    const variantTableColumns = currentProduct
        ? normalizeVariantTableColumns(currentProduct.variant_table_columns)
        : cloneVariantTableColumns(DEFAULT_VARIANT_TABLE_COLUMNS);
    const combinationOptionNames = normalizeVariantOptionList(currentProduct?.variant_options);
    const selectionTableSourceKeys = [
        ...combinationOptionNames,
        ...variantTableColumns.combination.map((column) => column.key),
    ];
    const selectionTableConfig = (() => {
        const cfg = normalizeSelectionTableConfig(currentProduct?.selection_table_config, combinationOptionNames, currentProduct?.variants || [], selectionTableSourceKeys);
        if (!cfg.tab_option && combinationOptionNames.some((o) => o.toLowerCase() === "tab")) {
            cfg.tab_option = combinationOptionNames.find((o) => o.toLowerCase() === "tab") || "Tab";
        }
        return cfg;
    })();
    const selectionTableTabValues = getSelectionTableTabValues(selectionTableConfig, currentProduct?.variants || []);
    const selectionTableDataTabValues = selectionTableConfig.tab_option
        ? getSelectionTableSourceValues(currentProduct?.variants || [], selectionTableConfig.tab_option)
        : [];
    const combinationVariantEntries = (currentProduct?.variants || []).map((variant: any, index: number) => ({ variant, index }));
    const visibleSizeColumns = [
        ...variantTableColumns.size.filter((column) => column.visible),
        ...FIXED_SIZE_COLUMNS,
    ];
    const visibleCombinationCustomColumns = variantTableColumns.combination.filter((column) => column.visible);
    const selectionTableTabSources = [
        ...combinationOptionNames.map((optionName) => ({
            key: optionName,
            label: `Option: ${optionName}`,
        })),
        ...variantTableColumns.combination.map((column) => ({
            key: column.key,
            label: `Column: ${column.label}`,
        })),
    ];
    const sizeVariantEntries = (currentProduct?.variants || []).flatMap((variant: any, index: number) => (
        String(variant?.option ?? "").toLowerCase() === "size" ? [{ variant, index }] : []
    ));
    const combinationGroupSource = selectionTableConfig.tab_option && combinationVariantEntries.length > 0
        ? selectionTableConfig.tab_option
        : (combinationOptionNames[0] || "");
    const combinationGroups = combinationVariantEntries.reduce((groups: Array<{ key: string; label: string; items: typeof combinationVariantEntries }>, entry: typeof combinationVariantEntries[number]) => {
        const groupLabel = combinationGroupSource.startsWith("custom:")
            ? String(entry.variant?.custom_fields?.[combinationGroupSource.slice("custom:".length)] ?? "Other").trim() || "Other"
            : String(entry.variant?.attributes?.[combinationGroupSource] ?? "Other").trim() || "Other";
        const groupKey = slugifyVariantGroupKey(groupLabel);
        const existingGroup = groups.find((group) => group.key === groupKey);
        if (existingGroup) {
            existingGroup.items.push(entry);
            return groups;
        }

        groups.push({ key: groupKey, label: groupLabel, items: [entry] });
        return groups;
    }, []);

    const renderSizeVariantCell = (columnKey: string, variant: any, index: number) => {
        const baseInputClass = "rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none";
        const customKey = columnKey.startsWith("custom:") ? columnKey.slice("custom:".length) : null;

        if (customKey) {
            return (
                <input
                    type="text"
                    value={variant?.custom_fields?.[customKey] ?? ""}
                    onChange={(event) => updateVariantCustomField(index, customKey, event.target.value)}
                    className={`w-24 ${baseInputClass}`}
                    placeholder="Value"
                />
            );
        }

        switch (columnKey) {
            case "value":
                return (
                    <input
                        type="text"
                        value={variant.value ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "value", event.target.value)}
                        className={`w-40 ${baseInputClass}`}
                        placeholder="e.g. H600 x W1200 x D500mm"
                    />
                );
            case "price":
                return (
                    <input
                        type="text"
                        value={variant.price ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "price", event.target.value)}
                        className={`w-16 ${baseInputClass}`}
                        placeholder={currentProduct?.price || "£0.00"}
                    />
                );
            case "stock":
                return (
                    <input
                        type="number"
                        min={0}
                        value={variant.stock ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "stock", normalizeVariantStock(event.target.value))}
                        className={`w-16 ${baseInputClass}`}
                    />
                );
            case "shipping_weight_kg":
                return (
                    <input
                        type="number"
                        min={0.01}
                        step="0.001"
                        value={variant.shipping_weight_kg ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "shipping_weight_kg", normalizeShippingNumber(event.target.value))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_length_cm":
                return (
                    <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={variant.shipping_length_cm ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "shipping_length_cm", normalizeShippingNumber(event.target.value))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_width_cm":
                return (
                    <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={variant.shipping_width_cm ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "shipping_width_cm", normalizeShippingNumber(event.target.value))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_height_cm":
                return (
                    <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={variant.shipping_height_cm ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "shipping_height_cm", normalizeShippingNumber(event.target.value))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_class":
                return (
                    <select
                        value={variant.shipping_class ?? ""}
                        onChange={(event) => updateSizeVariantField(index, "shipping_class", event.target.value)}
                        className={`w-24 ${baseInputClass}`}
                    >
                        <option value="">Use base</option>
                        {SHIPPING_CLASS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                );
            case "ships_separately":
                return (
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={Boolean(variant.ships_separately)}
                            onChange={(event) => updateSizeVariantField(index, "ships_separately", event.target.checked)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Yes</span>
                    </label>
                );
            default:
                return null;
        }
    };

    const renderNewSizeVariantCell = (columnKey: string) => {
        const baseInputClass = "rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none";
        const customKey = columnKey.startsWith("custom:") ? columnKey.slice("custom:".length) : null;

        if (customKey) {
            return (
                <input
                    type="text"
                    value={newSizeVariant.custom_fields?.[customKey] ?? ""}
                    onChange={(event) => updateNewVariantCustomField("size", customKey, event.target.value)}
                    className={`w-24 ${baseInputClass}`}
                    placeholder="Value"
                />
            );
        }

        switch (columnKey) {
            case "value":
                return (
                    <input
                        type="text"
                        value={newSizeVariant.value}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, value: event.target.value }))}
                        className={`w-40 ${baseInputClass}`}
                        placeholder="Optional manual label"
                    />
                );
            case "price":
                return (
                    <input
                        type="text"
                        value={newSizeVariant.price}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, price: event.target.value }))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder={currentProduct?.price || "£0.00"}
                    />
                );
            case "stock":
                return (
                    <input
                        type="number"
                        value={newSizeVariant.stock}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, stock: event.target.value }))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="10"
                    />
                );
            case "shipping_weight_kg":
                return (
                    <input
                        type="number"
                        min={0.01}
                        step="0.001"
                        value={newSizeVariant.shipping_weight_kg}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, shipping_weight_kg: event.target.value }))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_length_cm":
                return (
                    <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={newSizeVariant.shipping_length_cm}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, shipping_length_cm: event.target.value }))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_width_cm":
                return (
                    <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={newSizeVariant.shipping_width_cm}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, shipping_width_cm: event.target.value }))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_height_cm":
                return (
                    <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={newSizeVariant.shipping_height_cm}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, shipping_height_cm: event.target.value }))}
                        className={`w-16 ${baseInputClass}`}
                        placeholder="base"
                    />
                );
            case "shipping_class":
                return (
                    <select
                        value={newSizeVariant.shipping_class}
                        onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, shipping_class: event.target.value }))}
                        className={`w-24 ${baseInputClass}`}
                    >
                        <option value="">Use base</option>
                        {SHIPPING_CLASS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                );
            case "ships_separately":
                return (
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={newSizeVariant.ships_separately}
                            onChange={(event) => setNewSizeVariant((prev) => ({ ...prev, ships_separately: event.target.checked }))}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Yes</span>
                    </label>
                );
            default:
                return null;
        }
    };

    const renderCombinationCustomFieldCell = (variant: any, index: number, columnKey: string) => {
        const customKey = columnKey.startsWith("custom:") ? columnKey.slice("custom:".length) : "";
        if (!customKey) {
            return null;
        }

        return (
            <input
                type="text"
                value={variant?.custom_fields?.[customKey] ?? ""}
                onChange={(event) => updateVariantCustomField(index, customKey, event.target.value)}
                className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                placeholder="Value"
            />
        );
    };

    const renderNewCombinationCustomFieldCell = (columnKey: string) => {
        const customKey = columnKey.startsWith("custom:") ? columnKey.slice("custom:".length) : "";
        if (!customKey) {
            return null;
        }

        return (
            <input
                type="text"
                value={newCombinationVariant.custom_fields?.[customKey] ?? ""}
                onChange={(event) => setNewCombinationVariant((prev) => ({
                    ...prev,
                    custom_fields: {
                        ...normalizeVariantCustomFields(prev.custom_fields),
                        [customKey]: event.target.value,
                    },
                }))}
                className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                placeholder="Value"
            />
        );
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Products</h1>
                <button
                    type="button"
                    onClick={() => openEdit()}
                    className="flex items-center gap-2 rounded bg-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-hover"
                >
                    <Plus className="h-4 w-4" /> Add Product
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white flex-1 sm:flex-none"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id.toString()}>{c.name}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Minimum price"
                        placeholder="Min price (£)"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="h-10 w-full sm:w-36 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Maximum price"
                        placeholder="Max price (£)"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="h-10 w-full sm:w-36 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                </div>
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Product" sortKey="name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Category" sortKey="category.name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Status" sortKey="active" sort={sort} onSort={toggleSort} />
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">No products found.</td>
                            </tr>
                        ) : (
                            filteredProducts.map((product) => (
                                <tr key={product.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0">
                                                <ProductImage className="h-10 w-10 rounded-full" src={product.image} alt={product.name} />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                {product.featured && <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Featured</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {product.category?.name || "N/A"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {product.price}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {product.active ? "Active" : "Inactive"}
                                        </span>
                                        {product.track_stock && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Stock: {product.stock_quantity ?? 0}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button type="button" onClick={() => openEdit(product)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDuplicate(product.id)}
                                            className="text-gray-600 hover:text-gray-900 mr-4"
                                            title="Copy product"
                                            aria-label={`Copy ${product.name}`}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Editing Modal */}
            {
                isEditing && (
                    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mt-20 md:mt-0 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                                <h2 className="text-xl font-bold font-sans text-[#10275c]">{currentProduct.id ? "Edit Product" : "New Product"}</h2>
                                <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-500">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={currentProduct.name}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700">Product Code (Optional)</label>
                                        <input
                                            type="text"
                                            maxLength={100}
                                            value={currentProduct.product_code || ""}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, product_code: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            placeholder="e.g. MM-1001"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={currentProduct.show_variant_in_title}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, show_variant_in_title: e.target.checked })}
                                                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 h-4 w-4"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Show variant in product title</span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Price</label>
                                        <input
                                            type="text"
                                            required
                                            value={currentProduct.price}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, price: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Old Price (Optional)</label>
                                        <input
                                            type="text"
                                            value={currentProduct.old_price || ""}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, old_price: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <ImageUpload
                                            label="Product Image"
                                            value={currentProduct.image}
                                            onChange={(url) => setCurrentProduct({ ...currentProduct, image: url })}
                                            adaptiveBackground
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Gallery Images</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                                            {(currentProduct.gallery || []).map((url: string, index: number) => (
                                                <div key={index} className="relative group rounded-md border border-gray-200 overflow-hidden aspect-square">
                                                    <ProductImage src={url} className="h-full w-full" alt={`Gallery ${index}`} />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newGallery = [...(currentProduct.gallery || [])];
                                                            newGallery.splice(index, 1);
                                                            setCurrentProduct({ ...currentProduct, gallery: newGallery });
                                                        }}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="col-span-2 sm:col-span-1 border-2 border-dashed border-gray-300 rounded-md p-2 flex flex-col items-center justify-center">
                                                <ImageUpload
                                                    label=""
                                                    hidePreview={true}
                                                    value=""
                                                    onChange={(url) => setCurrentProduct({ ...currentProduct, gallery: [...(currentProduct.gallery || []), url] })}
                                                />
                                                <span className="text-xs text-gray-500 text-center block w-full mt-1">Add Image</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700">Category</label>
                                        <select
                                            value={currentProduct.product_category_id || ""}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, product_category_id: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
                                        >
                                            <option value="">Select a category</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700">Badge (Optional)</label>
                                        <input
                                            type="text"
                                            value={currentProduct.badge || ""}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, badge: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            placeholder="e.g. -11% or New"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Tags (Comma separated)</label>
                                        <input
                                            type="text"
                                            value={tagsInput}
                                            onChange={(e) => setTagsInput(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                            placeholder="Tag 1, Tag 2"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Specifications</label>
                                        <div className="space-y-3">
                                            {Object.entries(currentProduct.specifications || {}).map(([key, value]: [string, any], index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <div className="flex-1 text-sm bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md font-medium">{key}</div>
                                                    <div className="flex-1 text-sm bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md">{value}</div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newSpecs = { ...currentProduct.specifications };
                                                            delete newSpecs[key];
                                                            setCurrentProduct({ ...currentProduct, specifications: newSpecs });
                                                        }}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Color"
                                                    id="new_spec_key"
                                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1.5 border"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Silver"
                                                    id="new_spec_value"
                                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1.5 border"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const keyEl = document.getElementById('new_spec_key') as HTMLInputElement;
                                                        const valEl = document.getElementById('new_spec_value') as HTMLInputElement;
                                                        const key = keyEl.value.trim();
                                                        const val = valEl.value.trim();
                                                        if (key && val) {
                                                            setCurrentProduct({
                                                                ...currentProduct,
                                                                specifications: {
                                                                    ...(currentProduct.specifications || {}),
                                                                    [key]: val
                                                                }
                                                            });
                                                            keyEl.value = "";
                                                            valEl.value = "";
                                                        }
                                                    }}
                                                    className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <RichTextEditor
                                            label="Description"
                                            value={currentProduct.description || ""}
                                            onChange={(html) => setCurrentProduct({ ...currentProduct, description: html })}
                                        />
                                    </div>
                                    <div className="col-span-2 flex gap-6">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={currentProduct.active}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, active: e.target.checked })}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-600">Active</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={currentProduct.featured}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, featured: e.target.checked })}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-600">Featured</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={currentProduct.track_stock}
                                                onChange={(e) => setCurrentProduct({ ...currentProduct, track_stock: e.target.checked })}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-600">Track Stock</span>
                                        </label>
                                    </div>
                                     <div className="col-span-2 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                                         <label className="block text-sm font-bold text-[#10275c] uppercase tracking-wider">Frontend Layout</label>
                                        <p className="mt-2 text-xs text-gray-500">
                                            Keep the default layout for most products. Use the selection table only when customers need to compare exact combination rows in a structured table.
                                        </p>
                                                        <div className="mt-4 flex flex-wrap gap-4">
                                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                <input
                                                                    type="radio"
                                                                    name="frontend_variant_layout"
                                                                    checked={currentProduct.frontend_variant_layout !== "selection_table"}
                                                                    onChange={() => setCurrentProduct({ ...currentProduct, frontend_variant_layout: "default" })}
                                                                    className="h-4 w-4 border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]"
                                                                />
                                                                <span>Default product page</span>
                                                            </label>
                                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                <input
                                                                    type="radio"
                                                                    name="frontend_variant_layout"
                                                                    checked={currentProduct.frontend_variant_layout === "selection_table"}
                                                                    onChange={() => {
                                                                        setProductVariantMode("combination");
                                                                        setCurrentProduct((prev: any) => ({
                                                                            ...prev,
                                                                            variant_mode: "combination",
                                                                            frontend_variant_layout: "selection_table",
                                                                            selection_table_config: normalizeSelectionTableConfig(prev.selection_table_config, combinationOptionNames, prev.variants || [], selectionTableSourceKeys),
                                                                        }));
                                                                    }}
                                                                    className="h-4 w-4 border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]"
                                                                />
                                                                <span>Selection table</span>
                                                            </label>
                                                        </div>

                                        {currentProduct.variant_mode === "combination" && currentProduct.frontend_variant_layout === "selection_table" && (
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                    Selection table works only with combination pricing.
                                                </div>
                                                                <div className="hidden">
                                                                    <label className="block text-sm font-medium text-gray-700">Tab Group Source</label>
                                                                    <select
                                                                        value={selectionTableConfig.tab_option}
                                                                        onChange={(event) => updateSelectionTableConfig({
                                                                            tab_option: event.target.value,
                                                                            default_tab: "",
                                                                        })}
                                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
                                                                    >
                                                                        <option value="">Choose row group</option>
                                                                        {selectionTableTabSources.map((source) => (
                                                                            <option key={source.key} value={source.key}>{source.label}</option>
                                                                        ))}
                                                                    </select>
                                                                    <p className="mt-1 text-xs text-gray-500">
                                                                        Use an option when the tabs are part of the sellable combination. Use a custom column when the tabs are category labels like Stainless Steel 430 or 304.
                                                                    </p>
                                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Default Tab</label>
                                                    <select
                                                        value={selectionTableConfig.default_tab}
                                                        onChange={(event) => updateSelectionTableConfig({ default_tab: event.target.value })}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
                                                    >
                                                        <option value="">First available tab</option>
                                                        {selectionTableTabValues.map((tabValue) => (
                                                            <option key={tabValue} value={tabValue}>{tabValue}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                                <div className="md:col-span-2 rounded-md border border-gray-200 bg-white p-4">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700">Tab Settings</label>
                                                            <p className="mt-1 text-xs text-gray-500">
                                                                Use this when different tabs need different behaviour, like add-to-cart, call-only, or quote form.
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={newSelectionTableTabValue}
                                                                onChange={(event) => setNewSelectionTableTabValue(event.target.value)}
                                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                                placeholder="Add manual tab"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={addSelectionTableTab}
                                                                className="rounded-md bg-[#10275c] px-3 py-2 text-sm font-medium text-white hover:bg-[#0b1d47]"
                                                            >
                                                                Add Tab
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 space-y-3">
                                                        {selectionTableConfig.tabs.length === 0 ? (
                                                            <p className="text-xs text-gray-500">Tabs will appear after you choose a tab source or add a manual tab.</p>
                                                        ) : selectionTableConfig.tabs.map((tab) => {
                                                            const isDataTab = selectionTableDataTabValues.includes(tab.value);
                                                            const canRemove = !isDataTab;

                                                            return (
                                                                <div key={tab.value} className="rounded-md border border-gray-200 p-3">
                                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_180px_auto] md:items-end">
                                                                        <div>
                                                                            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">Tab Label</label>
                                                                            <input
                                                                                type="text"
                                                                                value={tab.value}
                                                                                onChange={(event) => updateSelectionTableTab(tab.value, { value: event.target.value })}
                                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">Mode</label>
                                                                            <select
                                                                                value={tab.mode}
                                                                                onChange={(event) => updateSelectionTableTab(tab.value, { mode: event.target.value })}
                                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
                                                                            >
                                                                                <option value="table">Add to cart</option>
                                                                                <option value="call">Call only</option>
                                                                                <option value="quote">Quote form</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="flex justify-end">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeSelectionTableTab(tab.value)}
                                                                                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                                                            >
                                                                                Remove
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 border-t pt-6 bg-gray-50/50 py-6 px-1 rounded-lg">
                                        <div className="px-4">
                                            <label className="block text-sm font-bold text-[#10275c] mb-2 uppercase tracking-wider">Product Variants</label>
                                            <p className="text-xs text-gray-500">
                                                Choose the simplest structure that matches how the product is sold, then fill in price, stock, and delivery overrides only where they genuinely differ.
                                            </p>
                                        </div>

                                        <div className="mt-4 px-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <label className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${currentProduct.frontend_variant_layout === "selection_table" ? "cursor-not-allowed opacity-50 border-gray-200 bg-white" : `cursor-pointer ${currentProduct.variant_mode !== "combination" ? "border-[#eb5c10] bg-orange-50/40" : "border-gray-200 bg-white hover:border-gray-300"}`}`}>
                                                    <input
                                                        type="radio"
                                                        name="variant_mode"
                                                        checked={currentProduct.variant_mode !== "combination"}
                                                        onChange={() => setProductVariantMode("legacy")}
                                                        disabled={currentProduct.frontend_variant_layout === "selection_table"}
                                                        className="mt-0.5 h-4 w-4 border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]"
                                                    />
                                                    <span>
                                                        <span className="block text-sm font-semibold text-gray-800">Simple option lists</span>
                                                        <span className="mt-1 block text-xs text-gray-500">Best for straightforward options like Size, Colour, or Finish where customers make one or two simple selections.</span>
                                                    </span>
                                                </label>
                                                <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${currentProduct.variant_mode === "combination" ? "border-[#eb5c10] bg-orange-50/40" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                                                    <input
                                                        type="radio"
                                                        name="variant_mode"
                                                        checked={currentProduct.variant_mode === "combination"}
                                                        onChange={() => setProductVariantMode("combination")}
                                                        className="mt-0.5 h-4 w-4 border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]"
                                                    />
                                                    <span>
                                                        <span className="block text-sm font-semibold text-gray-800">Combination matrix</span>
                                                        <span className="mt-1 block text-xs text-gray-500">Use this when each exact combination, such as Material + Height, needs its own price, stock, or delivery profile.</span>
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        {currentProduct.variant_mode === "combination" ? (
                                            <div className="mt-6 space-y-4 px-4">
                                                <div className="rounded-md border border-gray-200 bg-white p-4">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Sellable Attributes</p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Add the attributes that define each sellable row, such as Material, Height, Depth, Type, or Finish.
                                                    </p>
                                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                                        {combinationOptionNames.filter((o) => o.toLowerCase() !== "tab").map((optionName) => (
                                                                            <span key={optionName} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                                                                                {optionName}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeCombinationOption(optionName)}
                                                                                    className="text-red-400 hover:text-red-600"
                                                                                >
                                                                                    <X className="h-3.5 w-3.5" />
                                                                                </button>
                                                                            </span>
                                                                        ))}
                                                    </div>
                                                    <div className="mt-3 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newCombinationOptionName}
                                                            onChange={(e) => setNewCombinationOptionName(e.target.value)}
                                                            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                            placeholder="e.g. Material"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={addCombinationOption}
                                                            className="rounded-md bg-orange px-3 py-2 text-sm font-semibold text-white hover:bg-orange-hover"
                                                        >
                                                            Add Attribute
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-3 px-1">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Extra Display Columns</p>
                                                        <p className="mt-1 text-xs text-gray-400">
                                                            Add display-only row data such as Part Number, Airflow, Gauge, or P.D. for the optional selection table layout.
                                                        </p>
                                                    </div>
                                                    <VariantColumnManager
                                                        title="Extra Table Columns"
                                                        description="These display-only text columns are stored on each combination row and can be shown on the frontend selection table."
                                                        columns={variantTableColumns.combination}
                                                        onLabelChange={(key, label) => updateVariantTableColumn("combination", key, { label })}
                                                        onVisibilityChange={(key, visible) => updateVariantTableColumn("combination", key, { visible })}
                                                        onFrontendVisibilityChange={(key, frontendVisible) => updateVariantTableColumn("combination", key, { frontendVisible })}
                                                        onAddColumn={(label) => addVariantTableColumn("combination", label)}
                                                    />
                                                </div>

                                                <div className="px-4 text-[11px] text-gray-400">Scroll sideways to edit all columns.</div>
                                                <div className="space-y-4">
                                                    {combinationGroups.length === 0 ? (
                                                        <div className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                                                            No combination rows yet.
                                                        </div>
                                                    ) : combinationGroups.map((group: typeof combinationGroups[number]) => {
                                                        const isCollapsed = Boolean(collapsedCombinationGroups[group.key]);

                                                        return (
                                                            <div key={group.key} className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCollapsedCombinationGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                                                                    className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left"
                                                                >
                                                                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                                                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                        <span>{group.label}</span>
                                                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">{group.items.length} row{group.items.length === 1 ? "" : "s"}</span>
                                                                    </span>
                                                                </button>

                                                                {!isCollapsed && (
                                                                    <div>
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-max min-w-full divide-y divide-gray-200">
                                                                                <thead className="bg-gray-50">
                                                                                    <tr>
                                                                                        {combinationOptionNames.filter((optionName) => optionName.toLowerCase() !== "tab").map((optionName) => (
                                                                                            <th key={optionName} className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{optionName}</th>
                                                                                        ))}
                                                                                        {visibleCombinationCustomColumns.map((column) => (
                                                                                            <th key={column.key} className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">{column.label}</th>
                                                                                        ))}
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Price</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Stock</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Weight (kg)</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Length (cm)</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Width (cm)</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Height (cm)</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Delivery Type</th>
                                                                                        <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Own Parcel</th>
                                                                                        <th className="px-2 py-2 text-right"></th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-200 bg-white">
                                                                                    {group.items.map(({ variant, index }) => (
                                                                                        <tr key={index} className="hover:bg-gray-50 transition-colors align-top">
                                                                                            {combinationOptionNames.filter((optionName) => optionName.toLowerCase() !== "tab").map((optionName) => (
                                                                                                <td key={optionName} className="px-2 py-2">
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        value={variant.attributes?.[optionName] ?? ""}
                                                                                                        onChange={(event) => updateCombinationVariantAttribute(index, optionName, event.target.value)}
                                                                                                        className="w-28 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                                                        placeholder={optionName}
                                                                                                    />
                                                                                                </td>
                                                                                            ))}
                                                                                            {visibleCombinationCustomColumns.map((column) => (
                                                                                                <td key={column.key} className="px-2 py-2">{renderCombinationCustomFieldCell(variant, index, column.key)}</td>
                                                                                            ))}
                                                                                            <td className="px-2 py-2"><input type="text" value={variant.price ?? ""} onChange={(event) => updateCombinationVariantField(index, "price", event.target.value)} className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none" placeholder={currentProduct.price || "£0.00"} /></td>
                                                                                            <td className="px-2 py-2"><input type="number" min={0} value={variant.stock ?? ""} onChange={(event) => updateCombinationVariantField(index, "stock", normalizeVariantStock(event.target.value))} className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none" /></td>
                                                                                            <td className="px-2 py-2"><input type="number" min={0.01} step="0.001" value={variant.shipping_weight_kg ?? ""} onChange={(event) => updateCombinationVariantField(index, "shipping_weight_kg", normalizeShippingNumber(event.target.value))} className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none" placeholder="base" /></td>
                                                                                            <td className="px-2 py-2"><input type="number" min={1} step="0.01" value={variant.shipping_length_cm ?? ""} onChange={(event) => updateCombinationVariantField(index, "shipping_length_cm", normalizeShippingNumber(event.target.value))} className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none" placeholder="base" /></td>
                                                                                            <td className="px-2 py-2"><input type="number" min={1} step="0.01" value={variant.shipping_width_cm ?? ""} onChange={(event) => updateCombinationVariantField(index, "shipping_width_cm", normalizeShippingNumber(event.target.value))} className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none" placeholder="base" /></td>
                                                                                            <td className="px-2 py-2"><input type="number" min={1} step="0.01" value={variant.shipping_height_cm ?? ""} onChange={(event) => updateCombinationVariantField(index, "shipping_height_cm", normalizeShippingNumber(event.target.value))} className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none" placeholder="base" /></td>
                                                                                            <td className="px-2 py-2"><select value={variant.shipping_class ?? ""} onChange={(event) => updateCombinationVariantField(index, "shipping_class", event.target.value)} className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"><option value="">Use base</option>{SHIPPING_CLASS_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}</select></td>
                                                                                            <td className="px-2 py-2"><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={Boolean(variant.ships_separately)} onChange={(event) => updateCombinationVariantField(index, "ships_separately", event.target.checked)} className="rounded border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]" /><span>Yes</span></label></td>
                                                                                            <td className="px-2 py-2 text-right"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => cloneVariantAtIndex(index)} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"><Copy className="w-3.5 h-3.5" />Clone</button><button type="button" onClick={() => removeVariantAtIndex(index)} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />Remove</button></div></td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="border border-gray-200 rounded-md overflow-x-auto shadow-sm bg-white">
                                                        <table className="w-max min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    {combinationOptionNames.filter((optionName) => optionName.toLowerCase() !== "tab").map((optionName) => (
                                                                        <th key={optionName} className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">
                                                                            {optionName}
                                                                        </th>
                                                                    ))}
                                                                    {visibleCombinationCustomColumns.map((column) => (
                                                                        <th key={column.key} className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">
                                                                            {column.label}
                                                                        </th>
                                                                    ))}
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Price</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Stock</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Weight (kg)</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Length (cm)</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Width (cm)</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Height (cm)</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Delivery Type</th>
                                                                    <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-gray-500">Own Parcel</th>
                                                                    <th className="px-2 py-2 text-right"></th>
                                                                </tr>
                                                            </thead>
                                                            <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200">
                                                                <tr>
                                                                    {combinationOptionNames.filter((optionName) => optionName.toLowerCase() !== "tab").map((optionName) => (
                                                                        <td key={optionName} className="px-2 py-2">
                                                                            <input
                                                                                type="text"
                                                                                value={newCombinationVariant.attributes?.[optionName] ?? ""}
                                                                                onChange={(event) => setNewCombinationVariant((prev) => ({
                                                                                    ...prev,
                                                                                    attributes: {
                                                                                        ...normalizeCombinationAttributes(prev.attributes, combinationOptionNames),
                                                                                        [optionName]: event.target.value,
                                                                                    },
                                                                                }))}
                                                                                className="w-28 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                                placeholder={optionName}
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    {visibleCombinationCustomColumns.map((column) => (
                                                                        <td key={column.key} className="px-2 py-2">
                                                                            {renderNewCombinationCustomFieldCell(column.key)}
                                                                        </td>
                                                                    ))}
                                                                    <td className="px-2 py-2">
                                                                        <input
                                                                            type="text"
                                                                            value={newCombinationVariant.price}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, price: event.target.value }))}
                                                                            className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                            placeholder={currentProduct.price || "£0.00"}
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <input
                                                                            type="number"
                                                                            value={newCombinationVariant.stock}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, stock: event.target.value }))}
                                                                            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                            placeholder="10"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <input
                                                                            type="number"
                                                                            min={0.01}
                                                                            step="0.001"
                                                                            value={newCombinationVariant.shipping_weight_kg}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, shipping_weight_kg: event.target.value }))}
                                                                            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                            placeholder="base"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <input
                                                                            type="number"
                                                                            min={1}
                                                                            step="0.01"
                                                                            value={newCombinationVariant.shipping_length_cm}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, shipping_length_cm: event.target.value }))}
                                                                            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                            placeholder="base"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <input
                                                                            type="number"
                                                                            min={1}
                                                                            step="0.01"
                                                                            value={newCombinationVariant.shipping_width_cm}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, shipping_width_cm: event.target.value }))}
                                                                            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                            placeholder="base"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <input
                                                                            type="number"
                                                                            min={1}
                                                                            step="0.01"
                                                                            value={newCombinationVariant.shipping_height_cm}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, shipping_height_cm: event.target.value }))}
                                                                            className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                            placeholder="base"
                                                                        />
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <select
                                                                            value={newCombinationVariant.shipping_class}
                                                                            onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, shipping_class: event.target.value }))}
                                                                            className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                                                        >
                                                                            <option value="">Use base</option>
                                                                            {SHIPPING_CLASS_OPTIONS.map((option) => (
                                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </td>
                                                                    <td className="px-2 py-2">
                                                                        <label className="flex items-center gap-2 text-xs text-gray-600">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={newCombinationVariant.ships_separately}
                                                                                onChange={(event) => setNewCombinationVariant((prev) => ({ ...prev, ships_separately: event.target.checked }))}
                                                                                className="rounded border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]"
                                                                            />
                                                                            <span>Yes</span>
                                                                        </label>
                                                                    </td>
                                                                    <td className="px-2 py-2 text-right">
                                                                        <button
                                                                            type="button"
                                                                            onClick={appendNewCombinationVariant}
                                                                            className="bg-orange text-white py-1.5 px-3 rounded text-xs font-bold hover:bg-orange-hover transition-colors shadow-sm whitespace-nowrap"
                                                                        >
                                                                            Add
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="border border-gray-200 rounded-md overflow-x-auto shadow-sm bg-white">
                                                        <table className="w-max min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    {visibleSizeColumns.map((column) => (
                                                                        <th key={column.key} className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">
                                                                            {column.label}
                                                                        </th>
                                                                    ))}
                                                                    <th className="px-2 py-2 text-right"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {sizeVariantEntries.map(({ variant, index }) => (
                                                                    <tr key={index} className="hover:bg-gray-50 transition-colors align-top">
                                                                        {visibleSizeColumns.map((column) => (
                                                                            <td key={column.key} className="px-2 py-2">
                                                                                {renderSizeVariantCell(column.key, variant, index)}
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-2 py-2 text-right">
                                                                            <div className="flex items-center justify-end gap-1">
                                                                                <button type="button" onClick={() => cloneVariantAtIndex(index)} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"><Copy className="w-3.5 h-3.5" />Clone</button>
                                                                                <button type="button" onClick={() => removeVariantAtIndex(index)} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />Remove</button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-200">
                                                                <tr>
                                                                    {visibleSizeColumns.map((column) => (
                                                                        <td key={column.key} className="px-2 py-2">
                                                                            {renderNewSizeVariantCell(column.key)}
                                                                        </td>
                                                                    ))}
                                                                    <td className="px-2 py-2 text-right">
                                                                        <button
                                                                            type="button"
                                                                            onClick={appendNewSizeVariant}
                                                                            className="bg-orange text-white py-1.5 px-3 rounded text-xs font-bold hover:bg-orange-hover transition-colors shadow-sm whitespace-nowrap"
                                                                        >Add</button>
                                                                    </td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>


                                </div>
                                <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] pb-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-md bg-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:focus:outline-none"
                                    >
                                        Save Product
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
