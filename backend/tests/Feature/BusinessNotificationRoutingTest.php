<?php

namespace Tests\Feature;

use App\Mail\AdminNotification;
use App\Mail\CustomerOrderConfirmation;
use App\Mail\CustomerOrderRequestUpdate;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\SiteSetting;
use App\Services\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Fakes\StripeGatewayFake;
use Tests\TestCase;

class BusinessNotificationRoutingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config([
            'services.business_notification_email' => 'operations@example.com',
            'mail.from.address' => 'sender@example.com',
        ]);
        SiteSetting::create(['key' => 'contact_email', 'value' => 'public@example.com', 'group' => 'contact']);
    }

    private function assertBusinessNotification(): void
    {
        Mail::assertSent(AdminNotification::class, 1);
        Mail::assertSent(AdminNotification::class, fn ($mail) => $mail->hasTo('operations@example.com')
            && ! $mail->hasTo('public@example.com') && ! $mail->hasTo('sender@example.com'));
        $this->assertDatabaseHas('site_settings', ['key' => 'contact_email', 'value' => 'public@example.com']);
    }

    public function test_contact_notification_uses_the_business_inbox(): void
    {
        $this->postJson('/api/v1/contact', [
            'name' => 'Test Customer', 'email' => 'customer@example.com', 'message' => 'A contact enquiry',
        ])->assertCreated();

        $this->assertBusinessNotification();
    }

    public function test_quote_notification_uses_the_business_inbox(): void
    {
        $this->postJson('/api/v1/quote', [
            'name' => 'Test Customer', 'email' => 'customer@example.com', 'description' => 'A quote enquiry',
        ])->assertCreated();

        $this->assertBusinessNotification();
    }

    public function test_order_notifies_business_and_customer_separately(): void
    {
        config(['services.stripe.webhook_secret' => 'whsec_test_only']);
        $this->app->instance(StripeGateway::class, new StripeGatewayFake);
        $product = Product::factory()->create(['price' => '£75.00']);
        $payload = [
            'customer_name' => 'Test Customer',
            'customer_email' => 'customer@example.com',
            'shipping_address' => 'Collection from store',
            'billing_address' => '123 Test Street, London',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'click_collect',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ];
        $setup = $this->postJson('/api/v1/payment/intent', $payload + [
            'payment_attempt_id' => (string) Str::uuid(),
        ])->assertOk()->json();
        $this->postJson('/api/v1/orders', $payload + [
            'stripe_payment_intent_id' => $setup['payment_intent_id'],
            'payment_token' => $setup['payment_token'],
        ])->assertCreated();

        $this->assertBusinessNotification();
        Mail::assertSent(CustomerOrderConfirmation::class, 1);
        Mail::assertSent(CustomerOrderConfirmation::class, fn ($mail) => $mail->hasTo('customer@example.com')
            && ! $mail->hasTo('operations@example.com'));
    }

    public function test_review_notification_uses_the_business_inbox(): void
    {
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $order = Order::factory()->forCustomer($customer)->create(['status' => 'delivered', 'payment_status' => 'paid']);
        OrderItem::factory()->create(['order_id' => $order->id, 'product_id' => $product->id]);

        $this->actingAs($customer, 'sanctum')->postJson("/api/v1/customer/products/{$product->id}/reviews", [
            'rating' => 5, 'comment' => 'Test review',
        ])->assertCreated();

        $this->assertBusinessNotification();
    }

    public function test_cancellation_notifies_business_and_customer_separately(): void
    {
        $customer = Customer::factory()->create(['email' => 'customer@example.com']);
        $order = Order::factory()->forCustomer($customer)->create();

        $this->actingAs($customer, 'sanctum')->postJson('/api/v1/customer/refund-requests', [
            'order_id' => $order->id,
            'reason' => 'Order no longer required',
            'details' => 'Please cancel this test order.',
            'request_type' => 'cancel',
        ])->assertCreated();

        $this->assertBusinessNotification();
        Mail::assertSent(CustomerOrderRequestUpdate::class, 1);
        Mail::assertSent(CustomerOrderRequestUpdate::class, fn ($mail) => $mail->hasTo('customer@example.com')
            && ! $mail->hasTo('operations@example.com'));
    }
}
