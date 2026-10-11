<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('site_settings')) {
            return;
        }

        $oldSetting = DB::table('site_settings')->where('key', 'social_dribbble')->first();
        $tiktokExists = DB::table('site_settings')->where('key', 'social_tiktok')->exists();

        if ($oldSetting && ! $tiktokExists) {
            DB::table('site_settings')
                ->where('key', 'social_dribbble')
                ->update([
                    'key' => 'social_tiktok',
                    'updated_at' => now(),
                ]);

            return;
        }

        if ($oldSetting && $tiktokExists) {
            $tiktokSetting = DB::table('site_settings')->where('key', 'social_tiktok')->first();
            if (in_array(trim((string) $tiktokSetting->value), ['', '#'], true)
                && ! in_array(trim((string) $oldSetting->value), ['', '#'], true)) {
                DB::table('site_settings')
                    ->where('key', 'social_tiktok')
                    ->update([
                        'value' => $oldSetting->value,
                        'updated_at' => now(),
                    ]);
            }

            DB::table('site_settings')->where('key', 'social_dribbble')->delete();
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('site_settings')) {
            return;
        }

        $tiktokExists = DB::table('site_settings')->where('key', 'social_tiktok')->exists();
        $dribbbleExists = DB::table('site_settings')->where('key', 'social_dribbble')->exists();

        if ($tiktokExists && ! $dribbbleExists) {
            DB::table('site_settings')
                ->where('key', 'social_tiktok')
                ->update([
                    'key' => 'social_dribbble',
                    'updated_at' => now(),
                ]);
        }
    }
};
