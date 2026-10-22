<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->whereIn('slug', [
            'aluminium-conveyor-feet-commercial-kitchens-jNFE',
            'gol-conveyor-feet-commercial-kitchens-j8ZX',
            'gold-conveyor-feet-commercial-kitchens-R0ey',
        ])->where('image', 'like', '%/images/products/reference-catalogue/product-5-v1.webp')->update([
            'image' => '/images/product-photo-unavailable.svg',
            'gallery' => json_encode([]),
        ]);
    }

    public function down(): void
    {
        // Do not republish known incorrect product photos on rollback.
    }
};
