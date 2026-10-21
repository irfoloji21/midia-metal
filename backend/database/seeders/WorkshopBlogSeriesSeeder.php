<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorkshopBlogSeriesSeeder extends Seeder
{
    public function run(): void
    {
        $posts = json_decode(file_get_contents(database_path('content/blog-series.json')), true, 512, JSON_THROW_ON_ERROR);

        foreach ($posts as $post) {
            if (! is_file(base_path('../public'.($post['image'] ?? '/images/blog/'.$post['slug'].'.webp')))) {
                throw new \RuntimeException('Missing cover for '.$post['slug']);
            }
        }

        // Explicit publication only. Preserve existing posts and later admin edits.
        DB::transaction(function () use ($posts) {
            $created = 0;
            foreach ($posts as $entry) {
                $post = BlogPost::firstOrCreate(['slug' => $entry['slug']], [
                    'title' => $entry['title'],
                    'excerpt' => $entry['excerpt'],
                    'content' => HtmlSanitizer::richText($entry['content']),
                    'image' => $entry['image'] ?? '/images/blog/'.$entry['slug'].'.webp',
                    'author' => 'Midia M Metal',
                    'category' => $entry['category'],
                    'active' => true,
                    'published_at' => now(),
                ]);
                $created += (int) $post->wasRecentlyCreated;
            }
            $this->command?->info('Created '.$created.' articles. Active total: '.BlogPost::where('active', true)->count());
        });
    }
}
