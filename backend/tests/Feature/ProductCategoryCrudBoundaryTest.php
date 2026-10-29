<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCategoryCrudBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_duplicate_category_slug_is_a_validation_error(): void
    {
        $this->postJson('/api/admin/product-categories', ['name' => 'Test Fans'])->assertCreated();
        $this->postJson('/api/admin/product-categories', ['name' => 'Test-Fans'])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->assertDatabaseCount('product_categories', 1);
    }

    public function test_category_name_must_produce_a_usable_public_url(): void
    {
        $this->postJson('/api/admin/product-categories', ['name' => '!!!'])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->assertDatabaseCount('product_categories', 0);
    }

    public function test_renaming_preserves_category_url_and_deleting_preserves_products(): void
    {
        $category = ProductCategory::factory()->create(['name' => 'Original', 'slug' => 'original-url']);
        $product = Product::factory()->withCategory($category)->create();
        $this->putJson("/api/admin/product-categories/{$category->id}", ['name' => 'Renamed'])
            ->assertOk()->assertJsonPath('name', 'Renamed')->assertJsonPath('slug', 'original-url');
        $this->deleteJson("/api/admin/product-categories/{$category->id}")->assertOk();
        $this->assertDatabaseMissing('product_categories', ['id' => $category->id]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'product_category_id' => null]);
    }
}
