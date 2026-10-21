<?php

namespace Database\Seeders;

use App\Models\PortfolioCategory;
use App\Models\PortfolioProject;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ApprovedKitchenPortfolioSeeder extends Seeder
{
    public function run(): void
    {
        // This explicit import is for the user's running local site.
        // It is deliberately not registered in DatabaseSeeder or a deploy hook.
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('This approved selection must be imported into the local SQLite site.');
        }

        $entries = json_decode(
            file_get_contents(database_path('content/approved-kitchen-portfolio.json')),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        foreach ($entries as $entry) {
            PortfolioCategory::where('slug', $entry['category_slug'])->firstOrFail();
            foreach ([$entry['image'], ...$entry['gallery']] as $image) {
                if (! is_file(public_path(ltrim($image, '/')))) {
                    throw new \RuntimeException('Missing approved image: '.$image);
                }
            }
        }

        DB::transaction(function () use ($entries) {
            $before = PortfolioProject::orderBy('id')->get()->keyBy('id');
            $backup = 'private/portfolio-before-approved-kitchens.json';
            if (! Storage::disk('local')->exists($backup)) {
                Storage::disk('local')->put(
                    $backup,
                    $before->values()->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
                );
            }

            $firstOrder = ((int) PortfolioProject::min('order')) - count($entries);
            foreach ($entries as $index => $entry) {
                $category = PortfolioCategory::where('slug', $entry['category_slug'])->firstOrFail();
                // Preserve subsequent admin edits and avoid duplicates on a rerun.
                $project = PortfolioProject::firstOrCreate(['slug' => $entry['slug']], [
                    'title' => $entry['title'],
                    'image' => $entry['image'],
                    'description' => $entry['description'],
                    'location' => null,
                    'client' => null,
                    'customer_number' => null,
                    'year' => null,
                    'portfolio_category_id' => $category->id,
                    'services_list' => $entry['services_list'],
                    'gallery' => $entry['gallery'],
                    'active' => true,
                    'order' => $firstOrder + $index,
                ]);
                $this->command?->info(
                    ($project->wasRecentlyCreated ? 'Created' : 'Preserved existing').
                    ' project '.$project->id.': '.$project->slug
                );
            }

            foreach ($before as $id => $project) {
                if (PortfolioProject::findOrFail($id)->getAttributes() !== $project->getAttributes()) {
                    throw new \RuntimeException('An existing project changed during import: '.$id);
                }
            }
        });
    }
}
