<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use Illuminate\Database\Seeder;

class BespokeMetalFabricationCoverSeeder extends Seeder
{
    public function run(): void
    {
        $post = BlogPost::where('slug', 'bespoke-metal-fabrication')->firstOrFail();
        $post->update(['image' => '/images/blog/bespoke-metal-fabrication-workshop.webp']);
        $this->command?->info('Updated cover image for article '.$post->id);
    }
}
