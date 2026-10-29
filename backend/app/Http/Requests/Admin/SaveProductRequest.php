<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Shared validation for both store and update product operations.
 *
 * Both actions accept the same payload shape; the rules are identical because
 * the admin UI always sends the full product object on save.
 */
class SaveProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Auth handled by admin.only middleware
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('product_code')) {
            $productCode = trim((string) $this->input('product_code', ''));
            $this->merge(['product_code' => $productCode !== '' ? $productCode : null]);
        }
    }

    public function withValidator(Validator $validator): void
    {
        // ProductController normalizes column sections. Keep their existing JSON,
        // including empty arrays, while validating the optional unit metadata.
        $validator->excludeUnvalidatedArrayKeys = false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'product_code' => 'nullable|string|max:100',
            'show_variant_in_title' => 'boolean',
            'variant_mode' => 'nullable|string|in:legacy,combination',
            'variant_options' => 'nullable|array',
            'frontend_variant_layout' => 'nullable|string|in:default,selection_table',
            'selection_table_config' => 'nullable|array',
            'price_on_request' => 'boolean',
            'price' => [$this->boolean('price_on_request') ? 'nullable' : 'required', 'string', 'regex:/^\s*£?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?\s*$/'],
            'image' => 'nullable|string',
            'gallery' => 'nullable|array',
            'description' => 'nullable|string',
            'pdf_download_enabled' => 'boolean',
            'product_category_id' => 'nullable|integer|exists:product_categories,id',
            'tags' => 'nullable|array',
            'badge' => 'nullable|string',
            'old_price' => ['nullable', 'string', 'regex:/^\s*£?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?\s*$/'],
            'featured' => 'boolean',
            'active' => 'boolean',
            'order' => 'integer',
            'track_stock' => 'boolean',
            'stock_quantity' => 'nullable|integer',
            'shipping_weight_kg' => 'nullable|numeric|min:0.01|max:999.999',
            'shipping_length_cm' => 'nullable|numeric|min:1|max:999.99',
            'shipping_width_cm' => 'nullable|numeric|min:1|max:999.99',
            'shipping_height_cm' => 'nullable|numeric|min:1|max:999.99',
            'shipping_class' => 'nullable|string|in:standard,freight',
            'ships_separately' => 'nullable|boolean',
            'freight_delivery_price' => 'nullable|numeric|min:0|max:9999.99',
            'specifications' => 'nullable|array',
            'variants' => $this->boolean('price_on_request') ? 'nullable|array' : 'required|array|min:1',
            'variant_table_columns' => 'nullable|array',
            'variant_table_columns.dimension_unit' => 'sometimes|required|string|in:mm,cm,m',
        ];
    }
}
