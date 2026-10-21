<?php

namespace Tests\Feature;

use App\Mail\AdminNotification;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProductReviewEligibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function purchase(Customer $customer, Product $product, string $status = 'delivered', string $payment = 'paid'): Order
    {
        $order = Order::factory()->create(['customer_id' => $customer->id, 'status' => $status, 'payment_status' => $payment]);
        OrderItem::factory()->create(['order_id' => $order->id, 'product_id' => $product->id]);

        return $order;
    }

    public static function orderStates(): array
    {
        return [
            'delivered paid' => ['delivered', 'paid', null],
            'collected paid' => ['collected', 'paid', null],
            'processing paid' => ['processing', 'paid', 'not_delivered'],
            'shipped paid' => ['shipped', 'paid', 'not_delivered'],
            'ready for collection' => ['ready_for_collection', 'paid', 'not_delivered'],
            'cancelled paid' => ['cancelled', 'paid', 'order_cancelled'],
            'cancelled refunded' => ['cancelled', 'refunded', 'order_cancelled'],
            'delivered pending' => ['delivered', 'pending', 'not_paid'],
            'collected pending' => ['collected', 'pending', 'not_paid'],
            'delivered failed' => ['delivered', 'failed', 'not_paid'],
            'delivered refunded' => ['delivered', 'refunded', 'not_paid'],
            'partial refund' => ['delivered', 'partially_refunded', 'not_paid'],
            'pending refund' => ['delivered', 'refund_pending', 'not_paid'],
            'failed refund' => ['delivered', 'refund_failed', 'not_paid'],
            'manual refund pending' => ['delivered', 'manual_refund_pending', 'not_paid'],
        ];
    }

    #[DataProvider('orderStates')]
    public function test_check_and_submission_enforce_the_same_order_rules(string $status, string $payment, ?string $reason): void
    {
        $customer = Customer::factory()->create();
        $product = Product::factory()->create(['active' => true]);
        $this->purchase($customer, $product, $status, $payment);
        $this->actingAs($customer, 'sanctum');
        $check = $this->getJson("/api/v1/customer/products/{$product->slug}/can-review")->assertOk();
        $response = $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 4, 'comment' => 'Test review']);
        if ($reason === null) {
            $check->assertJsonPath('can_review', true);
            $response->assertCreated();
            $this->assertDatabaseHas('product_reviews', ['customer_id' => $customer->id, 'product_id' => $product->id, 'rating' => 4]);
            $this->getJson("/api/v1/products/{$product->slug}")->assertOk()->assertJsonPath('reviews.0.comment', 'Test review');
            Mail::assertSent(AdminNotification::class, 1);
        } else {
            $check->assertJsonPath('can_review', false)->assertJsonPath('reason', $reason);
            $response->assertForbidden()->assertJsonPath('reason', $reason);
            $this->assertDatabaseCount('product_reviews', 0);
            Mail::assertNothingSent();
        }
    }

    public function test_another_customer_or_another_product_cannot_grant_review_access(): void
    {
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->purchase(Customer::factory()->create(), $product);
        $this->purchase($customer, Product::factory()->create());
        $this->actingAs($customer, 'sanctum');
        $this->getJson("/api/v1/customer/products/{$product->id}/can-review")->assertOk()->assertJsonPath('reason', 'not_purchased');
        $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 5])->assertForbidden();
        $this->assertDatabaseCount('product_reviews', 0);
    }

    public function test_payment_and_delivery_must_belong_to_the_same_order(): void
    {
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->purchase($customer, $product, 'processing', 'paid');
        $this->purchase($customer, $product, 'delivered', 'pending');
        $this->actingAs($customer, 'sanctum');
        $this->getJson("/api/v1/customer/products/{$product->id}/can-review")->assertOk()->assertJsonPath('can_review', false);
        $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 5])->assertForbidden();
        $this->purchase($customer, $product);
        $this->getJson("/api/v1/customer/products/{$product->id}/can-review")->assertOk()->assertJsonPath('can_review', true);
    }

    public function test_payment_is_rechecked_at_submission_and_duplicates_are_rejected(): void
    {
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $order = $this->purchase($customer, $product);
        $this->actingAs($customer, 'sanctum');
        $this->getJson("/api/v1/customer/products/{$product->id}/can-review")->assertOk()->assertJsonPath('can_review', true);
        $order->update(['payment_status' => 'refund_pending']);
        $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 5])->assertForbidden();
        $order->update(['payment_status' => 'paid']);
        $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 5])->assertCreated();
        $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 5])->assertStatus(400)->assertJsonPath('reason', 'already_reviewed');
        $this->getJson("/api/v1/customer/products/{$product->id}/can-review")->assertOk()->assertJsonPath('reason', 'already_reviewed');
        $this->assertDatabaseCount('product_reviews', 1);
        Mail::assertSent(AdminNotification::class, 1);
    }

    public function test_guest_requests_require_authentication(): void
    {
        $product = Product::factory()->create();
        $this->getJson("/api/v1/customer/products/{$product->id}/can-review")->assertUnauthorized();
        $this->postJson("/api/v1/customer/products/{$product->id}/reviews", ['rating' => 5])->assertUnauthorized();
    }

    public function test_cookie_session_recognizes_the_customer_without_a_bearer_header(): void
    {
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->purchase($customer, $product);
        $token = $customer->createToken('review-test', ['customer'])->plainTextToken;
        $this->withCredentials()->withUnencryptedCookie('customer_token', $token);
        $this->getJson('/api/v1/customer/me')->assertOk()->assertJsonPath('id', $customer->id);
        $this->getJson("/api/v1/customer/products/{$product->slug}/can-review")->assertOk()->assertJsonPath('can_review', true);
    }
}
