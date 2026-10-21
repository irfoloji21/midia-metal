<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Product;
use App\Support\HtmlSanitizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ProductEditorialContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_story_and_table_survive_admin_save_and_reopen(): void
    {
        Http::preventStrayRequests();
        config(['services.frontend_content_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $product = Product::create(['name' => 'Test EC Fan', 'slug' => 'test-ec-fan', 'price' => '£540.00', 'active' => false]);
        $description = '<div class="product-section fixed" onclick="bad()"><div class="product-split"><div><h2>Motor</h2><p>EC control</p></div><div class="product-media"><img src="/images/fan.webp" alt="Motor view" onerror="bad()" /></div></div></div><div class="product-spec-slot"></div><div class="product-section"><div class="product-table-wrap product-performance-table"><table><thead><tr><th>Airflow</th></tr></thead><tbody><tr><td>1400</td></tr></tbody></table></div><div class="product-links"><a href="/documents/fan.pdf">Product data</a></div></div><script>bad()</script>';
        $payload = [
            'name' => $product->name, 'price' => $product->price, 'description' => $description,
            'variants' => [['option' => 'Model', 'value' => 'EC', 'price' => '£540.00']],
            'specifications' => ['Motor power' => '200 W'],
        ];
        $saved = $this->putJson('/api/admin/products/'.$product->id, $payload)->assertOk()->json('description');
        foreach (['product-section', 'product-split', 'product-media', 'product-spec-slot', 'product-table-wrap product-performance-table', 'product-links', '<td>1400</td>', 'alt="Motor view"', '/documents/fan.pdf'] as $expected) {
            $this->assertStringContainsString($expected, $saved);
        }
        foreach (['fixed', 'onerror', 'onclick', '<script', 'bad()'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $saved);
        }
        $payload['description'] = $saved;
        $payload['specifications']['Motor power'] = 'Updated specification';
        $normalised = HtmlSanitizer::richText($saved);
        $this->putJson('/api/admin/products/'.$product->id, $payload)->assertOk()->assertJsonPath('description', $normalised);
        $this->getJson('/api/admin/products/'.$product->id)->assertOk()
            ->assertJsonPath('description', $normalised)
            ->assertJsonPath('specifications.Motor power', 'Updated specification');
    }
}
