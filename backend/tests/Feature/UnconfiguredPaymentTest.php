<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Stripe\ApiRequestor;
use Stripe\HttpClient\ClientInterface;
use Tests\TestCase;

class UnconfiguredPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_missing_stripe_secret_returns_a_safe_503_without_contacting_stripe(): void
    {
        config(['services.stripe.secret' => null]);
        $http = \Mockery::mock(ClientInterface::class);
        $http->shouldNotReceive('request');
        ApiRequestor::setHttpClient($http);
        try {
            $product = Product::factory()->create(['price' => '£12.50']);
            $this->postJson('/api/v1/payment/intent', [
                'customer_name' => 'Configuration Test', 'customer_email' => 'configuration@example.com',
                'shipping_address' => 'Collection', 'billing_address' => 'Test address',
                'payment_method' => 'card', 'fulfilment_method' => 'click_collect',
                'payment_attempt_id' => (string) Str::uuid(),
                'items' => [['product_id' => $product->id, 'quantity' => 1]],
            ])->assertStatus(503)->assertExactJson([
                'message' => 'Card payment is currently unavailable. Please try again later.',
            ]);
            $this->assertDatabaseCount('orders', 0);
        } finally {
            ApiRequestor::setHttpClient(null);
        }
    }
}
