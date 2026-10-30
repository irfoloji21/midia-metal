<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Explicit local catalogue setup; deliberately not registered in DatabaseSeeder. */
class LocalProductCatalogueSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('Sample prices may only be installed in the local SQLite environment.');
        }

        $catalogue = json_decode(File::get(database_path('content/product-catalogue.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach (array_merge($catalogue['categories'], $catalogue['products']) as $entry) {
            if (! is_file(base_path('../public'.$entry['image']))) {
                throw new \RuntimeException('Missing catalogue image: '.$entry['image']);
            }
        }

        $backupDirectory = storage_path('app/private/catalogue-backups');
        File::ensureDirectoryExists($backupDirectory);
        $backup = $backupDirectory.'/before-'.now()->format('Ymd-His-u').'.json';
        $counts = DB::transaction(function () use ($catalogue, $backup) {
            // Raw attributes preserve original slugs, prices, statuses and media paths.
            $saved = File::put($backup, json_encode([
                'products' => Product::all()->map(fn ($row) => $row->getAttributes())->all(),
                'categories' => ProductCategory::all()->map(fn ($row) => $row->getAttributes())->all(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            if ($saved === false) {
                throw new \RuntimeException('Could not back up the existing catalogue.');
            }

            foreach ($catalogue['categories'] as $category) {
                ProductCategory::firstOrCreate(['slug' => $category['slug']], $category + ['active' => true]);
            }
            $categories = ProductCategory::pluck('id', 'slug');
            $counts = ['updated' => 0, 'created' => 0, 'skipped' => 0];
            $order = (int) Product::max('order');

            foreach ($catalogue['products'] as $entry) {
                if (! isset($categories[$entry['category']])) {
                    throw new \RuntimeException('Unknown category: '.$entry['category']);
                }
                $content = [
                    'name' => $entry['name'],
                    'description' => HtmlSanitizer::richText($entry['description']),
                    'image' => $entry['image'],
                    'tags' => $entry['tags'],
                    'specifications' => $entry['specifications'],
                    'product_category_id' => $categories[$entry['category']],
                ];

                if (isset($entry['id'])) {
                    $product = Product::whereKey($entry['id'])->where('slug', $entry['expected'])->first();
                    // Do not recreate deleted records or overwrite later admin copy edits.
                    if (! $product || trim((string) $product->description) !== '') {
                        $counts['skipped']++;

                        continue;
                    }
                    $product->update($content);
                    $counts['updated']++;

                    continue;
                }

                $product = Product::firstOrCreate(['slug' => $entry['slug']], $content + [
                    'product_code' => $entry['code'],
                    'price' => '£'.number_format($entry['price'], 2, '.', ''),
                    'old_price' => null,
                    'active' => true,
                    'featured' => false,
                    'order' => ++$order,
                    'variant_mode' => 'legacy',
                    'show_variant_in_title' => false,
                    'variant_options' => [],
                    'variants' => [],
                    'gallery' => [],
                    'track_stock' => false,
                ]);
                $counts[$product->wasRecentlyCreated ? 'created' : 'skipped']++;
            }

            return $counts;
        });

        $this->command?->info(json_encode($counts).' Backup: '.$backup);
    }
}
