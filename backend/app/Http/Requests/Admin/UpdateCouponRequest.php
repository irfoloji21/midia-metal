<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Validation for updating a coupon.
 * Uses `sometimes` for fields that may be partially sent.
 */
class UpdateCouponRequest extends FormRequest
{
    public function after(): array
    {
        return [function (Validator $validator) {
            $coupon = $this->route('coupon');
            $type = $this->input('type', $coupon->type);
            $value = $this->input('value', $coupon->value);
            if ($type === 'percentage' && is_numeric($value) && $value > 100) {
                $validator->errors()->add('value', 'The percentage discount must not exceed 100.');
            }
        }];
    }

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $couponId = $this->route('coupon')?->id ?? $this->route('coupon');

        return [
            'code' => 'sometimes|string|unique:coupons,code,'.$couponId,
            'type' => 'sometimes|in:percentage,fixed',
            'value' => 'sometimes|numeric|min:0',
            'min_order_amount' => 'nullable|numeric|min:0',
            'max_uses' => 'nullable|integer|min:1',
            'expires_at' => 'nullable|date',
            'active' => 'boolean',
        ];
    }
}
