<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductReview;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicProductResponseTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_review_only_exposes_the_customer_display_identity(): void
    {
        $product = Product::create(['name' => 'Fan', 'slug' => 'fan', 'price' => '£10.00', 'active' => true]);
        $customer = Customer::create(['name' => 'Reviewer', 'email' => 'private@example.test', 'password' => 'secret-password',
            'phone' => '07000000000', 'address' => 'Private address', 'stripe_customer_id' => 'cus_private']);
        ProductReview::create(['product_id' => $product->id, 'customer_id' => $customer->id, 'rating' => 5, 'comment' => 'Useful']);

        $response = $this->getJson('/api/v1/products/fan')->assertOk();
        $this->assertSame(['id' => $customer->id, 'name' => 'Reviewer'], $response->json('reviews.0.customer'));
        foreach (['private@example.test', 'Private address', '07000000000', 'cus_private'] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }
    }

    public function test_catalog_responses_keep_purchase_fields_without_full_editor_content(): void
    {
        $product = Product::create(['name' => 'Fan', 'slug' => 'fan', 'price' => '£10.00', 'active' => true, 'featured' => true,
            'description' => '<p>Detailed content</p>', 'gallery' => ['/large.jpg'],
            'variants' => [['option' => 'Size', 'value' => '7', 'price' => '£12.00']]]);
        $other = Product::create(['name' => 'Other', 'slug' => 'other', 'price' => '£10.00', 'active' => true]);
        foreach (['/api/v1/products' => 'data.0', '/api/v1/products/featured' => '0', '/api/v1/products/'.$other->id.'/related' => '0'] as $path => $key) {
            $item = $this->getJson($path)->assertOk()->json($key);
            $this->assertSame($product->id, $item['id']);
            $this->assertArrayNotHasKey('description', $item);
            $this->assertArrayNotHasKey('gallery', $item);
            $this->assertSame('£12.00', $item['variants'][0]['price']);
        }
        $this->getJson('/api/v1/products/fan')->assertOk()->assertJsonPath('description', '<p>Detailed content</p>')->assertJsonPath('gallery.0', '/large.jpg');
    }

    public function test_api_authentication_returns_json_even_for_browser_html_requests(): void
    {
        foreach (['/api/admin/products', '/api/admin/orders', '/api/v1/customer/me', '/api/v1/customer/orders'] as $path) {
            $this->get($path, ['Accept' => 'text/html'])->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
        }
    }
}
