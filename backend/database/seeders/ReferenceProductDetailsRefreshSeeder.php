<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Applies reviewed product details without changing prices, stock or other catalogue content. */
class ReferenceProductDetailsRefreshSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('Product detail refresh is restricted to the local SQLite catalogue.');
        }

        $catalogue = json_decode(File::get(database_path('content/reference-shop-catalogue.json')), true, 512, JSON_THROW_ON_ERROR);
        $slugs = array_column($catalogue['products'], 'slug');
        if (count($slugs) !== 27 || count(array_unique($slugs)) !== 27 || Product::whereIn('slug', $slugs)->count() !== 27) {
            throw new \RuntimeException('Expected all 27 reference products to exist.');
        }

        $fields = array_flip([
            'variants', 'variant_mode', 'variant_options', 'specifications',
            'variant_table_columns', 'frontend_variant_layout', 'selection_table_config', 'gallery',
        ]);
        foreach ($catalogue['products'] as $entry) {
            foreach ($entry['gallery'] ?? [] as $image) {
                if (! str_starts_with($image, '/images/') || str_contains($image, '..') || ! is_file(base_path('../public'.$image))) {
                    throw new \RuntimeException('Missing local gallery image: '.$image);
                }
            }
        }

        $directory = storage_path('app/private/catalogue-backups');
        File::ensureDirectoryExists($directory);
        $backup = $directory.'/product-details-before-'.now()->format('Ymd-His-u').'.json';
        DB::transaction(function () use ($catalogue, $slugs, $fields, $backup) {
            $products = Product::whereIn('slug', $slugs)->get()->keyBy('slug');
            if (File::put($backup, json_encode($products->map(fn ($product) => $product->getAttributes())->all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) === false) {
                throw new \RuntimeException('Could not back up product data.');
            }

            foreach ($catalogue['products'] as $entry) {
                $product = $products[$entry['slug']];
                $before = array_diff_key($product->getAttributes(), $fields + ['updated_at' => true]);
                $product->fill(array_intersect_key($entry, $fields));
                $product->save();
                $product->refresh();
                $after = array_diff_key($product->getAttributes(), $fields + ['updated_at' => true]);
                if ($before !== $after) {
                    throw new \RuntimeException('Unexpected change outside approved details for '.$entry['slug']);
                }
            }
        });

        $this->command?->info('Updated details for 27 products; all other product fields unchanged. Backup: '.$backup);
    }
}
