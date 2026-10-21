<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BlogEditorialRefreshSeeder extends Seeder
{
    public function run(): void
    {
        // Run explicitly to apply the editorial revision to existing articles.
        $entries = json_decode(file_get_contents(database_path('content/blog-series.json')), true, 512, JSON_THROW_ON_ERROR);
        $withdrawnSlugs = [
            'bespoke-metal-gates-railings',
            'custom-sheet-metal-boxes-covers-enclosures',
        ];

        DB::transaction(function () use ($entries, $withdrawnSlugs) {
            $posts = BlogPost::whereIn('slug', array_merge(array_column($entries, 'slug'), $withdrawnSlugs))
                ->get()->keyBy('slug');

            foreach ($entries as $entry) {
                if (! $posts->has($entry['slug'])) {
                    throw new \RuntimeException('Article must already exist: '.$entry['slug']);
                }
            }

            $backup = 'private/blog-editorial-refresh-before-'.now()->format('Ymd-His-u').'.json';
            if (! Storage::disk('local')->put($backup, $posts->values()->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                throw new \RuntimeException('Could not back up articles before editing.');
            }

            foreach ($entries as $entry) {
                $posts[$entry['slug']]->update([
                    'title' => $entry['title'],
                    'excerpt' => $entry['excerpt'],
                    'content' => HtmlSanitizer::richText($entry['content']),
                    'category' => $entry['category'],
                ]);
            }

            // Retain the original records, but do not advertise products outside the current range.
            BlogPost::whereIn('slug', $withdrawnSlugs)->where('active', true)->update(['active' => false]);

            $this->command?->info('Updated '.count($entries).' articles. Backup: '.$backup);
        });
    }
}
