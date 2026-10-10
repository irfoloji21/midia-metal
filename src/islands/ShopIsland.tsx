import { useState, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { apiFetch } from "@/lib/api";
import { getAvailableStock } from "@/lib/stock";
import type { Product, ProductCategory } from "@/types/product";
import ProductImage from "@/components/ProductImage";
import { getStandardizedDisplayPrice, getStandardizedDisplayTitle, shouldShowOldPrice } from "@/lib/pricing";
import { getVariantAttributes, getProductVariantMode } from "@/lib/variants";

type VariantFilters = Record<string, string[]>;
type VariantFacet = {
  key: string;
  option: string;
  values: Array<{ value: string; count: number }>;
};

const DEFAULT_PRICE_RANGE: [number, number] = [0, 5000];

const parsePriceValue = (price: unknown): number => {
  if (typeof price === "number") return price;
  return parseFloat(String(price ?? "").replace(/[^\d.]/g, "")) || 0;
};

const normalizeVariantKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const parseVariantFiltersFromParams = (params: URLSearchParams): VariantFilters => {
  const next: VariantFilters = {};
  for (const raw of params.getAll("variant")) {
    const [option, value] = raw.split("::");
    const optionKey = normalizeVariantKey(option || "");
    if (!optionKey || !value) continue;
    if (!next[optionKey]) next[optionKey] = [];
    if (!next[optionKey].includes(value)) next[optionKey].push(value);
  }
  return next;
};

const writeVariantFiltersToParams = (params: URLSearchParams, filters: VariantFilters) => {
  params.delete("variant");
  Object.entries(filters).forEach(([optionKey, values]) => {
    values.forEach((value) => params.append("variant", `${optionKey}::${value}`));
  });
};

const buildVariantFacets = (items: any[]): VariantFacet[] => {
  const optionMap = new Map<string, { label: string; values: Map<string, number> }>();
  items.forEach((product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    variants.forEach((variant: any) => {
      if (getProductVariantMode(product) === "combination") {
        Object.entries(getVariantAttributes(variant)).forEach(([option, value]) => {
          const optionKey = normalizeVariantKey(option);
          if (!optionKey || !value) return;
          if (!optionMap.has(optionKey)) optionMap.set(optionKey, { label: option.toUpperCase(), values: new Map() });
          const entry = optionMap.get(optionKey)!;
          entry.values.set(value, (entry.values.get(value) || 0) + 1);
        });
        return;
      }

      const option = String(variant?.option ?? "").trim();
      const value = String(variant?.value ?? "").trim();
      const optionKey = normalizeVariantKey(option);
      if (!optionKey || !value) return;
      if (!optionMap.has(optionKey)) optionMap.set(optionKey, { label: option.toUpperCase(), values: new Map() });
      const entry = optionMap.get(optionKey)!;
      entry.values.set(value, (entry.values.get(value) || 0) + 1);
    });
  });

  return Array.from(optionMap.entries())
    .map(([key, entry]) => ({
      key,
      option: entry.label,
      values: Array.from(entry.values.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value)),
    }))
    .sort((a, b) => a.option.localeCompare(b.option));
};

const matchesVariantFilters = (product: any, filters: VariantFilters): boolean => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (getProductVariantMode(product) === "combination") {
    return Object.entries(filters).every(([optionKey, selectedValues]) => {
      if (selectedValues.length === 0) return true;

      return variants.some((variant: any) => {
        const attributes = getVariantAttributes(variant);
        const productValue = Object.entries(attributes).find(([option]) => normalizeVariantKey(option) === optionKey)?.[1];
        return productValue ? selectedValues.includes(productValue) : false;
      });
    });
  }

  return Object.entries(filters).every(([optionKey, selectedValues]) => {
    if (selectedValues.length === 0) return true;
    const productValues = variants
      .filter((variant: any) => normalizeVariantKey(String(variant?.option ?? "")) === optionKey)
      .map((variant: any) => String(variant?.value ?? "").trim());
    return selectedValues.some((value) => productValues.includes(value));
  });
};

export default function ShopIsland({
  initialProducts,
  initialCategories,
  initialTags,
  initialSearchParams: initialSearchParamsStr = '',
}: {
  initialProducts?: any[];
  initialCategories?: any[];
  initialTags?: string[];
  initialSearchParams?: string;
} = {}) {
  // Parse search params from server-provided string (no window dependency at init)
  const [searchParams, setSearchParams] = useState(() => {
    const src = typeof window !== 'undefined' ? window.location.search : initialSearchParamsStr;
    return new URLSearchParams(src);
  });
  const [sortBy, setSortBy] = useState("latest");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("category"));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [inStockOnly, setInStockOnly] = useState(searchParams.get("stock") === "1");
  const [selectedVariantFilters, setSelectedVariantFilters] = useState<VariantFilters>(parseVariantFiltersFromParams(searchParams));

  const [products, setProducts] = useState<any[]>(initialProducts || []);
  const [categories, setCategories] = useState<any[]>(initialCategories || []);
  const [tags, setTags] = useState<string[]>(initialTags || []);
  const [variantFacets, setVariantFacets] = useState<VariantFacet[]>(() => buildVariantFacets(initialProducts || []));
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  // Track whether this is the initial mount — skip redundant loadProducts on first render if we have SSR data
  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    // Skip initial data fetch if already provided via props
    if (!initialCategories || !initialTags) {
      loadInitialData();
    }
  }, []);

  const loadInitialData = async () => {
    try {
      const [catsRes, tagsRes] = await Promise.all([
        apiFetch<ProductCategory[]>("/v1/product-categories"),
        apiFetch<string[]>("/v1/products/tags")
      ]);
      setCategories(catsRes || []);
      setTags(tagsRes || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // On initial mount with SSR data, skip the redundant API call
    if (isInitialMount) {
      setIsInitialMount(false);
      if (initialProducts && initialProducts.length > 0) return;
    }
    loadProducts();
  }, [searchQuery, selectedCategory, selectedTags, sortBy, priceRange, inStockOnly, selectedVariantFilters]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (searchQuery) query.set("search", searchQuery);
      if (selectedCategory) query.set("category", selectedCategory);
      if (inStockOnly) query.set("in_stock", "1");
      const queryString = query.toString();
      const res = await apiFetch<{ data: Product[] }>(`/v1/products${queryString ? `?${queryString}` : ""}`);

      let fetchedProducts = res.data || [];

      if (selectedTags.length > 0) {
        fetchedProducts = fetchedProducts.filter((product: any) => {
          const productTags = Array.isArray(product?.tags) ? product.tags : [];
          return selectedTags.some((tag) => productTags.includes(tag));
        });
      }

      fetchedProducts = fetchedProducts.filter((p: any) => {
        const price = parsePriceValue(getStandardizedDisplayPrice(p));
        const matchesPrice = price >= priceRange[0] && price <= priceRange[1];
        const matchesStock = !inStockOnly || !p.track_stock || Number(getAvailableStock(p) ?? 0) > 0;
        return matchesPrice && matchesStock;
      });

      setVariantFacets(buildVariantFacets(fetchedProducts));

      fetchedProducts = fetchedProducts.filter((product: any) => matchesVariantFilters(product, selectedVariantFilters));

      fetchedProducts.sort((a: any, b: any) => {
        const priceA = parsePriceValue(getStandardizedDisplayPrice(a));
        const priceB = parsePriceValue(getStandardizedDisplayPrice(b));
        if (sortBy === "price-low") return priceA - priceB;
        if (sortBy === "price-high") return priceB - priceA;
        return 0;
      });

      setProducts(fetchedProducts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery(searchParams.get("search") || "");
    setSelectedCategory(searchParams.get("category"));
    setInStockOnly(searchParams.get("stock") === "1");
    setSelectedVariantFilters(parseVariantFiltersFromParams(searchParams));
  }, [searchParams]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set("search", value);
    else newParams.delete("search");
    setSearchParams(newParams);
    window.history.replaceState({}, '', '?' + newParams.toString());
  };

  const handleCategoryChange = (categorySlug: string | null) => {
    setSelectedCategory(categorySlug);
    const newParams = new URLSearchParams(searchParams);
    if (categorySlug) newParams.set("category", categorySlug);
    else newParams.delete("category");
    setSearchParams(newParams);
    window.history.replaceState({}, '', '?' + newParams.toString());
  };

  const handleStockChange = (checked: boolean) => {
    setInStockOnly(checked);
    const newParams = new URLSearchParams(searchParams);
    if (checked) newParams.set("stock", "1");
    else newParams.delete("stock");
    setSearchParams(newParams);
    window.history.replaceState({}, '', '?' + newParams.toString());
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const toggleVariantFilter = (optionKey: string, value: string) => {
    setSelectedVariantFilters((prev) => {
      const existing = prev[optionKey] || [];
      const nextValues = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];

      const next = { ...prev };
      if (nextValues.length > 0) next[optionKey] = nextValues;
      else delete next[optionKey];

      const newParams = new URLSearchParams(searchParams);
      writeVariantFiltersToParams(newParams, next);
      setSearchParams(newParams);
      window.history.replaceState({}, '', '?' + newParams.toString());

      return next;
    });
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTags([]);
    setPriceRange(DEFAULT_PRICE_RANGE);
    setInStockOnly(false);
    setSelectedVariantFilters({});

    const newParams = new URLSearchParams(searchParams);
    newParams.delete("category");
    newParams.delete("stock");
    writeVariantFiltersToParams(newParams, {});
    setSearchParams(newParams);
    window.history.replaceState({}, '', '?' + newParams.toString());
  };

  const hasActiveSidebarFilters = Boolean(
    selectedCategory ||
    selectedTags.length > 0 ||
    inStockOnly ||
    priceRange[0] !== DEFAULT_PRICE_RANGE[0] ||
    priceRange[1] !== DEFAULT_PRICE_RANGE[1] ||
    Object.keys(selectedVariantFilters).length > 0
  );

  return (
    <>
      <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-20 pb-20 md:pb-24">
        <div className="shop-layout grid gap-6 md:gap-8 lg:gap-10 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
          <div>
            <div className="flex items-center justify-between mb-8">
              <p className="text-[13px] text-[#9aa6bc]">Showing {products.length} results</p>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-transparent pr-8 text-[14px] font-semibold text-primary outline-none"
                >
                  <option value="latest">Sort by latest</option>
                  <option value="price-low">Sort by price: low to high</option>
                  <option value="price-high">Sort by price: high to low</option>
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/80 pointer-events-none" />
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-[#6e7a92] bg-[#f4f5f7] border border-[#d5deea]">Loading products...</div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 gap-y-9">
                  {products.map((p) => (
                    <a href={`/shop/${p.slug}`} key={p.id} className="group">
                      <div className="bg-[#f7f8fa] mb-4">
                        <ProductImage src={p.image} alt={p.name} className="w-full aspect-square" imageClassName="transition-transform duration-300 group-hover:scale-[1.02]" />
                      </div>
                      <h3 className="font-sans text-[16px] md:text-[20px] leading-tight font-semibold text-orange transition-colors">
                        {getStandardizedDisplayTitle(p)}
                      </h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-[14px] md:text-[20px] font-semibold text-[#1f2f52]">{getStandardizedDisplayPrice(p)}</p>
                        {shouldShowOldPrice(p.old_price, getStandardizedDisplayPrice(p)) && (
                          <p className="text-[12px] md:text-[14px] text-[#9aa6bc] line-through font-normal">
                            {p.old_price}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-[#6e7a92] bg-[#f4f5f7] border border-[#d5deea]">
                No products found.
              </div>
            )}
          </div>

          <aside className="bg-[#f4f5f7] p-6 md:p-8 h-fit lg:self-start">
            <div className="space-y-8">
              <div>
                <h3 className="text-[16px] leading-none font-semibold text-primary mb-5 font-sans">Search</h3>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a95ac]" />
                  <input
                    type="text"
                    placeholder="Search for products ..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full h-12 border border-[#d1dbe8] bg-transparent pl-12 pr-4 text-[14px] text-primary placeholder:text-[#9aa6bc] outline-none"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-[16px] leading-none font-semibold text-primary mb-5 font-sans">Categories</h3>
                <ul className="space-y-3">
                  {categories.map((c: any) => (
                    <li key={c.id}>
                      <button
                        onClick={() => handleCategoryChange(selectedCategory === c.slug ? null : c.slug)}
                        className={cn(
                          "text-[15px] inline-flex items-center gap-2 transition-colors",
                          selectedCategory === c.slug ? "text-orange font-semibold" : "text-primary hover:text-orange",
                        )}
                      >
                        <span className="text-[8px]">•</span>
                        {c.name} ({c.products_count})
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h3 className="text-[16px] leading-none font-semibold text-primary font-sans">Filter</h3>
                  {hasActiveSidebarFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-[12px] font-semibold text-orange hover:text-orange-hover transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="h-1 bg-orange mb-4" />
                <Slider
                  defaultValue={[50, 2000]}
                  min={50}
                  max={2000}
                  step={50}
                  value={[priceRange[0], priceRange[1]]}
                  onValueChange={(value) => setPriceRange(value as [number, number])}
                />
                <p className="text-[15px] text-[#9aa6bc] mt-5">Price: £{priceRange[0]} — £{priceRange[1]}</p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-3 text-[14px] font-medium text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => handleStockChange(e.target.checked)}
                      className="h-4 w-4 accent-orange"
                    />
                    In stock only
                  </label>
                </div>
              </div>

              {variantFacets.length > 0 && (
                <div>
                  <h3 className="text-[16px] leading-none font-semibold text-primary mb-5 font-sans">Variants</h3>
                  <div className="space-y-5">
                    {variantFacets.map((facet) => (
                      <div key={facet.key}>
                        <p className="text-[12px] uppercase tracking-wide font-semibold text-[#6e7a92] mb-2">
                          {facet.option}
                        </p>
                        <div className="space-y-2">
                          {facet.values.map(({ value, count }) => {
                            const checked = (selectedVariantFilters[facet.key] || []).includes(value);
                            return (
                              <label
                                key={`${facet.key}-${value}`}
                                className="flex items-center justify-between gap-3 text-[14px] text-primary cursor-pointer"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleVariantFilter(facet.key, value)}
                                    className="h-4 w-4 accent-orange"
                                  />
                                  {value}
                                </span>
                                <span className="text-[12px] text-[#8f9bb2]">{count}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-[16px] leading-none font-semibold text-primary mb-5 font-sans">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "h-8 px-4 border text-[12px] transition-colors",
                        selectedTags.includes(tag)
                          ? "bg-orange text-white border-orange"
                          : "border-[#d1dbe8] text-[#6e7a92] hover:text-orange hover:border-orange",
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
