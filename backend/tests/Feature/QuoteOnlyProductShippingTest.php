<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteOnlyProductShippingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_new_quote_only_product_with_null_shipping_fields_uses_database_defaults(): void
    {
        $response = $this->postJson('/api/admin/products', [
            'name' => 'Quote-only section template', 'price_on_request' => true, 'active' => false, 'variants' => [],
            'shipping_weight_kg' => null, 'shipping_length_cm' => null, 'shipping_width_cm' => null, 'shipping_height_cm' => null,
            'shipping_class' => null, 'description' => '<div class="content-section"><h2>Overview</h2><p>Test.</p></div>',
        ])->assertCreated();
        $product = Product::findOrFail($response->json('id'));
        $this->assertSame(2.0, $product->shipping_weight_kg);
        $this->assertSame(30.0, $product->shipping_length_cm);
        $this->assertSame(20.0, $product->shipping_width_cm);
        $this->assertSame(10.0, $product->shipping_height_cm);
        $this->assertSame('standard', $product->shipping_class);
        $this->assertFalse($product->active);
        $this->assertStringContainsString('class="content-section"', $product->description);
    }

    public function test_quote_only_product_keeps_explicit_shipping_values_and_empty_variant_edits_keep_saved_values(): void
    {
        $response = $this->postJson('/api/admin/products', [
            'name' => 'Quote-only dimensions', 'price_on_request' => true, 'active' => false, 'variants' => [],
            'shipping_weight_kg' => 7.5, 'shipping_length_cm' => 65, 'shipping_width_cm' => 42, 'shipping_height_cm' => 28,
            'shipping_class' => 'freight', 'ships_separately' => true,
        ])->assertCreated();
        $id = $response->json('id');
        $this->putJson('/api/admin/products/'.$id, [
            'name' => 'Quote-only changed description', 'price_on_request' => true, 'variants' => [],
            'description' => '<div class="content-section"><h2>Changed</h2></div>',
            'shipping_weight_kg' => null, 'shipping_length_cm' => null, 'shipping_width_cm' => null, 'shipping_height_cm' => null, 'shipping_class' => null,
        ])->assertOk();
        $product = Product::findOrFail($id);
        $this->assertSame(7.5, $product->shipping_weight_kg);
        $this->assertSame(65.0, $product->shipping_length_cm);
        $this->assertSame(42.0, $product->shipping_width_cm);
        $this->assertSame(28.0, $product->shipping_height_cm);
        $this->assertSame('freight', $product->shipping_class);
        $this->assertTrue($product->ships_separately);
    }
}
