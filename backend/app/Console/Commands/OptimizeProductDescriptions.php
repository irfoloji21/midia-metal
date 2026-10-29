<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Support\ProductDescription;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class OptimizeProductDescriptions extends Command
{
    protected $signature = 'products:optimize-descriptions {--id=* : Limit to these product IDs} {--write : Save optimized content with a private backup}';

    protected $description = 'Extract embedded product images and normalize Word layouts; preview by default';

    public function handle(): int
    {
        $query = Product::where(fn ($query) => $query->where('description', 'like', '%data:image/%')->orWhere('description', 'like', '%word-paste%'));
        if ($ids = $this->option('id')) {
            $query->whereIn('id', $ids);
        }
        foreach ($query->get() as $product) {
            if (! $this->option('write')) {
                $this->line('Candidate product '.$product->id.' ('.strlen($product->description).' bytes)');

                continue;
            }
            $before = $product->description;
            $after = ProductDescription::optimize($before);
            if ($after === $before) {
                continue;
            }
            $backup = 'description-backups/'.now()->format('Ymd-His').'-'.$product->id.'-'.Str::uuid().'.json';
            if (! Storage::disk('local')->put($backup, json_encode(['id' => $product->id, 'description' => $before, 'updated_at' => $product->getRawOriginal('updated_at')], JSON_THROW_ON_ERROR))) {
                $this->error('Backup failed; product was not changed.');

                return self::FAILURE;
            }
            // Do not trigger publishing hooks or overwrite concurrent admin edits.
            $changed = DB::table('products')->where('id', $product->id)->where('description', $before)
                ->update(['description' => $after]);
            $this->line('Product '.$product->id.': '.($changed ? strlen($before).' -> '.strlen($after).' bytes' : 'skipped (edited concurrently)').'; backup: '.$backup);
        }

        return self::SUCCESS;
    }
}
