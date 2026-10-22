<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminOrderTest extends TestCase
{
    use RefreshDatabase;

    private function authenticatedAdmin(): AdminUser
    {
        /** @var AdminUser $admin */
        $admin = AdminUser::factory()->create();
        $this->actingAs($admin, 'sanctum');

        return $admin;
    }

    // ─── Order listing ────────────────────────────────────────────────

    public function test_admin_can_list_orders(): void
    {
        $this->authenticatedAdmin();
        $orders = Order::factory()->count(5)->create();

        $response = $this->getJson('/api/admin/orders');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => ['id', 'order_number', 'customer_name', 'status', 'total'],
            ],
        ]);
        $this->assertSame(5, $response->json('total'));
    }

    public function test_older_orders_remain_accessible_and_searchable_after_first_page(): void
    {
        $this->authenticatedAdmin();
        $older = Order::factory()->create(['customer_name' => 'Older customer', 'created_at' => now()->subDay()]);
        Order::factory()->count(15)->create();

        $this->getJson('/api/admin/orders')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('last_page', 2);
        $this->getJson('/api/admin/orders?page=2')->assertOk()->assertJsonPath('data.0.id', $older->id);
        $this->getJson('/api/admin/orders?search=Older')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $older->id);
    }

    public function test_order_search_and_status_filters_apply_together(): void
    {
        $this->authenticatedAdmin();
        Order::factory()->create(['order_number' => 'TARGET-1', 'status' => 'pending']);
        Order::factory()->create(['customer_name' => 'TARGET buyer', 'status' => 'pending']);
        $match = Order::factory()->create(['customer_email' => 'target@example.com', 'status' => 'shipped']);

        $this->getJson('/api/admin/orders?search=TARGET&status=shipped')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $match->id);
    }

    public function test_admin_can_search_orders_by_name(): void
    {
        $this->authenticatedAdmin();
        Order::factory()->create(['customer_name' => 'Alice Smith']);
        Order::factory()->create(['customer_name' => 'Bob Jones']);

        $response = $this->getJson('/api/admin/orders?search=Alice');

        $response->assertOk();
        $this->assertSame(1, $response->json('total'));
        $this->assertSame('Alice Smith', $response->json('data.0.customer_name'));
    }

    public function test_admin_can_filter_orders_by_status(): void
    {
        $this->authenticatedAdmin();
        Order::factory()->count(3)->create(['status' => 'pending']);
        Order::factory()->count(2)->create(['status' => 'shipped']);

        $response = $this->getJson('/api/admin/orders?status=shipped');

        $response->assertOk();
        $this->assertSame(2, $response->json('total'));
    }

    // ─── Order view ───────────────────────────────────────────────────

    public function test_admin_can_view_single_order(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create();
        $product = Product::factory()->create(['price' => '£50.00']);
        OrderItem::factory()->forProduct($product)->create([
            'order_id' => $order->id,
            'quantity' => 2,
        ]);

        $response = $this->getJson("/api/admin/orders/{$order->id}");

        $response->assertOk();
        $response->assertJsonPath('order_number', $order->order_number);
        $this->assertCount(1, $response->json('items'));
    }

    // ─── Order update ─────────────────────────────────────────────────

    public function test_admin_can_update_order_status(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create(['status' => 'pending']);

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'processing',
        ]);

        $response->assertOk();
        $this->assertSame('processing', $order->fresh()->status);
    }

    public function test_admin_can_update_payment_status(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create(['payment_status' => 'pending']);

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'payment_status' => 'paid',
        ]);

        $response->assertOk();
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_admin_can_set_partially_refunded_status(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->paid()->create();

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'payment_status' => 'partially_refunded',
        ]);

        $response->assertOk();
        $this->assertSame('partially_refunded', $order->fresh()->payment_status);
    }

    public function test_admin_cannot_set_invalid_status(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create();

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'status' => 'invalid_status',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }

    public function test_admin_cannot_set_invalid_payment_status(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create();

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'payment_status' => 'bitcoin_received',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['payment_status']);
    }

    public function test_admin_can_add_tracking_number(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create();

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'tracking_number' => 'RM123456789GB',
        ]);

        $response->assertOk();
        $this->assertSame('RM123456789GB', $order->fresh()->tracking_number);
    }

    public function test_admin_can_add_notes(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create();

        $response = $this->putJson("/api/admin/orders/{$order->id}", [
            'notes' => 'Customer requested gift wrapping',
        ]);

        $response->assertOk();
        $this->assertSame('Customer requested gift wrapping', $order->fresh()->notes);
    }

    // ─── Shipping actions ──────────────────────────────────────────────

    public function test_admin_can_create_shipping_label_for_delivery_order(): void
    {
        Storage::fake('public');
        $this->authenticatedAdmin();

        $product = Product::factory()->create(['price' => '£50.00']);
        $order = Order::factory()->create([
            'shipping_address' => '123 High St, London, SW1A 1AA',
            'shipping_address_line1' => '123 High St',
            'shipping_city' => 'London',
            'shipping_postcode' => 'SW1A 1AA',
            'shipping_country' => 'United Kingdom',
            'shipping_metadata' => [
                'fulfilment_method' => 'delivery',
                'selected_delivery_option' => [
                    'service' => 'Royal Mail Tracked 48',
                ],
            ],
        ]);
        OrderItem::factory()->forProduct($product)->create([
            'order_id' => $order->id,
            'quantity' => 1,
        ]);

        $response = $this->postJson("/api/admin/orders/{$order->id}/shipping/label", [
            'tracking_number' => 'EZ1000000001',
        ]);

        $response->assertOk();
        $response->assertJsonPath('tracking_number', 'EZ1000000001');
        $response->assertJsonPath('shipping_status', 'pre_transit');
        $this->assertSame('EZ1000000001', $order->fresh()->tracking_number);
        $this->assertNotNull($order->fresh()->shipping_shipment_id);
        $this->assertNotNull($order->fresh()->shipping_label_url);
        $this->assertSame('processing', $order->fresh()->status);
    }

    public function test_admin_can_refresh_tracking_for_delivery_order(): void
    {
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'tracking_number' => 'EZ3000000003',
            'shipping_provider' => 'easypost',
            'shipping_carrier' => 'Royal Mail',
            'shipping_service' => 'Royal Mail Tracked 48',
            'shipping_metadata' => [
                'fulfilment_method' => 'delivery',
                'shipments' => [[
                    'tracking_number' => 'EZ3000000003',
                    'shipment_id' => 'mock_shipment_123',
                    'status' => 'pre_transit',
                    'detail' => 'Shipment created',
                ]],
            ],
        ]);

        $response = $this->postJson("/api/admin/orders/{$order->id}/shipping/track", [
            'tracking_number' => 'EZ3000000003',
        ]);

        $response->assertOk();
        $response->assertJsonPath('tracking_number', 'EZ3000000003');
        $response->assertJsonPath('shipping_status', 'out_for_delivery');
        $this->assertSame('EZ3000000003', $order->fresh()->tracking_number);
        $this->assertSame('shipped', $order->fresh()->status);
    }

    public function test_admin_can_void_existing_shipment(): void
    {
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'shipping_shipment_id' => 'mock_shipment_void',
            'shipping_metadata' => [
                'fulfilment_method' => 'delivery',
                'shipments' => [[
                    'tracking_number' => 'EZ1000000001',
                    'shipment_id' => 'mock_shipment_void',
                    'status' => 'pre_transit',
                    'detail' => 'Shipment created',
                ]],
            ],
        ]);

        $response = $this->postJson("/api/admin/orders/{$order->id}/shipping/void");

        $response->assertOk();
        $response->assertJsonPath('shipping_status', 'voided');
        $this->assertSame('submitted', data_get($order->fresh()->shipping_metadata, 'void_results.0.status'));
        $this->assertSame('voided', $order->fresh()->shipping_status);
    }

    public function test_click_and_collect_orders_reject_shipping_actions(): void
    {
        $this->authenticatedAdmin();

        $order = Order::factory()->clickAndCollect()->create([
            'shipping_metadata' => [
                'fulfilment_method' => 'click_collect',
            ],
        ]);

        $labelResponse = $this->postJson("/api/admin/orders/{$order->id}/shipping/label");
        $labelResponse->assertStatus(422)
            ->assertJson(['message' => 'Shipping labels are not available for click & collect orders.']);

        $trackResponse = $this->postJson("/api/admin/orders/{$order->id}/shipping/track");
        $trackResponse->assertStatus(422)
            ->assertJson(['message' => 'Tracking refresh is not available for click & collect orders.']);

        $voidResponse = $this->postJson("/api/admin/orders/{$order->id}/shipping/void");
        $voidResponse->assertStatus(422)
            ->assertJson(['message' => 'Void is not available for click & collect orders.']);
    }

    public function test_admin_cannot_void_shipment_when_none_exists(): void
    {
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'shipping_shipment_id' => null,
            'shipping_metadata' => [
                'fulfilment_method' => 'delivery',
            ],
        ]);

        $response = $this->postJson("/api/admin/orders/{$order->id}/shipping/void");

        $response->assertStatus(422)
            ->assertJson(['message' => 'No shipping label has been created for this order.']);
    }

    public function test_admin_can_download_shipping_label_from_local_storage(): void
    {
        Storage::fake('public');
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'shipping_label_url' => '/storage/shipping/labels/label_123.pdf',
        ]);

        Storage::disk('public')->put('shipping/labels/label_123.pdf', 'dummy content');

        $response = $this->getJson("/api/admin/orders/{$order->id}/shipping/label/download");

        $response->assertOk();
    }

    public function test_admin_is_redirected_for_external_shipping_label_url(): void
    {
        Storage::fake('public');
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'shipping_label_url' => 'https://external-shipping-provider.com/labels/123.pdf',
        ]);

        $response = $this->getJson("/api/admin/orders/{$order->id}/shipping/label/download");

        $response->assertRedirect('https://external-shipping-provider.com/labels/123.pdf');
    }

    public function test_admin_receives_404_when_shipping_label_does_not_exist(): void
    {
        Storage::fake('public');
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'shipping_label_url' => null,
        ]);

        $response = $this->getJson("/api/admin/orders/{$order->id}/shipping/label/download");

        $response->assertStatus(404);
    }

    public function test_admin_receives_404_when_local_shipping_label_file_is_missing(): void
    {
        Storage::fake('public');
        $this->authenticatedAdmin();

        $order = Order::factory()->create([
            'shipping_label_url' => '/storage/shipping/labels/missing.pdf',
        ]);

        $response = $this->getJson("/api/admin/orders/{$order->id}/shipping/label/download");

        $response->assertStatus(404);
    }

    // ─── Order deletion ───────────────────────────────────────────────

    public function test_admin_can_delete_order(): void
    {
        $this->authenticatedAdmin();
        $order = Order::factory()->create();

        $response = $this->deleteJson("/api/admin/orders/{$order->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('orders', ['id' => $order->id]);
    }

    // ─── Auth guard ───────────────────────────────────────────────────

    public function test_unauthenticated_cannot_access_orders(): void
    {
        $response = $this->getJson('/api/admin/orders');

        $response->assertStatus(401);
    }

    public function test_unauthenticated_cannot_perform_shipping_actions(): void
    {
        $order = Order::factory()->create();

        $this->postJson("/api/admin/orders/{$order->id}/shipping/label")->assertStatus(401);
        $this->postJson("/api/admin/orders/{$order->id}/shipping/track")->assertStatus(401);
        $this->postJson("/api/admin/orders/{$order->id}/shipping/void")->assertStatus(401);
        $this->getJson("/api/admin/orders/{$order->id}/shipping/label/download")->assertStatus(401);
    }
}
