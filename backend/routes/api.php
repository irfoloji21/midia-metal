<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Api;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Health check (no auth, no throttle)
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        $dbOk = true;
    } catch (Throwable) {
        $dbOk = false;
    }

    $status = $dbOk ? 'ok' : 'degraded';

    return response()->json([
        'status' => $status,
        'database' => $dbOk,
        'timestamp' => now()->toIso8601String(),
    ], $dbOk ? 200 : 503);
});

// Public API Routes (Frontend)
Route::prefix('v1')->group(function () {
    // Products
    Route::get('/products', [Api\ProductController::class, 'index']);
    Route::get('/products/featured', [Api\ProductController::class, 'featured']);
    Route::get('/products/tags', [Api\ProductController::class, 'tags']);
    Route::get('/products/{id}', [Api\ProductController::class, 'show']);
    Route::get('/products/{id}/related', [Api\ProductController::class, 'related']);
    Route::get('/product-categories', [Api\ProductController::class, 'categories']);
    Route::get('/product-categories/{slug}', [Api\ProductController::class, 'categoryDetail']);
    Route::get('/hero-slides', [Api\ProductController::class, 'heroSlides']);

    // Blog
    Route::get('/blog', [Api\BlogController::class, 'index']);
    Route::get('/blog/recent', [Api\BlogController::class, 'recent']);
    Route::get('/blog/categories', [Api\BlogController::class, 'categories']);
    Route::get('/blog/{slug}', [Api\BlogController::class, 'show']);

    // Portfolio
    Route::get('/portfolio', [Api\PortfolioController::class, 'index']);
    Route::get('/portfolio/categories', [Api\PortfolioController::class, 'categories']);
    Route::get('/portfolio/{slug}', [Api\PortfolioController::class, 'show']);

    // Services
    Route::get('/services', [Api\ServiceController::class, 'index']);
    Route::get('/services/{slug}', [Api\ServiceController::class, 'show']);

    // Settings
    Route::get('/settings', [Api\SettingsController::class, 'index']);

    // Forms
    Route::post('/contact', [Api\FormController::class, 'contact'])->middleware('throttle:8,1');
    Route::post('/orders', [Api\FormController::class, 'order'])->middleware(['customer.cookie', 'throttle:10,1']);
    Route::get('/orders/confirmation', [Api\OrderConfirmationController::class, 'show'])->middleware('throttle:10,1');
    Route::post('/quote', [Api\FormController::class, 'quote'])->middleware(['customer.cookie', 'throttle:6,1']);
    Route::post('/coupons/apply', [Api\FormController::class, 'applyCoupon'])->middleware('throttle:20,1');
    Route::post('/payment/intent', [Api\PaymentController::class, 'createIntent'])->middleware(['customer.cookie', 'throttle:10,1']);
    Route::post('/shipping/options', [Api\ShippingController::class, 'options'])->middleware('throttle:20,1');
    Route::post('/webhooks/easypost', [Api\EasyPostWebhookController::class, 'handle'])->middleware('throttle:60,1');
    // Testimonials
    Route::get('/testimonials', [Api\TestimonialController::class, 'index']);
    // FAQs
    Route::get('/faqs', [Api\FaqController::class, 'index']);

    // Customer Auth (Public)
    Route::post('/customer/register', [Api\CustomerAuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/customer/login', [Api\CustomerAuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/customer/forgot-password', [Api\CustomerPasswordResetController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('/customer/reset-password', [Api\CustomerPasswordResetController::class, 'resetPassword'])->middleware('throttle:3,1');

    // Customer Protected Routes
    Route::middleware(['customer.cookie', 'auth:sanctum', 'customer.only', 'throttle:60,1'])->group(function () {
        Route::get('/customer/me', [Api\CustomerAuthController::class, 'me']);
        Route::post('/customer/logout', [Api\CustomerAuthController::class, 'logout']);
        Route::put('/customer/profile', [Api\CustomerAuthController::class, 'updateProfile']);
        Route::put('/customer/password', [Api\CustomerAuthController::class, 'updatePassword']);

        // Orders
        Route::get('/customer/orders', [Api\CustomerOrderController::class, 'index']);
        Route::get('/customer/orders/{id}', [Api\CustomerOrderController::class, 'show']);
        Route::get('/customer/orders/{id}/invoice', [Api\CustomerOrderController::class, 'invoice']);

        // Quotes
        Route::get('/customer/quotes', [Api\CustomerAuthController::class, 'customerQuotes']);
        Route::post('/customer/refund-requests', [Api\FormController::class, 'refundRequest']);

        // Product Reviews
        Route::get('/customer/products/{productId}/can-review', [Api\ProductReviewController::class, 'canReview']);
        Route::post('/customer/products/{productId}/reviews', [Api\ProductReviewController::class, 'store']);

        // Saved Cards
        Route::get('/customer/payment-methods', [Api\PaymentController::class, 'listSavedCards']);
        Route::delete('/customer/payment-methods/{id}', [Api\PaymentController::class, 'deleteSavedCard']);
    });
});

// Admin Auth
Route::prefix('admin')->group(function () {
    Route::post('/login', [Admin\AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [Admin\AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('/reset-password', [Admin\AuthController::class, 'resetPassword'])->middleware('throttle:3,1');

    // Protected Admin Routes
    Route::middleware(['admin.cookie', 'auth:sanctum', 'admin.only', 'throttle:120,1'])->group(function () {
        Route::get('/me', [Admin\AuthController::class, 'me']);
        Route::post('/logout', [Admin\AuthController::class, 'logout']);

        // Dashboard
        Route::get('/dashboard', [Admin\DashboardController::class, 'index']);

        // Products
        Route::post('/products/{product}/duplicate', [Admin\ProductController::class, 'duplicate']);
        Route::apiResource('/products', Admin\ProductController::class);
        Route::get('/product-category-list', [Admin\ProductController::class, 'categories']);
        Route::apiResource('/product-categories', Admin\ProductCategoryController::class);

        // Blog
        Route::apiResource('/blog', Admin\BlogController::class);

        // Portfolio
        Route::get('/portfolio-categories', [Admin\PortfolioController::class, 'categories']);
        Route::post('/portfolio-categories', [Admin\PortfolioController::class, 'storeCategory']);
        Route::put('/portfolio-categories/{portfolioCategory}', [Admin\PortfolioController::class, 'updateCategory']);
        Route::delete('/portfolio-categories/{portfolioCategory}', [Admin\PortfolioController::class, 'destroyCategory']);
        Route::apiResource('/portfolio', Admin\PortfolioController::class);

        // Services
        Route::apiResource('/services', Admin\ServiceController::class);

        // Orders
        Route::apiResource('/orders', Admin\OrderController::class)->except(['store', 'update']);
        Route::put('/orders/{order}', [Admin\OrderController::class, 'update']);
        Route::post('/orders/{order}/refund', [Admin\OrderController::class, 'refund']);
        Route::post('/orders/{order}/shipping/label', [Admin\OrderShippingController::class, 'createLabel']);
        Route::post('/orders/{order}/shipping/track', [Admin\OrderShippingController::class, 'refreshTracking']);
        Route::post('/orders/{order}/shipping/void', [Admin\OrderShippingController::class, 'voidShipment']);
        Route::get('/orders/{order}/shipping/label/download', [Admin\OrderShippingController::class, 'downloadLabel']);

        // Quotes
        Route::get('/quotes', [Admin\QuoteController::class, 'index']);
        Route::get('/quotes/{quote}', [Admin\QuoteController::class, 'show']);
        Route::put('/quotes/{quote}', [Admin\QuoteController::class, 'update']);
        Route::post('/quotes/{quote}/send-response', [Admin\QuoteController::class, 'sendResponse']);
        Route::delete('/quotes/{quote}', [Admin\QuoteController::class, 'destroy']);

        // Coupons
        Route::apiResource('/coupons', Admin\CouponController::class);

        // Contact Messages
        Route::get('/messages', [Admin\ContactController::class, 'index']);
        Route::get('/messages/{contactMessage}', [Admin\ContactController::class, 'show']);
        Route::put('/messages/{contactMessage}/read', [Admin\ContactController::class, 'markRead']);
        Route::put('/messages/{contactMessage}/request-status', [Admin\ContactController::class, 'updateRequestStatus']);
        Route::delete('/messages/{contactMessage}', [Admin\ContactController::class, 'destroy']);

        // Upload
        Route::post('/upload', [Admin\UploadController::class, 'upload']);

        // Settings
        Route::get('/settings', [Admin\SettingsController::class, 'index']);
        Route::put('/settings', [Admin\SettingsController::class, 'update']);
        Route::get('/hero-slides', [Admin\SettingsController::class, 'heroSlides']);
        Route::post('/hero-slides', [Admin\SettingsController::class, 'storeHeroSlide']);
        Route::put('/hero-slides/{heroSlide}', [Admin\SettingsController::class, 'updateHeroSlide']);
        Route::delete('/hero-slides/{heroSlide}', [Admin\SettingsController::class, 'destroyHeroSlide']);

        // FAQs
        Route::apiResource('/faqs', Admin\FaqController::class);

        // Product Reviews
        Route::apiResource('/product-reviews', Admin\ProductReviewController::class)->only(['index']);

        // Customers
        Route::get('/customers', [Admin\CustomerController::class, 'index']);
        Route::get('/customers/{customer}', [Admin\CustomerController::class, 'show']);
        Route::delete('/customers/{customer}', [Admin\CustomerController::class, 'destroy']);

        // Analytics
        Route::get('/stats/sales-overview', [Admin\StatController::class, 'salesOverview']);
        Route::get('/stats/top-products', [Admin\StatController::class, 'topProducts']);
    });
});
