<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AdminNotification;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ProductReviewController extends Controller
{
    public function canReview(Request $request, $productId)
    {
        $product = Product::where('id', $productId)->orWhere('slug', $productId)->firstOrFail();
        $productId = $product->id;

        $customerId = $request->user()->id;

        $hasPurchased = Order::where('customer_id', $customerId)
            ->whereIn('status', ['delivered', 'collected'])
            ->whereHas('items', function ($query) use ($productId) {
                $query->where('product_id', $productId);
            })->exists();

        if (! $hasPurchased) {
            return response()->json(['can_review' => false, 'reason' => 'not_delivered']);
        }

        $existing = ProductReview::where('product_id', $productId)->where('customer_id', $customerId)->first();
        if ($existing) {
            return response()->json(['can_review' => false, 'reason' => 'already_reviewed']);
        }

        return response()->json(['can_review' => true]);
    }

    public function store(Request $request, $productId)
    {
        $product = Product::where('id', $productId)->orWhere('slug', $productId)->firstOrFail();
        $productId = $product->id;

        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string',
        ]);

        $customerId = $request->user()->id;

        // A completed delivery or collection makes the order eligible for review.
        $hasPurchased = Order::where('customer_id', $customerId)
            ->whereIn('status', ['delivered', 'collected'])
            ->whereHas('items', function ($query) use ($productId) {
                $query->where('product_id', $productId);
            })->exists();

        if (! $hasPurchased) {
            return response()->json(['message' => 'You can only review products after your order has been delivered or collected.'], 403);
        }

        // Check if already reviewed
        $existing = ProductReview::where('product_id', $productId)->where('customer_id', $customerId)->first();
        if ($existing) {
            return response()->json(['message' => 'You have already reviewed this product.'], 400);
        }

        $review = ProductReview::create([
            'product_id' => $productId,
            'customer_id' => $customerId,
            'rating' => $request->rating,
            'comment' => $request->comment,
        ]);

        $review->load('customer:id,name');

        $adminEmail = (string) (SiteSetting::where('key', 'contact_email')->value('value')
            ?: config('mail.from.address')
            ?: 'softwaredevelopment2181@gmail.com');

        Mail::to($adminEmail)->send(new AdminNotification(
            'New Product Review',
            "A new review has been posted for product #{$productId} by {$review->customer->name}.\n\nRating: {$review->rating}/5 stars\nComment:\n".($review->comment ?? 'No comment')
        ));

        return response()->json($review, 201);
    }
}
