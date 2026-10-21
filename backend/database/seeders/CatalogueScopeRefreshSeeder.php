<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class CatalogueScopeRefreshSeeder extends Seeder
{
    public function run(): void
    {
        // Apply explicitly after reviewing the reference catalogue; do not import prices or stock.
        $scope = json_decode(File::get(database_path('content/catalogue-scope.json')), true, 512, JSON_THROW_ON_ERROR);
        $directory = storage_path('app/private/catalogue-backups');
        File::ensureDirectoryExists($directory);
        $backup = $directory.'/scope-before-'.now()->format('Ymd-His-u').'.json';

        $counts = DB::transaction(function () use ($scope, $backup) {
            $saved = File::put($backup, json_encode([
                'products' => Product::all()->map(fn ($row) => $row->getAttributes())->all(),
                'categories' => ProductCategory::all()->map(fn ($row) => $row->getAttributes())->all(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            if ($saved === false) {
                throw new \RuntimeException('Could not back up the catalogue before changing its scope.');
            }

            $categoryIds = ProductCategory::whereIn('slug', $scope['withdrawn_categories'])->pluck('id');
            $withdrawnProducts = Product::where('active', true)
                ->where(function ($query) use ($scope, $categoryIds) {
                    $query->whereIn('slug', array_column($scope['withdrawn_products'], 'slug'))
                        ->orWhereIn('product_category_id', $categoryIds);
                })->update(['active' => false]);
            $withdrawnCategories = ProductCategory::whereIn('id', $categoryIds)
                ->where('active', true)->update(['active' => false]);

            foreach ($scope['category_updates'] as $entry) {
                $category = ProductCategory::where('slug', $entry['slug'])->first();
                if ($category) {
                    $category->update([
                        'name' => $entry['name'],
                        'description' => $entry['description'],
                        'image' => $entry['image'],
                    ]);
                }
            }

            return ['withdrawn_products' => $withdrawnProducts, 'withdrawn_categories' => $withdrawnCategories];
        });

        $this->command?->info(json_encode($counts).' Backup: '.$backup);
    }
}
