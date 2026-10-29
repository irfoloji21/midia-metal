<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class LongwellDd7DescriptionExpansionSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('This description update is restricted to the local SQLite site.');
        }

        $description = HtmlSanitizer::richText(file_get_contents(database_path('content/dd7-product-description.html')));

        DB::transaction(function () use ($description) {
            $product = Product::whereKey(59)->where('slug', 'centrifugal-fan-d-7-J3VG')->firstOrFail();
            if ($product->description === $description) {
                return;
            }

            // Do not overwrite edits made after the description this update extends.
            if (hash('sha256', $product->description) !== 'ad49083a25e57e0c2dce04c8164b7036dc0033d9d5b5a245c9ab6d14377f4529') {
                throw new \RuntimeException('DD7 has newer description edits; import stopped.');
            }

            $backup = 'private/product-59-before-description-expansion.json';
            if (! Storage::disk('local')->exists($backup)) {
                Storage::disk('local')->put($backup, $product->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }

            $product->update(['description' => $description]);
        });

        $this->command?->info('Extended DD7 description with editable copy, a reference table and two/three-column image rows.');
    }
}
