<?php

namespace Tests\Feature;

use App\Mail\CustomerOrderConfirmation;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Services\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Fakes\StripeGatewayFake;
use Tests\TestCase;

class StripeCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private StripeGatewayFake $gateway;

    private array $payload;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->gateway = new StripeGatewayFake;
        $this->app->instance(StripeGateway::class, $this->gateway);
        config(['services.stripe.webhook_secret' => 'whsec_test_only']);
        $product = Product::factory()->tracked(1)->create(['price' => '£100.00']);
        $this->payload = [
            'customer_name' => 'Checkout Test', 'customer_email' => 'checkout@example.com',
            'shipping_address' => 'Collection', 'billing_address' => 'Test address',
            'payment_method' => 'bank_transfer', 'fulfilment_method' => 'click_collect',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ];
    }

    private function prepare(): array
    {
        $setup = $this->postJson('/api/v1/payment/intent', $this->payload + ['payment_attempt_id' => (string) Str::uuid()])
            ->assertOk()->json();

        return $this->payload + ['stripe_payment_intent_id' => $setup['payment_intent_id'], 'payment_token' => $setup['payment_token']];
    }

    private function webhook(string $id, string $type = 'payment_intent.succeeded', string $secret = 'whsec_test_only')
    {
        $object = str_starts_with($type, 'refund.') ? ['id' => 're_test', 'payment_intent' => $id] : $this->gateway->intents[$id];
        $body = json_encode(['id' => 'evt_test', 'object' => 'event', 'type' => $type, 'data' => ['object' => $object]]);
        $time = time();
        $signature = hash_hmac('sha256', $time.'.'.$body, $secret);

        return $this->call('POST', '/api/v1/webhooks/stripe', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_STRIPE_SIGNATURE' => "t=$time,v1=$signature",
        ], $body);
    }

    public function test_bank_transfer_uses_stripe_details_and_duplicate_order_is_idempotent(): void
    {
        $payload = $this->prepare();
        $request = $this->gateway->requests[0];
        $this->assertSame(['customer_balance'], $request['payment_method_types']);
        $this->assertSame('gb_bank_transfer', $request['payment_method_options']['customer_balance']['bank_transfer']['type']);
        $this->assertTrue($request['confirm']);
        $this->assertSame('cus_checkout_test', $request['customer']);
        $first = $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $this->postJson('/api/v1/orders', $payload)->assertCreated()->assertJsonPath('order_number', $first->json('order_number'));
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame(0, Product::first()->stock_quantity);
        $order = Order::first();
        $this->assertSame('pending', $order->payment_status);
        $this->assertSame('STRIPE-TEST-REFERENCE', $order->bank_transfer_details['reference']);
        Mail::assertSent(CustomerOrderConfirmation::class, 1);
        $email = (new CustomerOrderConfirmation($order))->render();
        $this->assertStringContainsString('STRIPE-TEST-REFERENCE', $email);
        $this->assertStringContainsString('once payment has been received in full', $email);
        $credentials = $first->json('confirmation');
        $this->getJson('/api/v1/orders/confirmation?'.http_build_query($credentials))->assertOk()
            ->assertJsonPath('bank_transfer_details.reference', 'STRIPE-TEST-REFERENCE')
            ->assertJsonPath('payment_status', 'pending');
    }

    public function test_partial_transfer_remains_pending_then_full_payment_is_reconciled_once(): void
    {
        $payload = $this->prepare();
        $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $id = $payload['stripe_payment_intent_id'];
        $this->gateway->intents[$id]['next_action']['display_bank_transfer_instructions']['amount_remaining'] = 4000;
        $this->webhook($id, 'payment_intent.partially_funded')->assertOk();
        $this->assertSame('pending', Order::first()->payment_status);
        $this->assertSame(4000, Order::first()->bank_transfer_details['amount_remaining']);
        $this->gateway->intents[$id]['status'] = 'succeeded';
        $this->gateway->intents[$id]['amount_received'] = 10000;
        $this->gateway->intents[$id]['next_action'] = null;
        $this->webhook($id)->assertOk();
        $this->webhook($id)->assertOk();
        $this->webhook($id, 'payment_intent.partially_funded')->assertOk();
        $this->assertSame('paid', Order::first()->payment_status);
        $this->assertSame(0, Order::first()->bank_transfer_details['amount_remaining']);
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame(0, Product::first()->stock_quantity);
    }

    public function test_only_a_successful_card_payment_places_a_paid_order(): void
    {
        $this->payload['payment_method'] = 'card';
        $payload = $this->prepare();
        $this->assertSame(['card'], $this->gateway->requests[0]['payment_method_types']);
        $this->postJson('/api/v1/payment/status', $payload)->assertOk()->assertJsonPath('status', 'requires_payment_method');
        $this->postJson('/api/v1/orders', $payload)->assertStatus(422);
        $id = $payload['stripe_payment_intent_id'];
        $this->gateway->intents[$id]['status'] = 'succeeded';
        $this->gateway->intents[$id]['amount_received'] = 10000;
        $this->postJson('/api/v1/payment/status', $payload)->assertOk()->assertJsonPath('status', 'succeeded');
        $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $this->assertSame('paid', Order::first()->payment_status);
        $this->assertNull(Order::first()->bank_transfer_details);
    }

    public function test_tampered_checkout_and_missing_payment_are_rejected(): void
    {
        $this->postJson('/api/v1/orders', $this->payload)->assertStatus(422)->assertJsonValidationErrors(['payment_token', 'stripe_payment_intent_id']);
        $payload = $this->prepare();
        $payload['customer_email'] = 'different@example.com';
        $this->postJson('/api/v1/payment/status', $payload)->assertStatus(403);
        $this->postJson('/api/v1/orders', $payload)->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_wrong_currency_amount_method_and_metadata_are_rejected(): void
    {
        $payload = $this->prepare();
        $id = $payload['stripe_payment_intent_id'];
        $original = $this->gateway->intents[$id];
        foreach ([['currency' => 'eur'], ['amount' => 1], ['payment_method_types' => ['card']], ['metadata' => []]] as $change) {
            $this->gateway->intents[$id] = array_replace($original, $change);
            $this->postJson('/api/v1/orders', $payload)->assertStatus(422);
        }
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_invalid_signature_and_unconfigured_webhook_fail_closed(): void
    {
        $payload = $this->prepare();
        $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $id = $payload['stripe_payment_intent_id'];
        $this->webhook($id, 'payment_intent.succeeded', 'wrong_secret')->assertStatus(400);
        config(['services.stripe.webhook_secret' => null]);
        $this->webhook($id)->assertStatus(503);
        $this->assertSame('pending', Order::first()->payment_status);
    }

    public function test_webhook_before_order_requests_retry_and_mismatched_amount_cannot_mark_paid(): void
    {
        $payload = $this->prepare();
        $id = $payload['stripe_payment_intent_id'];
        $this->webhook($id)->assertStatus(503);
        $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $this->gateway->intents[$id]['status'] = 'succeeded';
        $this->gateway->intents[$id]['amount_received'] = 50;
        $this->webhook($id)->assertStatus(503);
        $this->assertSame('pending', Order::first()->payment_status);
    }

    public function test_same_attempt_reuses_intent_and_existing_customer(): void
    {
        $customer = Customer::factory()->create(['stripe_customer_id' => 'cus_existing']);
        $this->actingAs($customer, 'sanctum');
        $data = $this->payload + ['payment_attempt_id' => (string) Str::uuid()];
        $first = $this->postJson('/api/v1/payment/intent', $data)->assertOk();
        $this->postJson('/api/v1/payment/intent', $data)->assertOk()->assertJsonPath('payment_intent_id', $first->json('payment_intent_id'));
        $this->assertSame('cus_existing', $this->gateway->requests[0]['customer']);
        $this->assertCount(0, $this->gateway->customers);
        $this->assertCount(1, $this->gateway->intents);
    }

    public function test_unconfigured_bank_transfer_is_unavailable_before_creating_an_intent(): void
    {
        config(['services.stripe.webhook_secret' => null]);
        $this->postJson('/api/v1/payment/intent', $this->payload + ['payment_attempt_id' => (string) Str::uuid()])->assertStatus(503);
        $this->assertCount(0, $this->gateway->requests);
    }

    public function test_refunds_wait_for_stripe_and_payment_events_do_not_override_them(): void
    {
        $payload = $this->prepare();
        $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $id = $payload['stripe_payment_intent_id'];
        $this->gateway->intents[$id]['status'] = 'succeeded';
        $this->gateway->intents[$id]['amount_received'] = 10000;
        $this->webhook($id)->assertOk();
        $this->gateway->refunds = [['status' => 'requires_action', 'amount' => 10000]];
        $this->webhook($id, 'refund.created')->assertOk();
        $this->assertSame('refund_pending', Order::first()->payment_status);
        $this->assertSame('0.00', Order::first()->refunded_amount);
        $this->webhook($id)->assertOk();
        $this->assertSame('refund_pending', Order::first()->payment_status);
        $this->gateway->refunds = [['status' => 'succeeded', 'amount' => 6000], ['status' => 'pending', 'amount' => 4000]];
        $this->webhook($id, 'refund.updated')->assertOk();
        $this->webhook($id, 'refund.updated')->assertOk();
        $this->assertSame('60.00', Order::first()->refunded_amount);
        $this->assertSame('refund_pending', Order::first()->payment_status);
        $this->gateway->refunds[1]['status'] = 'failed';
        $this->webhook($id, 'refund.failed')->assertOk();
        $this->assertSame('60.00', Order::first()->refunded_amount);
        $this->assertSame('partially_refunded', Order::first()->payment_status);
        $this->gateway->refunds[1]['status'] = 'succeeded';
        $this->webhook($id, 'refund.updated')->assertOk();
        $this->webhook($id, 'refund.updated')->assertOk();
        $this->assertSame('refunded', Order::first()->payment_status);
        $this->assertSame('100.00', Order::first()->refunded_amount);
    }
}
