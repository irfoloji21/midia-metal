<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Services\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Fakes\StripeGatewayFake;
use Tests\TestCase;

class BusinessFieldsRetirementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.stripe.webhook_secret' => 'whsec_test_only']);
        $this->app->instance(StripeGateway::class, new StripeGatewayFake);
    }

    public function test_profile_updates_ignore_retired_fields_and_preserve_existing_company_data(): void
    {
        $customer = Customer::factory()->business()->create([
            'company_name' => 'Original Fabrication Ltd',
            'company_vat_number' => 'GB123456789',
        ]);

        $this->actingAs($customer, 'sanctum')->putJson('/api/v1/customer/profile', [
            'name' => 'Updated Customer',
            'is_business' => false,
            'company_name' => 'Replaced Company',
            'company_vat_number' => null,
        ])->assertOk()->assertJsonPath('name', 'Updated Customer');

        $customer->refresh();
        $this->assertTrue($customer->is_business);
        $this->assertSame('Original Fabrication Ltd', $customer->company_name);
        $this->assertSame('GB123456789', $customer->company_vat_number);
    }

    public function test_new_orders_ignore_stale_business_fields_and_keep_inclusive_vat(): void
    {
        $customer = Customer::factory()->business()->create();
        $this->actingAs($customer, 'sanctum');
        $product = Product::factory()->create(['price' => '£120.00']);
        $payload = [
            'customer_name' => $customer->name,
            'customer_email' => $customer->email,
            'shipping_address' => 'Collection from store',
            'billing_address' => '123 High Street, London, SW1A 1AA',
            'payment_method' => 'bank_transfer',
            'fulfilment_method' => 'click_collect',
            'is_business' => true,
            'company_name' => 'Stale Company Ltd',
            'company_vat_number' => 'GB987654321',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ];
        $setup = $this->postJson('/api/v1/payment/intent', $payload + [
            'payment_attempt_id' => (string) Str::uuid(),
        ])->assertOk()->json();

        $response = $this->postJson('/api/v1/orders', $payload + [
            'stripe_payment_intent_id' => $setup['payment_intent_id'],
            'payment_token' => $setup['payment_token'],
        ])->assertCreated();

        $order = Order::where('order_number', $response->json('order_number'))->firstOrFail();
        $this->assertFalse((bool) $order->is_business);
        $this->assertNull($order->company_name);
        $this->assertNull($order->company_vat_number);
        $this->assertSame(120.0, (float) $order->total);
        $this->assertSame(20.0, (float) $order->tax_amount);
        $this->assertStringNotContainsString('Stale Company Ltd', view('invoice', ['order' => $order])->render());
    }

    public function test_historical_business_order_and_invoice_details_are_preserved_after_profile_update(): void
    {
        $customer = Customer::factory()->business()->create();
        $order = Order::factory()->forCustomer($customer)->create([
            'is_business' => true,
            'company_name' => 'Historical Fabrication Ltd',
            'company_vat_number' => 'GB123456789',
            'subtotal' => 120,
            'shipping' => 0,
            'total' => 120,
            'tax_amount' => 20,
        ]);

        $this->actingAs($customer, 'sanctum')->putJson('/api/v1/customer/profile', [
            'name' => 'Updated Customer',
        ])->assertOk();

        $order->refresh();
        $this->assertTrue((bool) $order->is_business);
        $this->assertSame('Historical Fabrication Ltd', $order->company_name);
        $this->assertSame('GB123456789', $order->company_vat_number);
        $invoice = view('invoice', ['order' => $order])->render();
        $this->assertStringContainsString('Historical Fabrication Ltd', $invoice);
        $this->assertStringContainsString('VAT: GB123456789', $invoice);
        $this->assertStringContainsString('VAT included (20%)', $invoice);
        $this->assertStringContainsString('£20.00', $invoice);
    }
}
