<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Services\StripeGateway;
use App\Shipping\ShippingQuoteStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Fakes\StripeGatewayFake;
use Tests\TestCase;

class CouponCheckoutAmountTest extends TestCase
{
    use RefreshDatabase;

    private StripeGatewayFake $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->gateway = new StripeGatewayFake;
        $this->app->instance(StripeGateway::class, $this->gateway);
    }

    private function payload(): array
    {
        $product = Product::factory()->create(['price' => '£12.50']);
        $quote = app(ShippingQuoteStore::class)->issue([
            'rate' => 6.50, 'service' => 'Test delivery',
            'carrier' => 'test', 'provider' => 'test',
        ]);

        return [
            'customer_name' => 'Coupon Test', 'customer_email' => 'coupon@example.com',
            'shipping_address' => 'Test delivery address', 'billing_address' => 'Test billing address',
            'payment_method' => 'card', 'fulfilment_method' => 'delivery',
            'shipping_option_token' => $quote['quote_token'],
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'coupon_code' => 'CURRENT10',
        ];
    }

    public function test_payment_and_order_recalculate_discount_after_quantity_drops(): void
    {
        $coupon = Coupon::create([
            'code' => 'CURRENT10', 'type' => 'percentage', 'value' => 10,
            'min_order_amount' => 10, 'active' => true,
        ]);
        // The browser previously applied this coupon to five items (£62.50).
        $this->postJson('/api/v1/coupons/apply', ['code' => $coupon->code, 'order_amount' => 62.50])
            ->assertOk()->assertJsonPath('discount', 6.25);

        $payload = $this->payload();
        $setup = $this->postJson('/api/v1/payment/intent', $payload + [
            'payment_attempt_id' => (string) Str::uuid(),
            'discount_amount' => 6.25, 'total' => 12.75,
        ])->assertOk()->assertJsonPath('amount', 17.75)->json();
        $this->assertSame(1775, $this->gateway->requests[0]['amount']);

        $id = $setup['payment_intent_id'];
        $this->gateway->intents[$id]['status'] = 'succeeded';
        $this->gateway->intents[$id]['amount_received'] = 1775;
        $this->postJson('/api/v1/orders', $payload + [
            'stripe_payment_intent_id' => $id, 'payment_token' => $setup['payment_token'],
            'discount_amount' => 6.25, 'total' => 12.75,
        ])->assertCreated();

        $order = Order::firstOrFail();
        $this->assertSame(12.50, (float) $order->subtotal);
        $this->assertSame(1.25, (float) $order->discount_amount);
        $this->assertSame(6.50, (float) $order->shipping);
        $this->assertSame(17.75, (float) $order->total);
        $this->assertSame('paid', $order->payment_status);
        $this->assertSame(1, (int) $coupon->fresh()->used_count);
    }

    public function test_reduced_basket_below_coupon_minimum_cannot_create_payment(): void
    {
        Coupon::create([
            'code' => 'CURRENT10', 'type' => 'percentage', 'value' => 10,
            'min_order_amount' => 50, 'active' => true,
        ]);
        $this->postJson('/api/v1/coupons/apply', ['code' => 'CURRENT10', 'order_amount' => 62.50])
            ->assertOk();

        $this->postJson('/api/v1/payment/intent', $this->payload() + [
            'payment_attempt_id' => (string) Str::uuid(),
        ])->assertUnprocessable()->assertJsonValidationErrors('coupon_code');
        $this->assertCount(0, $this->gateway->requests);
        $this->assertDatabaseCount('orders', 0);
    }
}
