<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'code',
        'type',
        'value',
        'min_order_amount',
        'max_uses',
        'used_count',
        'expires_at',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'expires_at' => 'datetime',
        'value' => 'float',
        'min_order_amount' => 'float',
    ];

    public function isValid(float $orderAmount): bool
    {
        if (! $this->active) {
            return false;
        }
        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }
        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) {
            return false;
        }
        if ($orderAmount < $this->min_order_amount) {
            return false;
        }

        return true;
    }

    public function calculateDiscount(float $orderAmount): float
    {
        $orderAmount = max(0, $orderAmount);
        $discount = $this->type === 'percentage'
            ? round($orderAmount * ($this->value / 100), 2)
            : $this->value;

        return max(0, min($discount, $orderAmount));
    }
}
