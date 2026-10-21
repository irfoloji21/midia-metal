<?php

namespace Database\Seeders;

use App\Models\PortfolioProject;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class HidePreviousPortfolioProjectsSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('This change is restricted to the local SQLite site.');
        }

        $approved = array_column(json_decode(
            file_get_contents(database_path('content/approved-kitchen-portfolio.json')),
            true,
            512,
            JSON_THROW_ON_ERROR
        ), 'slug');

        // Explicit old records only; later additions must not be hidden on a rerun.
        $previous = [
            'commercial-kitchen-ventilation',
            'stainless-steel-wall-cladding',
            'industrial-canopy-installation',
            'custom-welding-project',
            'exhaust-fan-system',
            'workshop-fit-out',
            'baffle-filter-installation',
            'control-panel-setup',
        ];

        DB::transaction(function () use ($approved, $previous) {
            if (PortfolioProject::whereIn('slug', $approved)->where('active', true)->count() !== 3) {
                throw new \RuntimeException('All three approved projects must remain active.');
            }

            $before = PortfolioProject::orderBy('id')->get();
            $backup = 'private/portfolio-before-hiding-previous-projects.json';
            if (! Storage::disk('local')->exists($backup)) {
                Storage::disk('local')->put(
                    $backup,
                    $before->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
                );
            }

            $changed = PortfolioProject::whereIn('slug', $previous)
                ->where('active', true)->update(['active' => false]);

            if (PortfolioProject::count() !== $before->count()) {
                throw new \RuntimeException('Project records must not be removed.');
            }
            if (PortfolioProject::whereIn('slug', $previous)->where('active', true)->exists()) {
                throw new \RuntimeException('A previous project is still public.');
            }

            $this->command?->info(
                'Deactivated '.$changed.' previous projects; '.
                PortfolioProject::where('active', true)->count().' projects remain public.'
            );
        });
    }
}
