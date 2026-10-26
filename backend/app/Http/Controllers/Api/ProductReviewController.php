<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AdminNotification;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\SiteSetting;
use App\Services\ProductReviewEligibility;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ProductReviewController extends Controller
{
    public function __construct(private ProductReviewEligibility $eligibility) {}

    public function canReview(Request $request, $productId)
    {
        $product = Product::where('id', $productId)->orWhere('slug', $productId)->firstOrFail();
        $productId = $product->id;

        $customerId = $request->user()->id;

        $reason = $this->eligibility->reason($customerId, $productId);
        if ($reason !== null) {
            return response()->json(['can_review' => false, 'reason' => $reason]);
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

        $reason = $this->eligibility->reason($customerId, $productId);
        if ($reason !== null) {
            return response()->json([
                'message' => $this->eligibility->message($reason),
                'reason' => $reason,
            ], $reason === 'already_reviewed' ? 400 : 403);
        }

        $review = ProductReview::create([
            'product_id' => $productId,
            'customer_id' => $customerId,
            'rating' => $request->rating,
            'comment' => $request->comment,
        ]);

        $review->load('customer:id,name');

        $adminEmail = (string) (config('services.business_notification_email')
            ?: SiteSetting::where('key', 'contact_email')->value('value')
            ?: config('mail.from.address')
            ?: 'softwaredevelopment2181@gmail.com');

        Mail::to($adminEmail)->send(new AdminNotification(
            'New Product Review',
            "A new review has been posted for product #{$productId} by {$review->customer->name}.\n\nRating: {$review->rating}/5 stars\nComment:\n".($review->comment ?? 'No comment')
        ));

        return response()->json($review, 201);
    }
}
