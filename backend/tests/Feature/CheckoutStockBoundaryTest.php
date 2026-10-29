<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Services\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Fakes\StripeGatewayFake;
use Tests\TestCase;

class CheckoutStockBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private StripeGatewayFake $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        $this->gateway = new StripeGatewayFake;
        $this->app->instance(StripeGateway::class, $this->gateway);
    }

    private function intent(array $items)
    {
        return $this->postJson('/api/v1/payment/intent', [
            'customer_name' => 'Stock Test', 'customer_email' => 'stock@example.com',
            'shipping_address' => 'Collection', 'billing_address' => 'Test address',
            'payment_method' => 'card', 'fulfilment_method' => 'click_collect',
            'payment_attempt_id' => (string) Str::uuid(), 'items' => $items,
        ]);
    }

    public function test_duplicate_simple_lines_cannot_exceed_total_stock(): void
    {
        $product = Product::factory()->tracked(3)->create(['price' => '£10.00']);
        $line = ['product_id' => $product->id, 'quantity' => 2];
        $this->intent([$line, $line])->assertUnprocessable()->assertJsonValidationErrors('items.1.quantity');
        $this->assertCount(0, $this->gateway->requests);
        $this->assertSame(3, $product->fresh()->stock_quantity);
    }

    public function test_duplicate_combination_lines_cannot_exceed_variant_stock(): void
    {
        $product = Product::factory()->tracked(5)->combination(['Size'], [
            ['attributes' => ['Size' => 'Small'], 'price' => '£10.00', 'stock' => 3],
            ['attributes' => ['Size' => 'Large'], 'price' => '£20.00', 'stock' => 2],
        ])->create();
        $line = ['product_id' => $product->id, 'quantity' => 2, 'selected_variants' => ['Size' => ['value' => 'Small']]];
        $this->intent([$line, $line])->assertUnprocessable()->assertJsonValidationErrors('items.1.quantity');
        $this->assertCount(0, $this->gateway->requests);
    }

    public function test_duplicate_lines_within_stock_and_distinct_variants_remain_valid(): void
    {
        $product = Product::factory()->tracked(5)->combination(['Size'], [
            ['attributes' => ['Size' => 'Small'], 'price' => '£10.00', 'stock' => 3],
            ['attributes' => ['Size' => 'Large'], 'price' => '£20.00', 'stock' => 2],
        ])->create();
        $small = ['product_id' => $product->id, 'quantity' => 1, 'selected_variants' => ['Size' => ['value' => 'Small']]];
        $large = ['product_id' => $product->id, 'quantity' => 2, 'selected_variants' => ['Size' => ['value' => 'Large']]];
        $this->intent([$small, $small, $large])->assertOk()->assertJsonPath('amount', 60);
        $this->assertSame(6000, $this->gateway->requests[0]['amount']);
    }

    public function test_legacy_options_share_stock_across_different_basket_lines(): void
    {
        $product = Product::factory()->tracked(3)->withVariants([
            ['option' => 'Size', 'value' => 'Small', 'price' => '£10.00', 'stock' => 3],
            ['option' => 'Colour', 'value' => 'Red', 'price' => null, 'stock' => null],
            ['option' => 'Colour', 'value' => 'Blue', 'price' => null, 'stock' => null],
        ])->create();
        $line = ['product_id' => $product->id, 'quantity' => 2];
        $red = $line + ['selected_variants' => ['Size' => ['value' => 'Small'], 'Colour' => ['value' => 'Red']]];
        $blue = $line + ['selected_variants' => ['Size' => ['value' => 'Small'], 'Colour' => ['value' => 'Blue']]];
        $this->intent([$red, $blue])->assertUnprocessable()->assertJsonValidationErrors('items.1.quantity');
        $this->assertCount(0, $this->gateway->requests);
    }
}
