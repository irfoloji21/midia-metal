<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WithdrawIncorrectProductPhotosTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_known_incorrect_photos_are_withdrawn(): void
    {
        $conveyor = Product::factory()->create([
            'slug' => 'aluminium-conveyor-feet-commercial-kitchens-jNFE',
            'image' => '/images/products/reference-catalogue/product-5-v1.webp',
            'gallery' => ['/wrong-angle.webp'],
        ]);
        $castors = Product::factory()->create([
            'slug' => 'steelton-4-poly-casters-2-with-brakes-4set-8sKk',
            'image' => '/images/products/reference-catalogue/product-19-v1.webp',
            'gallery' => ['/wrong-set.webp'],
        ]);
        $corrected = Product::factory()->create([
            'slug' => 'gol-conveyor-feet-commercial-kitchens-j8ZX',
            'image' => '/approved-conveyor.webp',
            'gallery' => ['/approved-angle.webp'],
        ]);
        $unrelated = Product::factory()->create(['image' => $conveyor->image]);

        foreach (['010000_withdraw_incorrect_conveyor_photos', '010100_withdraw_incomplete_castor_set_photos'] as $name) {
            $migration = require database_path("migrations/2026_10_22_{$name}.php");
            $migration->up();
            $migration->up(); // Applying the correction again must be harmless.
        }

        foreach ([$conveyor, $castors] as $product) {
            $this->assertSame('/images/product-photo-unavailable.svg', $product->fresh()->image);
            $this->assertSame([], $product->fresh()->gallery);
            $this->assertSame($product->price, $product->fresh()->price);
        }
        $this->assertSame('/approved-conveyor.webp', $corrected->fresh()->image);
        $this->assertSame(['/approved-angle.webp'], $corrected->fresh()->gallery);
        $this->assertSame($unrelated->image, $unrelated->fresh()->image);
    }
}
