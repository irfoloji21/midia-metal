<?php

namespace App\Support;

use App\Models\Coupon;
use App\Models\Product;
use App\Shipping\ShippingQuoteStore;
use Illuminate\Validation\ValidationException;

class CheckoutCalculator
{
    private const VAT_RATE = 20.0;

    public function __construct(private ShippingQuoteStore $shippingQuoteStore) {}

    public function calculate(
        array $items,
        ?string $couponCode = null,
        string $fulfilmentMethod = 'delivery',
        ?string $shippingOptionToken = null,
    ): array {
        if (count($items) === 0) {
            throw ValidationException::withMessages([
                'items' => ['At least one item is required.'],
            ]);
        }

        $productIds = collect($items)
            ->pluck('product_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');

        if ($products->count() !== $productIds->count()) {
            throw ValidationException::withMessages([
                'items' => ['One or more products are no longer available.'],
            ]);
        }

        $requestedStock = [];
        $lineItems = collect($items)->map(function (array $item, int $index) use ($products, &$requestedStock) {
            $productId = (int) ($item['product_id'] ?? 0);
            $quantity = max(1, (int) ($item['quantity'] ?? 1));
            /** @var Product|null $product */
            $product = $products->get($productId);

            if (! $product || ! $product->active) {
                throw ValidationException::withMessages([
                    "items.$index.product_id" => ['This product is no longer available.'],
                ]);
            }

            if ($product->price_on_request) {
                throw ValidationException::withMessages([
                    "items.$index.product_id" => ["Please contact us for a price for {$product->name}. This product cannot be purchased online."],
                ]);
            }

            if (($product->variants === null || count($product->variants) === 0)
                && $product->track_stock
                && $product->stock_quantity !== null
                && $product->stock_quantity < $quantity) {
                throw ValidationException::withMessages([
                    "items.$index.quantity" => ["Only {$product->stock_quantity} unit(s) of {$product->name} are currently in stock."],
                ]);
            }

            $variantDetails = $this->resolveVariants($product, $item['selected_variants'] ?? [], $quantity, $index);
            $this->checkCombinedStock($product, $variantDetails, $quantity, $index, $requestedStock);
            $unitPrice = $this->resolveUnitPrice($product, $variantDetails);

            return [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_price' => $this->formatMoney($unitPrice),
                'quantity' => $quantity,
                'variant_details' => $variantDetails,
                'unit_price' => $unitPrice,
                'line_total' => round($unitPrice * $quantity, 2),
            ];
        });

        $subtotal = round($lineItems->sum('line_total'), 2);
        $selectedShippingOption = null;

        if ($subtotal > 0 && $fulfilmentMethod !== 'click_collect') {
            if (! $shippingOptionToken) {
                throw ValidationException::withMessages([
                    'shipping_option_token' => ['Please choose a delivery option.'],
                ]);
            }

            $selectedShippingOption = $this->shippingQuoteStore->resolve($shippingOptionToken);

            if (! $selectedShippingOption) {
                throw ValidationException::withMessages([
                    'shipping_option_token' => ['The selected delivery option has expired. Please choose a delivery option again.'],
                ]);
            }

            $shipping = round($this->parseMoney((string) ($selectedShippingOption['rate'] ?? 0)), 2);
        } else {
            $shipping = 0.0;
        }

        $coupon = null;
        $discountAmount = 0.0;
        if ($couponCode) {
            $coupon = Coupon::where('code', strtoupper(trim($couponCode)))->first();

            if (! $coupon || ! $coupon->isValid($subtotal)) {
                throw ValidationException::withMessages([
                    'coupon_code' => ['This coupon is expired, inactive, or the order does not meet the minimum amount.'],
                ]);
            }

            $discountAmount = round($coupon->calculateDiscount($subtotal), 2);
        }

        $total = round(max(0, $subtotal + $shipping - $discountAmount), 2);
        $taxAmount = round($total - ($total / (1 + (self::VAT_RATE / 100))), 2);

        return [
            'items' => $lineItems->values()->all(),
            'subtotal' => $subtotal,
            'shipping' => $shipping,
            'shipping_option' => $selectedShippingOption,
            'discount_amount' => $discountAmount,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'coupon' => $coupon,
        ];
    }

    /** Check stock across all basket lines, including repeated product/variant selections. */
    private function checkCombinedStock(Product $product, ?array $selections, int $quantity, int $index, array &$requestedStock): void
    {
        $variants = ProductVariantResolver::variants($product);
        $buckets = [];
        if ($variants === []) {
            if ($product->track_stock && $product->stock_quantity !== null) {
                $buckets['product'] = (int) $product->stock_quantity;
            }
        } else {
            $combination = ProductVariantResolver::usesCombinationMode($product);
            $matched = $combination ? ProductVariantResolver::resolveSelectedVariant($product, $selections) : null;
            foreach ($variants as $variantIndex => $variant) {
                $selected = $combination
                    ? $variant === $matched
                    : (isset($selections[$variant['option'] ?? ''])
                        && (string) ($selections[$variant['option']]['value'] ?? '') === (string) ($variant['value'] ?? ''));
                if ($selected && is_numeric($variant['stock'] ?? null)) {
                    $buckets['variant-'.$variantIndex] = (int) $variant['stock'];
                }
            }
        }

        foreach ($buckets as $bucket => $available) {
            $key = $product->id.':'.$bucket;
            $requestedStock[$key] = ($requestedStock[$key] ?? 0) + $quantity;
            if ($requestedStock[$key] > $available) {
                throw ValidationException::withMessages([
                    "items.$index.quantity" => ["Only {$available} unit(s) of {$product->name} are available across your basket."],
                ]);
            }
        }
    }

    private function resolveVariants(Product $product, mixed $selectedVariants, int $quantity, int $index): ?array
    {
        $available = collect($product->variants ?? []);
        if ($available->isEmpty()) {
            return null;
        }

        if (! is_array($selectedVariants)) {
            $selectedVariants = [];
        }

        if (ProductVariantResolver::usesCombinationMode($product)) {
            $requiredOptions = collect(ProductVariantResolver::optionNames($product));
            $normalizedSelections = ProductVariantResolver::normalizeSelections($selectedVariants);

            if ($requiredOptions->isEmpty()) {
                $matchedVariant = ProductVariantResolver::findMatchingCombinationVariant($product, $selectedVariants);
                if (! $matchedVariant) {
                    throw ValidationException::withMessages([
                        "items.$index.selected_variants" => ['This product is no longer available.'],
                    ]);
                }

                $variantStock = $matchedVariant['stock'] ?? null;
                if ($variantStock !== null && (int) $variantStock < $quantity) {
                    throw ValidationException::withMessages([
                        "items.$index.quantity" => ["Only {$variantStock} unit(s) are available for {$product->name}."],
                    ]);
                }

                return null;
            }

            $missingOptions = $requiredOptions->filter(
                fn (string $option) => ! array_key_exists($option, $normalizedSelections) || $normalizedSelections[$option] === ''
            )->values();

            if ($missingOptions->isNotEmpty()) {
                $label = $missingOptions->count() === 1
                    ? $missingOptions->first()
                    : $missingOptions->implode(', ');

                throw ValidationException::withMessages([
                    "items.$index.selected_variants" => ["Please select {$label} for {$product->name}."],
                ]);
            }

            $matchedVariant = ProductVariantResolver::findMatchingCombinationVariant($product, $selectedVariants);
            if (! $matchedVariant) {
                throw ValidationException::withMessages([
                    "items.$index.selected_variants" => ['Invalid variant selection.'],
                ]);
            }

            $variantStock = $matchedVariant['stock'] ?? null;
            if ($variantStock !== null && (int) $variantStock < $quantity) {
                $selectionLabel = collect($normalizedSelections)
                    ->map(fn ($value, $option) => "{$option}: {$value}")
                    ->implode(', ');

                throw ValidationException::withMessages([
                    "items.$index.quantity" => ["Only {$variantStock} unit(s) are available for {$product->name} ({$selectionLabel})."],
                ]);
            }

            return $requiredOptions
                ->mapWithKeys(fn (string $option) => [
                    $option => [
                        'option' => $option,
                        'value' => $normalizedSelections[$option] ?? '',
                    ],
                ])
                ->all();
        }

        $requiredOptions = $available
            ->pluck('option')
            ->map(fn ($option) => trim((string) $option))
            ->filter()
            ->unique()
            ->values();

        $missingOptions = $requiredOptions->filter(function (string $option) use ($selectedVariants) {
            $selection = $selectedVariants[$option] ?? null;

            return ! is_array($selection) || trim((string) ($selection['value'] ?? '')) === '';
        })->values();

        if ($missingOptions->isNotEmpty()) {
            $label = $missingOptions->count() === 1
                ? $missingOptions->first()
                : $missingOptions->implode(', ');

            throw ValidationException::withMessages([
                "items.$index.selected_variants" => ["Please select {$label} for {$product->name}."],
            ]);
        }

        $resolved = [];
        foreach ($selectedVariants as $option => $selection) {
            $value = is_array($selection) ? ($selection['value'] ?? null) : null;

            if ($value === null) {
                throw ValidationException::withMessages([
                    "items.$index.selected_variants" => ['Invalid variant selection.'],
                ]);
            }

            $variant = $available->first(function ($candidate) use ($option, $value) {
                return (string) ($candidate['option'] ?? '') === (string) $option
                    && (string) ($candidate['value'] ?? '') === (string) $value;
            });

            if (! $variant) {
                throw ValidationException::withMessages([
                    "items.$index.selected_variants" => ["The selected {$option} option is no longer available."],
                ]);
            }

            $variantStock = $variant['stock'] ?? null;
            if ($variantStock !== null && (int) $variantStock < $quantity) {
                throw ValidationException::withMessages([
                    "items.$index.quantity" => ["Only {$variantStock} unit(s) are available for {$product->name} ({$option}: {$value})."],
                ]);
            }

            $resolved[$option] = [
                'option' => $variant['option'] ?? $option,
                'value' => $variant['value'] ?? $value,
                'price' => $variant['price'] ?? $product->price,
                'stock' => $variant['stock'] ?? null,
                'shipping_weight_kg' => $variant['shipping_weight_kg'] ?? null,
                'shipping_length_cm' => $variant['shipping_length_cm'] ?? null,
                'shipping_width_cm' => $variant['shipping_width_cm'] ?? null,
                'shipping_height_cm' => $variant['shipping_height_cm'] ?? null,
                'shipping_class' => $variant['shipping_class'] ?? null,
                'ships_separately' => $variant['ships_separately'] ?? false,
            ];
        }

        return count($resolved) > 0 ? $resolved : null;
    }

    private function resolveUnitPrice(Product $product, ?array $variantDetails): float
    {
        $basePrice = round($this->parseMoney($product->price), 2);

        $selectedVariant = ProductVariantResolver::resolveSelectedVariant($product, $variantDetails);
        $selectedVariantPrice = $this->parseMoney($selectedVariant['price'] ?? null);
        if ($selectedVariantPrice > 0) {
            return round($selectedVariantPrice, 2);
        }

        if (! $variantDetails || count($variantDetails) === 0) {
            return $basePrice;
        }

        if (ProductVariantResolver::usesCombinationMode($product)) {
            $matchedVariant = ProductVariantResolver::findMatchingCombinationVariant($product, $variantDetails);
            $matchedPrice = $this->parseMoney($matchedVariant['price'] ?? null);

            return $matchedPrice > 0 ? round($matchedPrice, 2) : $basePrice;
        }

        $sizeVariant = collect($variantDetails)
            ->first(function ($detail) {
                $option = strtolower(trim((string) ($detail['option'] ?? '')));

                return in_array($option, ['size', 'olcu', 'ebat'], true);
            });

        $sizePrice = $this->parseMoney($sizeVariant['price'] ?? null);
        if ($sizePrice > 0) {
            return round($sizePrice, 2);
        }

        $variantPrice = collect($variantDetails)
            ->map(fn ($detail) => $this->parseMoney($detail['price'] ?? null))
            ->first(fn ($price) => $price > 0);

        if ($variantPrice) {
            return round((float) $variantPrice, 2);
        }

        return $basePrice;
    }

    private function parseMoney(mixed $value): float
    {
        if (is_numeric($value)) {
            return round((float) $value, 2);
        }

        return round((float) preg_replace('/[^0-9.\-]/', '', (string) $value), 2);
    }

    private function formatMoney(float $value): string
    {
        return '£'.number_format($value, 2, '.', '');
    }
}
