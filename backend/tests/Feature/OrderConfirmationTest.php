<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class OrderConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_minimal_confirmation_payload_for_valid_token(): void
    {
        $order = Order::factory()->create([
            'order_number' => 'ORD-CONFIRM-001',
            'payment_method' => 'Credit / Debit Card',
            'total' => 123.45,
        ]);

        OrderItem::factory()->for($order)->create([
            'product_name' => 'Recovered Product',
            'quantity' => 2,
        ]);

        $token = Crypt::encryptString(json_encode([
            'order' => $order->order_number,
            'exp' => now()->addDays(7)->timestamp,
        ], JSON_THROW_ON_ERROR));

        $response = $this->getJson("/api/v1/orders/confirmation?order={$order->order_number}&token=".urlencode($token));

        $response->assertOk()->assertExactJson([
            'order_number' => 'ORD-CONFIRM-001',
            'created_at' => $order->created_at->toIso8601String(),
            'payment_status' => $order->payment_status,
            'bank_transfer_details' => null,
            'payment_method' => 'Credit / Debit Card',
            'total' => 123.45,
            'items' => [
                [
                    'name' => 'Recovered Product',
                    'quantity' => 2,
                ],
            ],
        ]);
    }

    public function test_rejects_invalid_confirmation_token(): void
    {
        $order = Order::factory()->create([
            'order_number' => 'ORD-CONFIRM-002',
        ]);

        $response = $this->getJson("/api/v1/orders/confirmation?order={$order->order_number}&token=invalid-token");

        $response->assertStatus(403)
            ->assertJson(['message' => 'Invalid confirmation token.']);
    }

    public function test_rejects_expired_confirmation_token(): void
    {
        $order = Order::factory()->create([
            'order_number' => 'ORD-CONFIRM-003',
        ]);

        $token = Crypt::encryptString(json_encode([
            'order' => $order->order_number,
            'exp' => now()->subMinute()->timestamp,
        ], JSON_THROW_ON_ERROR));

        $response = $this->getJson("/api/v1/orders/confirmation?order={$order->order_number}&token=".urlencode($token));

        $response->assertStatus(403)
            ->assertJson(['message' => 'Invalid or expired confirmation token.']);
    }

    public function test_rejects_mismatched_order_and_token(): void
    {
        $order = Order::factory()->create([
            'order_number' => 'ORD-CONFIRM-004',
        ]);

        $token = Crypt::encryptString(json_encode([
            'order' => $order->order_number,
            'exp' => now()->addDays(7)->timestamp,
        ], JSON_THROW_ON_ERROR));

        $response = $this->getJson('/api/v1/orders/confirmation?order=ORD-CONFIRM-OTHER&token='.urlencode($token));

        $response->assertStatus(403)
            ->assertJson(['message' => 'Invalid or expired confirmation token.']);
    }

    public function test_rejects_request_missing_required_params(): void
    {
        $response = $this->getJson('/api/v1/orders/confirmation');

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['order', 'token']);
    }

    public function test_returns_not_found_for_valid_token_without_matching_order(): void
    {
        $token = Crypt::encryptString(json_encode([
            'order' => 'ORD-GHOST-999',
            'exp' => now()->addDays(7)->timestamp,
        ], JSON_THROW_ON_ERROR));

        $response = $this->getJson('/api/v1/orders/confirmation?order=ORD-GHOST-999&token='.urlencode($token));

        $response->assertStatus(404)
            ->assertJson(['message' => 'Order confirmation not found.']);
    }
}
