<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->where('slug', 'steelton-4-poly-casters-2-with-brakes-4set-8sKk')
            ->where('image', 'like', '%/images/products/reference-catalogue/product-19-v1.webp')->update([
                'image' => '/images/product-photo-unavailable.svg',
                'gallery' => json_encode([]),
            ]);
    }

    public function down(): void
    {
        // Do not republish an incomplete or mismatched set on rollback.
    }
};
