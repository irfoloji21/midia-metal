<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ProductReview;

class ProductReviewEligibility
{
    /** The same order must belong to this customer, contain this product, be paid and fulfilled. */
    public function reason(int $customerId, int $productId): ?string
    {
        if (ProductReview::where('product_id', $productId)->where('customer_id', $customerId)->exists()) {
            return 'already_reviewed';
        }

        $orders = Order::where('customer_id', $customerId)
            ->whereHas('items', fn ($query) => $query->where('product_id', $productId));
        if (! (clone $orders)->exists()) {
            return 'not_purchased';
        }
        $orders->where('status', '!=', 'cancelled');
        if (! (clone $orders)->exists()) {
            return 'order_cancelled';
        }
        $orders->where('payment_status', 'paid');
        if (! (clone $orders)->exists()) {
            return 'not_paid';
        }
        if (! $orders->whereIn('status', ['delivered', 'collected'])->exists()) {
            return 'not_delivered';
        }

        return null;
    }

    public function message(string $reason): string
    {
        return match ($reason) {
            'already_reviewed' => 'You have already reviewed this product.',
            'not_purchased' => 'You can only review products you have purchased.',
            'order_cancelled' => 'Reviews are not available for cancelled orders.',
            'not_paid' => 'A paid order is required to review this product. Orders awaiting payment or with a refund status are not eligible.',
            default => 'You can review this product once your paid order has been delivered or collected.',
        };
    }
}
