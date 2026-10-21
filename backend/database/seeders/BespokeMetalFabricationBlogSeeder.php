<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BespokeMetalFabricationBlogSeeder extends Seeder
{
    public function run(): void
    {
        // Explicit publication only; article copy is shared with the editorial refresh.
        $slug = 'bespoke-metal-fabrication';
        $entry = collect(json_decode(file_get_contents(database_path('content/blog-series.json')), true, 512, JSON_THROW_ON_ERROR))
            ->firstWhere('slug', $slug);
        if (! $entry) {
            throw new \RuntimeException('Missing article copy for '.$slug);
        }

        $backup = 'private/blog-before-bespoke-metal-fabrication.json';
        if (! Storage::disk('local')->exists($backup)) {
            Storage::disk('local')->put($backup, BlogPost::orderBy('id')->get()->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        DB::transaction(function () use ($slug, $entry) {
            BlogPost::where('slug', '!=', $slug)->update(['active' => false]);
            // Keep subsequent admin edits intact if this publishing script is rerun.
            $post = BlogPost::firstOrCreate(['slug' => $slug], [
                'title' => $entry['title'],
                'image' => $entry['image'],
                'excerpt' => $entry['excerpt'],
                'content' => HtmlSanitizer::richText($entry['content']),
                'author' => 'Midia M Metal',
                'category' => $entry['category'],
                'active' => true,
                'published_at' => now(),
            ]);
            $this->command?->info('Published article ID: '.$post->id.'; active posts: '.BlogPost::where('active', true)->count());
        });
    }
}
