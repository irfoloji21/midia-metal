<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $product = DB::table('products')->where('slug', 'centrifugal-fan-d-7-J3VG')->first();
        if (! $product) {
            return;
        }
        $description = $product->description ?? '';
        $path = preg_quote('/documents/longwell-lwdd7-5-ec-datasheet.pdf', '#');
        $description = preg_replace('#<tr>\s*<th>Product data download</th><td>.*?</td>\s*</tr>#s', '', $description);
        $description = preg_replace('#<a\b[^>]*href=["\']'.$path.'["\'][^>]*>.*?</a>#s', '', $description);
        $description = str_replace(
            ['Download the three-page product data summary for the specification table, dimension drawing and all nine performance points. ', ' The PDF is a Midia M Metal reference summary of the published data, not an installation manual.'],
            '',
            $description,
        );
        DB::table('products')->where('id', $product->id)->update(['description' => $description, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Do not reinsert obsolete static links into an admin-edited description.
    }
};
