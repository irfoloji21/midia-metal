<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SitemapTest extends TestCase
{
    use RefreshDatabase;

    public function test_sitemap_tracks_active_content_without_exposing_body_or_private_routes(): void
    {
        $product = Product::create(['name' => 'Fan', 'slug' => 'fan', 'price' => '£10.00', 'active' => true, 'description' => 'Large private draft body']);
        Product::create(['name' => 'Draft', 'slug' => 'draft', 'price' => '£10.00', 'active' => false]);
        ProductCategory::create(['name' => 'Fans', 'slug' => 'fans', 'active' => true]);
        Service::create(['title' => 'Service', 'slug' => 'service', 'active' => true]);
        $entries = $this->getJson('/api/v1/sitemap')->assertOk()->json();
        $this->assertEqualsCanonicalizing(['/shop/fan', '/shop/category/fans', '/services/service'], array_column($entries, 'path'));
        $this->assertSame(['path', 'lastmod'], array_keys($entries[0]));
        $product->update(['active' => false]);
        $this->getJson('/api/v1/sitemap')->assertOk()->assertJsonMissing(['path' => '/shop/fan']);
    }
}
