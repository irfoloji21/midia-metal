<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\SiteSetting;
use App\Shipping\ShippingQuoteStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OrderPlacementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.stripe.webhook_secret' => 'whsec_test_only']);
        $this->app->instance(\App\Services\StripeGateway::class, new \Tests\Fakes\StripeGatewayFake);
    }

    private function postStripeOrder(array $payload)
    {
        $setup = $this->postJson('/api/v1/payment/intent', $payload + ['payment_attempt_id' => (string) \Illuminate\Support\Str::uuid()])->assertOk()->json();
        return $this->postJson('/api/v1/orders', $payload + [
            'stripe_payment_intent_id' => $setup['payment_intent_id'], 'payment_token' => $setup['payment_token'],
        ]);
    }

    private function issueShippingQuote(array $option = []): string
    {
        $store = app(ShippingQuoteStore::class);
        $quote = $store->issue(array_merge([
            'rate' => 6.50,
            'service' => 'Royal Mail Tracked 48',
            'carrier' => 'royal_mail',
            'provider' => 'easypost',
        ], $option));

        return $quote['quote_token'];
    }

    private function seedNotificationEmail(): void
    {
        SiteSetting::create([
            'key' => 'contact_email',
            'value' => 'test@example.com',
            'group' => 'contact',
        ]);
    }

    // ─── Successful order placement ───────────────────────────────────

    public function test_places_bank_transfer_order(): void
    {
        $this->seedNotificationEmail();
        $product = Product::factory()->create(['price' => '£100.00']);
        $token = $this->issueShippingQuote();

        $response = $this->postStripeOrder([
            'customer_name' => 'John Doe',
            'customer_email' => 'john@example.com',
            'customer_phone' => '07700900000',
            'shipping_address' => '123 High St, London, SW1A 1AA',
            'shipping_address_line1' => '123 High St',
            'shipping_city' => 'London',
            'shipping_postcode' => 'SW1A 1AA',
            'shipping_country' => 'United Kingdom',
            'billing_address' => '123 High St, London, SW1A 1AA',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'delivery',
            'shipping_option_token' => $token,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ]);

        $response->assertCreated();
        $response->assertJsonStructure(['message', 'order_number']);

        $orderNumber = $response->json('order_number');
        $this->assertStringStartsWith('ORD-', $orderNumber);

        // Verify order was persisted
        $order = Order::where('order_number', $orderNumber)->firstOrFail();
        $this->assertSame('pending', $order->status);
        $this->assertSame('pending', $order->payment_status);
        $this->assertSame('bank_transfer', $order->payment_method);
        $this->assertEquals(200.00, (float) $order->subtotal);
        $this->assertEquals(6.50, (float) $order->shipping);
        $this->assertEquals(206.50, (float) $order->total);

        // Verify order items
        $this->assertCount(1, $order->items);
        $this->assertSame($product->id, $order->items->first()->product_id);
        $this->assertSame(2, $order->items->first()->quantity);
        $this->assertSame('£100.00', $order->items->first()->product_price);
    }

    public function test_places_click_and_collect_order(): void
    {
        $this->seedNotificationEmail();
        $product = Product::factory()->create(['price' => '£75.00']);

        $response = $this->postStripeOrder([
            'customer_name' => 'Jane Doe',
            'customer_email' => 'jane@example.com',
            'shipping_address' => 'Collection from store',
            'billing_address' => '456 Oak Ave, Manchester',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'click_collect',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $response->assertCreated();

        $order = Order::where('order_number', $response->json('order_number'))->firstOrFail();
        $this->assertEquals(75.00, (float) $order->subtotal);
        $this->assertEquals(0, (float) $order->shipping);
        $this->assertEquals(75.00, (float) $order->total);
    }

    // ─── Stock decrement ──────────────────────────────────────────────

    public function test_decrements_stock_on_tracked_product(): void
    {
        $this->seedNotificationEmail();
        $product = Product::factory()->tracked(10)->create(['price' => '£25.00']);
        $token = $this->issueShippingQuote();

        $response = $this->postStripeOrder([
            'customer_name' => 'Stock Buyer',
            'customer_email' => 'stock@example.com',
            'shipping_address' => '789 Elm Lane',
            'billing_address' => '789 Elm Lane',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'delivery',
            'shipping_option_token' => $token,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 3],
            ],
        ]);

        $response->assertCreated();
        $this->assertSame(7, $product->fresh()->stock_quantity);
    }

    public function test_does_not_decrement_untracked_stock(): void
    {
        $this->seedNotificationEmail();
        $product = Product::factory()->create([
            'price' => '£25.00',
            'track_stock' => false,
            'stock_quantity' => null,
        ]);
        $token = $this->issueShippingQuote();

        $response = $this->postStripeOrder([
            'customer_name' => 'No Track Buyer',
            'customer_email' => 'notrack@example.com',
            'shipping_address' => '101 Pine St',
            'billing_address' => '101 Pine St',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'delivery',
            'shipping_option_token' => $token,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 5],
            ],
        ]);

        $response->assertCreated();
        $this->assertNull($product->fresh()->stock_quantity);
    }

    // ─── Validation ───────────────────────────────────────────────────

    public function test_rejects_order_without_items(): void
    {
        $response = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Bad Buyer',
            'customer_email' => 'bad@example.com',
            'shipping_address' => '123 No Items',
            'billing_address' => '123 No Items',
            'items' => [],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
    }

    public function test_rejects_order_without_customer_details(): void
    {
        $product = Product::factory()->create(['price' => '£50.00']);

        $response = $this->postJson('/api/v1/orders', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['customer_name', 'customer_email', 'shipping_address', 'billing_address']);
    }

    public function test_rejects_order_with_invalid_fulfilment_method(): void
    {
        $product = Product::factory()->create(['price' => '£50.00']);

        $response = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Test Buyer',
            'customer_email' => 'test@example.com',
            'shipping_address' => '123 Test St',
            'billing_address' => '123 Test St',
            'fulfilment_method' => 'teleport',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['fulfilment_method']);
    }

    public function test_rejects_removed_cash_payment_method(): void
    {
        $product = Product::factory()->create(['price' => '£50.00']);

        $response = $this->postJson('/api/v1/orders', [
            'customer_name' => 'Test Buyer',
            'customer_email' => 'test@example.com',
            'shipping_address' => '123 Test St',
            'billing_address' => '123 Test St',
            'payment_method' => 'cod',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['payment_method']);
    }

    // ─── Multi-item order ─────────────────────────────────────────────

    public function test_places_multi_item_order_with_correct_totals(): void
    {
        $this->seedNotificationEmail();
        $productA = Product::factory()->create(['price' => '£50.00']);
        $productB = Product::factory()->create(['price' => '£30.00']);
        $token = $this->issueShippingQuote(['rate' => 9.99]);

        $response = $this->postStripeOrder([
            'customer_name' => 'Multi Buyer',
            'customer_email' => 'multi@example.com',
            'shipping_address' => '123 Multi Lane',
            'billing_address' => '123 Multi Lane',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'delivery',
            'shipping_option_token' => $token,
            'items' => [
                ['product_id' => $productA->id, 'quantity' => 2],
                ['product_id' => $productB->id, 'quantity' => 3],
            ],
        ]);

        $response->assertCreated();

        $order = Order::where('order_number', $response->json('order_number'))->firstOrFail();
        // (50×2) + (30×3) = 190 subtotal, + 9.99 shipping = 199.99
        $this->assertEquals(190.00, (float) $order->subtotal);
        $this->assertEquals(9.99, (float) $order->shipping);
        $this->assertEquals(199.99, (float) $order->total);
        $this->assertCount(2, $order->items);
    }

    // ─── Variant order ────────────────────────────────────────────────

    public function test_places_order_with_variant_selection(): void
    {
        $this->seedNotificationEmail();
        $product = Product::factory()->withVariants([
            ['option' => 'Size', 'value' => 'Large', 'price' => '£75.00', 'stock' => null],
        ])->create(['price' => '£50.00']);
        $token = $this->issueShippingQuote();

        $response = $this->postStripeOrder([
            'customer_name' => 'Variant Buyer',
            'customer_email' => 'variant@example.com',
            'shipping_address' => '123 Variant St',
            'billing_address' => '123 Variant St',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'delivery',
            'shipping_option_token' => $token,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'selected_variants' => [
                        'Size' => ['option' => 'Size', 'value' => 'Large'],
                    ],
                ],
            ],
        ]);

        $response->assertCreated();

        $order = Order::where('order_number', $response->json('order_number'))->firstOrFail();
        // Variant price £75 should be used, not base £50
        $this->assertEquals(75.00, (float) $order->subtotal);
        $this->assertSame('£75.00', $order->items->first()->product_price);
        $this->assertNotNull($order->items->first()->variant_details);
    }
}
