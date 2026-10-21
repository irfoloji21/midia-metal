<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;

class ReplacementMetalPartsBlogSeeder extends Seeder
{
    public function run(): void
    {
        $slug = 'custom-replacement-metal-parts';
        $entry = collect(json_decode(file_get_contents(database_path('content/blog-series.json')), true, 512, JSON_THROW_ON_ERROR))
            ->firstWhere('slug', $slug);
        if (! $entry) {
            throw new \RuntimeException('Missing article copy for '.$slug);
        }

        // Explicit publication only; retain subsequent edits and all other articles.
        $post = BlogPost::firstOrCreate(['slug' => $slug], [
            'title' => $entry['title'],
            'excerpt' => $entry['excerpt'],
            'content' => HtmlSanitizer::richText($entry['content']),
            'image' => $entry['image'],
            'author' => 'Midia M Metal',
            'category' => $entry['category'],
            'active' => true,
            'published_at' => now(),
        ]);
        $this->command?->info('Published article ID: '.$post->id);
    }
}
