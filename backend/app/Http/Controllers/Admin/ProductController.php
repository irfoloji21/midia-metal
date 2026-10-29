<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveProductRequest;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Support\HtmlSanitizer;
use App\Support\ProductDescription;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with('category');
        $perPage = max(1, min((int) $request->integer('per_page', 15), 500));

        if ($request->search) {
            $query->where('name', 'like', "%{$request->search}%");
        }
        if ($request->category_id) {
            $query->where('product_category_id', $request->category_id);
        }
        if ($request->active !== null && $request->active !== '') {
            $query->where('active', $request->active);
        }

        return response()->json($query->orderBy('order')->orderBy('created_at', 'desc')->paginate($perPage));
    }

    public function store(SaveProductRequest $request)
    {
        $validated = $request->validated();

        $validated['description'] = HtmlSanitizer::richText($validated['description'] ?? null);
        $validated['price'] = $this->normalizeMoneyValue($validated['price'] ?? null, 'price') ?? '';
        $validated['old_price'] = $this->normalizeMoneyValue($validated['old_price'] ?? null, 'old_price');
        $validated['image'] = trim((string) ($validated['image'] ?? ''));
        $validated['stock_quantity'] = max(0, (int) ($validated['stock_quantity'] ?? 0));
        $validated['slug'] = Str::slug($validated['name']).'-'.Str::random(4);
        $validated['variant_mode'] = ($validated['variant_mode'] ?? 'legacy') === 'combination' ? 'combination' : 'legacy';
        $validated['frontend_variant_layout'] = $this->normalizeFrontendVariantLayout($validated['frontend_variant_layout'] ?? null);
        $validated['variant_options'] = $validated['variant_mode'] === 'combination'
            ? $this->normalizeVariantOptions($validated['variant_options'] ?? null)
            : null;
        $validated['variants'] = $this->normalizeVariants(
            $validated['variants'] ?? null,
            (string) $validated['price'],
            $validated['variant_mode'],
            $validated['variant_options'] ?? null,
        );
        $validated = $this->syncProductFieldsFromVariants($validated);
        $this->assertValidCombinationSetup(
            $validated['variant_mode'],
            $validated['variant_options'] ?? null,
            $validated['variants'] ?? null,
            (bool) ($validated['price_on_request'] ?? false),
        );
        $validated['selection_table_config'] = $this->normalizeSelectionTableConfig(
            $validated['selection_table_config'] ?? null,
            $validated['frontend_variant_layout'],
            $validated['variant_mode'],
            $validated['variant_options'] ?? null,
            $validated['variants'] ?? null,
        );
        $validated['variant_table_columns'] = $this->normalizeVariantTableColumns($validated['variant_table_columns'] ?? null);

        $validated['description'] = ProductDescription::optimize($validated['description']);
        $product = Product::create($validated);

        return response()->json($product->load('category'), 201);
    }

    public function show(Product $product)
    {
        return response()->json($product->load('category'));
    }

    public function update(SaveProductRequest $request, Product $product)
    {
        $validated = $request->validated();

        $validated['description'] = HtmlSanitizer::richText($validated['description'] ?? null);
        $validated['price'] = $this->normalizeMoneyValue($validated['price'] ?? null, 'price') ?? '';
        $validated['old_price'] = $this->normalizeMoneyValue($validated['old_price'] ?? null, 'old_price');
        $validated['image'] = trim((string) ($validated['image'] ?? ''));
        $validated['stock_quantity'] = max(0, (int) ($validated['stock_quantity'] ?? 0));
        $validated['variant_mode'] = ($validated['variant_mode'] ?? $product->variant_mode ?? 'legacy') === 'combination' ? 'combination' : 'legacy';
        $validated['frontend_variant_layout'] = $this->normalizeFrontendVariantLayout(
            $validated['frontend_variant_layout'] ?? $product->frontend_variant_layout ?? null
        );
        $validated['variant_options'] = $validated['variant_mode'] === 'combination'
            ? $this->normalizeVariantOptions($validated['variant_options'] ?? null)
            : null;
        $validated['variants'] = $this->normalizeVariants(
            $validated['variants'] ?? null,
            (string) $validated['price'],
            $validated['variant_mode'],
            $validated['variant_options'] ?? null,
        );
        $validated = $this->syncProductFieldsFromVariants($validated, $product);
        $this->assertValidCombinationSetup(
            $validated['variant_mode'],
            $validated['variant_options'] ?? null,
            $validated['variants'] ?? null,
            (bool) ($validated['price_on_request'] ?? false),
        );
        $validated['selection_table_config'] = $this->normalizeSelectionTableConfig(
            $validated['selection_table_config'] ?? $product->selection_table_config ?? null,
            $validated['frontend_variant_layout'],
            $validated['variant_mode'],
            $validated['variant_options'] ?? null,
            $validated['variants'] ?? null,
        );
        $validated['variant_table_columns'] = $this->normalizeVariantTableColumns($validated['variant_table_columns'] ?? null);

        $validated['description'] = ProductDescription::optimize($validated['description']);
        $product->update($validated);

        return response()->json($product->load('category'));
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }

    public function duplicate(int $product)
    {
        $product = Product::query()->findOrFail($product);

        $duplicate = $product->replicate();
        $duplicate->name = $product->name.' (Copy)';
        $duplicate->slug = Str::slug($duplicate->name).'-'.Str::random(4);
        $duplicate->save();

        return response()->json($duplicate->load('category'), 201);
    }

    public function categories()
    {
        return response()->json(ProductCategory::orderBy('order')->get());
    }

    private function normalizeVariants(
        mixed $variants,
        string $productPrice,
        string $variantMode = 'legacy',
        ?array $variantOptions = null,
    ): ?array {
        if (! is_array($variants) || count($variants) === 0) {
            return null;
        }

        if ($variantMode === 'combination') {
            return $this->normalizeCombinationVariants($variants, $productPrice, $variantOptions ?? []);
        }

        $normalized = [];
        foreach ($variants as $variant) {
            if (! is_array($variant)) {
                continue;
            }

            $option = trim((string) ($variant['option'] ?? ''));
            $value = trim((string) ($variant['value'] ?? ''));
            if ($option === '' || $value === '') {
                continue;
            }

            $stock = $variant['stock'] ?? null;
            $stock = is_numeric($stock) ? max(0, (int) $stock) : null;
            $price = trim((string) ($variant['price'] ?? ''));
            if ($price === '') {
                $price = $productPrice;
            }

            $shippingWeight = $this->normalizeVariantNumeric($variant['shipping_weight_kg'] ?? null, 0.01, 999.999, 3);
            $shippingLength = $this->normalizeVariantNumeric($variant['shipping_length_cm'] ?? null, 1, 999.99, 2);
            $shippingWidth = $this->normalizeVariantNumeric($variant['shipping_width_cm'] ?? null, 1, 999.99, 2);
            $shippingHeight = $this->normalizeVariantNumeric($variant['shipping_height_cm'] ?? null, 1, 999.99, 2);
            $shippingClass = trim((string) ($variant['shipping_class'] ?? ''));
            if (! in_array($shippingClass, ['standard', 'freight'], true)) {
                $shippingClass = null;
            }

            $normalized[] = [
                'option' => $option,
                'value' => $value,
                'price' => $price,
                'stock' => $stock,
                'shipping_weight_kg' => $shippingWeight,
                'shipping_length_cm' => $shippingLength,
                'shipping_width_cm' => $shippingWidth,
                'shipping_height_cm' => $shippingHeight,
                'shipping_class' => $shippingClass,
                'ships_separately' => filter_var($variant['ships_separately'] ?? false, FILTER_VALIDATE_BOOL),
                'custom_fields' => $this->normalizeVariantCustomFields($variant['custom_fields'] ?? null),
            ];
        }

        return count($normalized) > 0 ? $normalized : null;
    }

    private function normalizeVariantOptions(mixed $variantOptions): ?array
    {
        if (! is_array($variantOptions)) {
            return null;
        }

        $normalized = collect($variantOptions)
            ->map(fn ($option) => trim((string) $option))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return count($normalized) > 0 ? $normalized : null;
    }

    private function normalizeCombinationVariants(mixed $variants, string $productPrice, array $variantOptions): ?array
    {
        if (! is_array($variants)) {
            return null;
        }

        $normalized = [];

        foreach ($variants as $variant) {
            if (! is_array($variant)) {
                continue;
            }

            $rawAttributes = is_array($variant['attributes'] ?? null) ? $variant['attributes'] : [];
            $attributes = [];

            foreach ($variantOptions as $option) {
                $value = trim((string) ($rawAttributes[$option] ?? ''));
                if ($value === '') {
                    $attributes = [];
                    break;
                }

                $attributes[$option] = $value;
            }

            if (count($attributes) !== count($variantOptions)) {
                continue;
            }

            $stock = $variant['stock'] ?? null;
            $stock = is_numeric($stock) ? max(0, (int) $stock) : null;
            $price = trim((string) ($variant['price'] ?? ''));
            if ($price === '') {
                $price = $productPrice;
            }

            $shippingWeight = $this->normalizeVariantNumeric($variant['shipping_weight_kg'] ?? null, 0.01, 999.999, 3);
            $shippingLength = $this->normalizeVariantNumeric($variant['shipping_length_cm'] ?? null, 1, 999.99, 2);
            $shippingWidth = $this->normalizeVariantNumeric($variant['shipping_width_cm'] ?? null, 1, 999.99, 2);
            $shippingHeight = $this->normalizeVariantNumeric($variant['shipping_height_cm'] ?? null, 1, 999.99, 2);
            $shippingClass = trim((string) ($variant['shipping_class'] ?? ''));
            if (! in_array($shippingClass, ['standard', 'freight'], true)) {
                $shippingClass = null;
            }

            $normalized[] = [
                'attributes' => $attributes,
                'price' => $price,
                'stock' => $stock,
                'shipping_weight_kg' => $shippingWeight,
                'shipping_length_cm' => $shippingLength,
                'shipping_width_cm' => $shippingWidth,
                'shipping_height_cm' => $shippingHeight,
                'shipping_class' => $shippingClass,
                'ships_separately' => filter_var($variant['ships_separately'] ?? false, FILTER_VALIDATE_BOOL),
                'custom_fields' => $this->normalizeVariantCustomFields($variant['custom_fields'] ?? null),
            ];
        }

        return count($normalized) > 0 ? $normalized : null;
    }

    private function normalizeVariantTableColumns(mixed $columns): ?array
    {
        if (! is_array($columns)) {
            return null;
        }

        $defaults = $this->defaultVariantTableColumns();
        $normalized = [];

        foreach ($defaults as $section => $defaultColumns) {
            $providedColumns = $columns[$section] ?? [];
            $providedByKey = [];
            $reservedKeys = $section === 'size'
                ? ['value', 'shipping_class', 'ships_separately']
                : [];

            if (is_array($providedColumns)) {
                foreach ($providedColumns as $column) {
                    if (! is_array($column)) {
                        continue;
                    }

                    $key = trim((string) ($column['key'] ?? ''));
                    if ($key === '' || in_array($key, $reservedKeys, true)) {
                        continue;
                    }

                    $providedByKey[$key] = $column;
                }
            }

            $defaultKeys = array_map(fn (array $column) => $column['key'], $defaultColumns);

            $normalized[$section] = array_map(function (array $defaultColumn) use ($providedByKey) {
                $key = $defaultColumn['key'];
                $candidate = $providedByKey[$key] ?? [];
                $label = trim((string) ($candidate['label'] ?? $defaultColumn['label']));

                return [
                    'key' => $key,
                    'label' => $label !== '' ? $label : $defaultColumn['label'],
                    'visible' => filter_var($candidate['visible'] ?? $defaultColumn['visible'], FILTER_VALIDATE_BOOL),
                    'frontendVisible' => filter_var($candidate['frontendVisible'] ?? $defaultColumn['frontendVisible'], FILTER_VALIDATE_BOOL),
                ];
            }, $defaultColumns);

            if (is_array($providedColumns)) {
                foreach ($providedColumns as $column) {
                    if (! is_array($column)) {
                        continue;
                    }

                    $key = trim((string) ($column['key'] ?? ''));
                    if ($key === '' || in_array($key, $defaultKeys, true) || in_array($key, $reservedKeys, true)) {
                        continue;
                    }

                    $label = trim((string) ($column['label'] ?? ''));

                    $normalized[$section][] = [
                        'key' => $key,
                        'label' => $label !== '' ? $label : 'Custom Column',
                        'visible' => filter_var($column['visible'] ?? true, FILTER_VALIDATE_BOOL),
                        'frontendVisible' => filter_var($column['frontendVisible'] ?? true, FILTER_VALIDATE_BOOL),
                    ];
                }
            }
        }

        if (in_array($columns['dimension_unit'] ?? null, ['mm', 'cm', 'm'], true)) {
            $normalized['dimension_unit'] = $columns['dimension_unit'];
        }

        return $normalized;
    }

    private function defaultVariantTableColumns(): array
    {
        return [
            'size' => [
                ['key' => 'price', 'label' => 'Price', 'visible' => true, 'frontendVisible' => false],
                ['key' => 'stock', 'label' => 'Stock', 'visible' => true, 'frontendVisible' => false],
                ['key' => 'shipping_weight_kg', 'label' => 'Weight (kg)', 'visible' => true, 'frontendVisible' => true],
                ['key' => 'shipping_length_cm', 'label' => 'Length (cm)', 'visible' => true, 'frontendVisible' => true],
                ['key' => 'shipping_width_cm', 'label' => 'Width (cm)', 'visible' => true, 'frontendVisible' => true],
                ['key' => 'shipping_height_cm', 'label' => 'Height (cm)', 'visible' => true, 'frontendVisible' => true],
            ],
            'general' => [
                ['key' => 'option', 'label' => 'Option', 'visible' => true, 'frontendVisible' => true],
                ['key' => 'value', 'label' => 'Value', 'visible' => true, 'frontendVisible' => true],
                ['key' => 'stock', 'label' => 'Stock', 'visible' => true, 'frontendVisible' => false],
            ],
            'combination' => [],
        ];
    }

    private function normalizeFrontendVariantLayout(mixed $value): string
    {
        return trim((string) $value) === 'selection_table' ? 'selection_table' : 'default';
    }

    private function normalizeSelectionTableConfig(
        mixed $config,
        string $frontendVariantLayout,
        string $variantMode,
        ?array $variantOptions,
        ?array $variants,
    ): ?array {
        if (! is_array($config)) {
            return null;
        }

        $safeVariantOptions = collect($variantOptions ?? [])
            ->map(fn ($option) => trim((string) $option))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $resolveOption = function (mixed $value) use ($safeVariantOptions): ?string {
            $raw = trim((string) $value);
            $normalized = strtolower($raw);
            if ($normalized === '') {
                return null;
            }

            if (str_starts_with($raw, 'custom:')) {
                return $raw;
            }

            foreach ($safeVariantOptions as $option) {
                if (strtolower(trim((string) $option)) === $normalized) {
                    return $option;
                }
            }

            return null;
        };

        $tabOption = $resolveOption($config['tab_option'] ?? null);
        $variantTabValues = [];

        if ($tabOption && is_array($variants)) {
            foreach ($variants as $variant) {
                if (! is_array($variant)) {
                    continue;
                }

                if (str_starts_with($tabOption, 'custom:')) {
                    $customKey = substr($tabOption, strlen('custom:'));
                    $normalizedValue = trim((string) data_get($variant, 'custom_fields.'.$customKey, ''));
                    if ($normalizedValue !== '') {
                        $variantTabValues[] = $normalizedValue;
                    }

                    continue;
                }

                $rawAttributes = is_array($variant['attributes'] ?? null) ? $variant['attributes'] : [];
                foreach ($rawAttributes as $attributeKey => $attributeValue) {
                    if (strtolower(trim((string) $attributeKey)) !== strtolower($tabOption)) {
                        continue;
                    }

                    $normalizedValue = trim((string) $attributeValue);
                    if ($normalizedValue !== '') {
                        $variantTabValues[] = $normalizedValue;
                    }
                }
            }
        }

        $variantTabValues = collect($variantTabValues)->filter()->unique()->values()->all();

        $quoteTabValues = collect($config['quote_tab_values'] ?? [])
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $normalizeTabMode = function (mixed $value): string {
            $mode = strtolower(trim((string) $value));

            return in_array($mode, ['call', 'quote'], true) ? $mode : 'table';
        };

        $tabCandidates = collect($config['tabs'] ?? [])
            ->filter(fn ($tab) => is_array($tab))
            ->map(fn ($tab) => trim((string) ($tab['value'] ?? '')))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $tabCandidates = collect([...$variantTabValues, ...$tabCandidates])
            ->filter()
            ->unique()
            ->values()
            ->all();

        $tabs = collect($config['tabs'] ?? [])
            ->map(function ($tab) use ($tabCandidates, $quoteTabValues, $normalizeTabMode) {
                if (! is_array($tab)) {
                    return null;
                }

                $rawValue = trim((string) ($tab['value'] ?? ''));
                if ($rawValue === '') {
                    return null;
                }

                $resolvedValue = collect($tabCandidates)
                    ->first(fn ($candidate) => strtolower((string) $candidate) === strtolower($rawValue)) ?? $rawValue;

                return [
                    'value' => $resolvedValue,
                    'mode' => $normalizeTabMode($tab['mode'] ?? (in_array($resolvedValue, $quoteTabValues, true) ? 'quote' : 'table')),
                    'heading' => trim((string) ($tab['heading'] ?? '')) ?: null,
                    'intro_text' => trim((string) ($tab['intro_text'] ?? '')) ?: null,
                ];
            })
            ->filter()
            ->unique('value')
            ->values();

        $availableTabs = collect([...$tabs->pluck('value')->all(), ...$variantTabValues])
            ->filter()
            ->unique()
            ->values()
            ->all();

        foreach ($availableTabs as $availableTab) {
            if ($tabs->contains(fn ($tab) => strtolower((string) ($tab['value'] ?? '')) === strtolower((string) $availableTab))) {
                continue;
            }

            $tabs->push([
                'value' => $availableTab,
                'mode' => in_array($availableTab, $quoteTabValues, true) ? 'quote' : 'table',
                'heading' => null,
                'intro_text' => null,
            ]);
        }

        $tabs = $tabs->values();
        $quoteTabValues = collect([
            ...$quoteTabValues,
            ...$tabs
                ->filter(fn ($tab) => ($tab['mode'] ?? 'table') === 'quote')
                ->pluck('value')
                ->values()
                ->all(),
        ])
            ->filter()
            ->unique()
            ->values()
            ->all();

        $defaultTab = trim((string) ($config['default_tab'] ?? ''));
        if ($defaultTab === '' || ! in_array($defaultTab, $availableTabs, true)) {
            $defaultTab = null;
        }

        $quoteFormLayout = strtolower(trim((string) ($config['quote_form_layout'] ?? '')));
        if (! in_array($quoteFormLayout, ['default', 'baffle_non_standard'], true)) {
            $quoteFormLayout = null;
        }

        $normalized = [
            'intro_text' => trim((string) ($config['intro_text'] ?? '')) ?: null,
            'tab_option' => $tabOption,
            'default_tab' => $defaultTab,
            'quote_tab_values' => count($quoteTabValues) > 0 ? $quoteTabValues : null,
            'quote_intro_text' => trim((string) ($config['quote_intro_text'] ?? '')) ?: null,
            'quote_submit_label' => trim((string) ($config['quote_submit_label'] ?? '')) ?: null,
            'quote_form_layout' => $quoteFormLayout,
            'tabs' => $tabs->map(function ($tab) {
                return collect($tab)
                    ->reject(fn ($value) => $value === null || $value === '')
                    ->all();
            })->filter()->values()->all(),
        ];

        return collect($normalized)
            ->reject(fn ($value) => $value === null || $value === '')
            ->all();
    }

    private function normalizeVariantCustomFields(mixed $fields): ?array
    {
        if (! is_array($fields)) {
            return null;
        }

        $normalized = [];

        foreach ($fields as $key => $value) {
            $normalizedKey = trim((string) $key);
            if ($normalizedKey === '') {
                continue;
            }

            $normalized[$normalizedKey] = (string) ($value ?? '');
        }

        return count($normalized) > 0 ? $normalized : null;
    }

    private function normalizeVariantNumeric(mixed $value, float $min, float $max, int $precision): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        $numeric = (float) $value;
        if ($numeric < $min || $numeric > $max) {
            return null;
        }

        return round($numeric, $precision);
    }

    private function normalizeMoneyValue(mixed $value, string $field): ?string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return null;
        }

        $normalized = preg_replace('/[^\d.,-]/', '', $raw);
        $normalized = is_string($normalized) ? str_replace(',', '', $normalized) : '';

        if ($normalized === '' || ! is_numeric($normalized)) {
            throw ValidationException::withMessages([
                $field => 'The '.str_replace('_', ' ', $field).' field must be a valid money amount.',
            ]);
        }

        return '£'.number_format((float) $normalized, 2, '.', '');
    }

    private function assertValidCombinationSetup(string $variantMode, ?array $variantOptions, ?array $variants, bool $priceOnRequest = false): void
    {
        if ($variantMode !== 'combination' || $priceOnRequest) {
            return;
        }

        if (! is_array($variants) || count($variants) === 0) {
            throw ValidationException::withMessages([
                'variants' => 'Add at least one complete combination row.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function syncProductFieldsFromVariants(array $validated, ?Product $product = null): array
    {
        // Quote-only products may have no variants. Their nullable form fields
        // still need the non-null database defaults; edits retain saved values.
        foreach (['shipping_weight_kg' => 2, 'shipping_length_cm' => 30, 'shipping_width_cm' => 20, 'shipping_height_cm' => 10, 'shipping_class' => 'standard'] as $field => $default) {
            $validated[$field] = $validated[$field] ?? $product?->{$field} ?? $default;
        }
        $validated['ships_separately'] = (bool) ($validated['ships_separately'] ?? $product?->ships_separately ?? false);

        $variants = collect($validated['variants'] ?? [])->filter(fn ($variant) => is_array($variant))->values();
        if ($variants->isEmpty()) {
            return $validated;
        }

        $prices = $variants
            ->map(function (array $variant) {
                $price = $this->normalizeMoneyValue($variant['price'] ?? null, 'price');
                if (! $price) {
                    return null;
                }

                return [
                    'display' => $price,
                    'value' => (float) preg_replace('/[^0-9.\-]/', '', $price),
                ];
            })
            ->filter();

        if ($prices->isNotEmpty() && ! ($validated['price_on_request'] ?? false)) {
            $validated['price'] = $prices->sortBy('value')->first()['display'];
        }

        $trackedStocks = $variants
            ->pluck('stock')
            ->filter(fn ($stock) => $stock !== null && $stock !== '');

        $validated['stock_quantity'] = $trackedStocks->isNotEmpty()
            ? (int) $trackedStocks->sum(fn ($stock) => max(0, (int) $stock))
            : null;

        $primaryVariant = $variants->first();
        $validated['shipping_weight_kg'] = $primaryVariant['shipping_weight_kg'] ?? ($validated['shipping_weight_kg'] ?? 2);
        $validated['shipping_length_cm'] = $primaryVariant['shipping_length_cm'] ?? ($validated['shipping_length_cm'] ?? 30);
        $validated['shipping_width_cm'] = $primaryVariant['shipping_width_cm'] ?? ($validated['shipping_width_cm'] ?? 20);
        $validated['shipping_height_cm'] = $primaryVariant['shipping_height_cm'] ?? ($validated['shipping_height_cm'] ?? 10);
        $validated['shipping_class'] = $primaryVariant['shipping_class'] ?? ($validated['shipping_class'] ?? 'standard');
        $validated['ships_separately'] = (bool) ($primaryVariant['ships_separately'] ?? false);

        return $validated;
    }
}
