<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Explicit, local-only import of the reviewed reference catalogue. */
class ReferenceShopImportSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('Reference import is restricted to the local SQLite catalogue.');
        }

        $catalogue = json_decode(File::get(database_path('content/reference-shop-catalogue.json')), true, 512, JSON_THROW_ON_ERROR);
        $slugs = array_column($catalogue['products'], 'slug');
        if (count($slugs) !== 27 || count(array_unique($slugs)) !== 27) {
            throw new \RuntimeException('Expected the 27 distinct reference products.');
        }
        $categorySlugs = array_column($catalogue['categories'], 'slug');
        foreach (array_merge($catalogue['products'], $catalogue['categories']) as $entry) {
            $image = $entry['image'];
            if (! str_starts_with($image, '/images/') || str_contains($image, '..') || ! is_file(base_path('../public'.$image))) {
                throw new \RuntimeException('Missing local image: '.$image);
            }
        }
        foreach ($catalogue['products'] as $entry) {
            if ($entry['category_slug'] !== null && ! in_array($entry['category_slug'], $categorySlugs, true)) {
                throw new \RuntimeException('Unknown product category: '.$entry['category_slug']);
            }
        }

        $directory = storage_path('app/private/catalogue-backups');
        File::ensureDirectoryExists($directory);
        $backup = $directory.'/reference-before-'.now()->format('Ymd-His-u').'.json';
        $counts = DB::transaction(function () use ($catalogue, $slugs, $categorySlugs, $backup) {
            if (File::put($backup, json_encode([
                'products' => Product::all()->map(fn ($row) => $row->getAttributes())->all(),
                'categories' => ProductCategory::all()->map(fn ($row) => $row->getAttributes())->all(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) === false) {
                throw new \RuntimeException('Could not create the pre-import backup.');
            }

            // Keep old IDs and order relationships intact; only withdraw their public listings.
            $counts = ['created' => 0, 'updated' => 0, 'withdrawn' => Product::where('active', true)->whereNotIn('slug', $slugs)->update(['active' => false])];
            ProductCategory::whereNotIn('slug', $categorySlugs)->update(['active' => false]);
            foreach ($catalogue['categories'] as $category) {
                unset($category['source_id']);
                ProductCategory::updateOrCreate(['slug' => $category['slug']], $category + ['active' => true]);
            }
            $categories = ProductCategory::pluck('id', 'slug');
            $fillable = array_flip((new Product)->getFillable());
            foreach ($catalogue['products'] as $entry) {
                $attributes = array_intersect_key($entry, $fillable);
                // Imported products use the same options layout as the current admin editor.
                $attributes['frontend_variant_layout'] = 'default';
                $attributes['selection_table_config'] = null;
                $attributes['product_category_id'] = $entry['category_slug'] === null ? null : $categories[$entry['category_slug']];
                $attributes['description'] = HtmlSanitizer::richText($entry['description']);
                $product = Product::updateOrCreate(['slug' => $entry['slug']], $attributes);
                $counts[$product->wasRecentlyCreated ? 'created' : 'updated']++;
            }

            return $counts;
        });

        $this->command?->info(json_encode($counts).' Backup: '.$backup);
    }
}
