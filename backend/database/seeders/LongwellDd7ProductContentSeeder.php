<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class LongwellDd7ProductContentSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('This content update is restricted to the local SQLite site.');
        }
        $detail = json_decode(file_get_contents(database_path('content/dd7-product-detail.json')), true, 512, JSON_THROW_ON_ERROR);
        $product = Product::whereKey($detail['target_id'])->where('slug', $detail['target_slug'])->firstOrFail();
        $base = '/images/products/longwell-dd7-5-ec/';
        $images = array_map(fn ($name) => $base.'longwell-dd7-5-ec-'.$name.'.webp', ['front', 'motor-side', 'rear', 'dimensions', 'performance']);
        foreach ([...$images, '/documents/longwell-lwdd7-5-ec-datasheet.pdf'] as $asset) {
            if (! is_file(public_path(ltrim($asset, '/')))) {
                throw new \RuntimeException('Product asset missing: '.$asset);
            }
        }
        $fields = [
            'name' => $detail['name'],
            'product_code' => $detail['product_code'],
            'description' => HtmlSanitizer::richText(file_get_contents(database_path('content/dd7-product-description.html'))),
            'specifications' => $detail['specifications'],
            'image' => $images[0],
            'gallery' => array_slice($images, 1),
            // The admin form requires a priced option, even for a single model.
            'variants' => [['option' => 'Model', 'value' => $detail['product_code'], 'price' => $product->price]],
        ];
        $backupPath = 'private/product-59-before-longwell-dd7.json';
        if (! Storage::disk('local')->exists($backupPath)) {
            Storage::disk('local')->put($backupPath, $product->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        $before = json_decode(Storage::disk('local')->get($backupPath), true, 512, JSON_THROW_ON_ERROR);
        foreach ($fields as $field => $value) {
            if ($product->$field !== ($before[$field] ?? null) && $product->$field !== $value) {
                throw new \RuntimeException('Product has newer edits in '.$field.'; import stopped.');
            }
        }
        DB::transaction(fn () => $product->update($fields));
        $this->command?->info('Updated local product 59 with LONGWELL DD7-5 content. Existing slug, price, category, publication and fulfilment settings preserved.');
    }
}
