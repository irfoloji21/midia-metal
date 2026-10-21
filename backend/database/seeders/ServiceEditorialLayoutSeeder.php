<?php

namespace Database\Seeders;

use App\Models\Service;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ServiceEditorialLayoutSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('This content update is restricted to the local SQLite site.');
        }

        $details = json_decode(file_get_contents(database_path('content/service-editorial-layout.json')), true, 512, JSON_THROW_ON_ERROR);
        $slugs = array_column($details, 'slug');
        $services = Service::whereIn('slug', $slugs)->get()->keyBy('slug');
        if ($services->count() !== count($slugs)) {
            throw new \RuntimeException('An existing service is missing.');
        }

        $backup = 'private/services-before-editorial-layout.json';
        if (! Storage::disk('local')->exists($backup)) {
            Storage::disk('local')->put($backup, $services->values()->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
        $before = collect(json_decode(Storage::disk('local')->get($backup), true, 512, JSON_THROW_ON_ERROR))->keyBy('slug');

        DB::transaction(function () use ($details, $services, $before) {
            foreach ($details as $detail) {
                $html = '';
                foreach ($detail['sections'] as $index => $section) {
                    $image = '/images/services/installed-kitchens/'.$section['image'].'.webp';
                    if (! is_file(public_path(ltrim($image, '/')))) {
                        throw new \RuntimeException('Service image is missing: '.$image);
                    }
                    $class = 'service-section'.($index % 2 ? ' service-section--image-left' : '');
                    $html .= '<div class="'.$class.'"><div class="service-copy">';
                    $html .= '<div class="service-eyebrow">'.e($section['eyebrow']).'</div>';
                    $html .= '<h2>'.e($section['heading']).'</h2>';
                    foreach ($section['paragraphs'] as $paragraph) {
                        $html .= '<p>'.e($paragraph).'</p>';
                    }
                    $html .= '</div><div class="service-media"><img src="'.$image.'" alt="'.e($section['alt']).'" /></div></div>';
                }
                $content = HtmlSanitizer::richText($html);
                $image = '/images/services/installed-kitchens/'.$detail['sections'][0]['image'].'.webp';
                $service = $services[$detail['slug']];
                // Refuse to overwrite later edits if this one-time import is run again.
                if (! in_array($service->content, [$before[$service->slug]['content'], $content], true)
                    || ! in_array($service->image, [$before[$service->slug]['image'], $image], true)) {
                    throw new \RuntimeException('Service has newer edits: '.$service->slug);
                }
                $service->update(['content' => $content, 'image' => $image]);
            }
        });

        $this->command?->info('Updated four local service layouts. Titles, excerpts, features and publication status preserved.');
    }
}
