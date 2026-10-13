<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\SiteSetting;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BespokeMetalFabricationBlogSeeder extends Seeder
{
    public function run(): void
    {
        // Run explicitly when publishing this approved article, not during routine seeding.
        $slug = 'bespoke-metal-fabrication';
        $backup = 'private/blog-before-bespoke-metal-fabrication.json';
        if (! Storage::disk('local')->exists($backup)) {
            Storage::disk('local')->put($backup, BlogPost::orderBy('id')->get()->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        $phone = preg_replace('/[^0-9+]/', '', (string) SiteSetting::where('key', 'contact_phone')->value('value'));
        if (str_starts_with($phone, '0')) {
            $phone = '+44'.substr($phone, 1);
        } elseif (str_starts_with($phone, '44')) {
            $phone = '+'.$phone;
        }
        if (! $phone) {
            throw new \RuntimeException('Set the contact phone number before publishing the article.');
        }

        $content = <<<'HTML'
<p>Sometimes the piece you need simply isn’t available off the shelf. A cupboard is too wide for the space. A frame needs to fit around existing equipment. A replacement bracket looks right, but the fixing holes are in the wrong place.</p>
<p>These are the sorts of jobs we make to measure at Midia M Metal. We’re based in London, with our own team making commercial kitchen equipment and custom metalwork for jobs inside and outside the kitchen.</p>
<p>You don’t need to arrive with a finished design. Start by telling us what the piece needs to do, where it will go and what isn’t working with the options you’ve found.</p>
<h2>What can we make to measure?</h2>
<p>Much of our work is for commercial kitchens: stainless steel worktops, cupboards, sinks, shelving, large grills, extraction canopies and air ventilation ductwork.</p>
<p>A kitchen might need a worktop with three sinks and storage underneath. Another might need a narrow cupboard beside an existing appliance, or ductwork made to suit the route available in the building. The measurements and layout depend on the job.</p>
<p>Our work also goes beyond kitchens. We make items such as:</p>
<ul>
<li>Metal frames, shelving and equipment stands.</li>
<li>Table legs and supports.</li>
<li>Gates and railings.</li>
<li>Sheet metal boxes, covers and enclosures.</li>
<li>Brackets, fittings and connecting pieces.</li>
<li>Replacement metal parts for existing equipment.</li>
</ul>
<p>We also supply replacement legs and castors. Where a suitable ready-made part isn’t available, we can look at making the metal component needed to fit the equipment.</p>
<p>That list is a starting point. If your job involves metal fabrication or welding and you’re unsure what to call it, send us a photo or explain what you need.</p>
<h2>The fit is about more than the overall size</h2>
<p>Length, width and height matter, but they rarely tell us everything.</p>
<p>For a bracket, we need to understand where it attaches and what it supports. For a cupboard, we need to know how the doors will open and whether pipework takes up space inside. For a metal frame, we need to understand what sits on it and how it will be used.</p>
<p>It also helps to see the surrounding area. A piece can fit its intended position but still be difficult to get through the doorway or past the equipment already installed.</p>
<p>These details are easier to sort out before fabrication begins. Photos of the space, fixing points and nearby equipment help us ask the right questions.</p>
<h2>Which metal should you use?</h2>
<p>We mainly work with stainless steel, but we use other metals where they suit the job.</p>
<p>The choice depends on where the piece will be used, what it needs to carry, how it will be cleaned and the finish you want. An indoor shelf, an outdoor gate and a kitchen sink unit have different requirements.</p>
<p>If you already have a material in mind, tell us. If you’re unsure, explain the use and we’ll discuss a suitable option with you. The material and construction need to suit the work the finished piece will actually do.</p>
<h2>Do you need a technical drawing?</h2>
<p>You can start with a rough sketch, photographs or an existing part.</p>
<p>A sketch is useful for showing the shape and approximate dimensions. Photos help us understand the space and the parts your new piece needs to fit around. If you’re replacing something, the original component can help us see its fixing points and how it was used.</p>
<p>For a new item, tell us what you want it to do. Perhaps you need storage under a worktop, a removable cover or a frame that can be moved for cleaning. Those requirements help us work out the details with you.</p>
<p>We’ll agree the necessary dimensions and design before starting production.</p>
<h2>How do we work out the price?</h2>
<p>We can prepare an initial estimate from your description, approximate measurements and requirements. Preparing a quote is free.</p>
<p>Size is one part of the price. Material, layout, the amount of fabrication and welding, and any delivery or installation work also affect the cost.</p>
<p>For example, two worktops of the same length may need different amounts of work. One might have cupboards underneath throughout. Another might include several sinks and a different storage layout. The total length alone won’t give an accurate comparison.</p>
<p>Once the initial estimate is acceptable, we can arrange the next steps, including a site visit where needed. Site measurement is usually free, although this depends on the location; we’ll confirm any charge beforehand.</p>
<p>The final price can change when the exact measurements and details are agreed. We present that price and the specification for your approval before production starts.</p>
<h2>Can existing metalwork be altered or repaired?</h2>
<p>Sometimes the piece you already have can be adapted.</p>
<p>You may need a different bracket, an altered frame, a replacement leg or a change to an existing unit. In other cases, damaged metalwork may be worth repairing.</p>
<p>We need to see the condition and understand how the item is used before advising. A close-up of the problem helps, but send a wider photo as well so we can see the whole item and its surroundings.</p>
<p>We’ll discuss whether an alteration, repair or new piece makes sense for the job.</p>
<h2>Delivery, installation and timing</h2>
<p>We can arrange shipping where the size, weight and destination allow.</p>
<p>For installation, repairs and other work that requires a visit, we consider jobs across the UK from our London base. Availability depends on the location and scope of the work, so include your postcode when you enquire.</p>
<p>Production and delivery times depend on the job and our workload. Once the order is agreed, we’ll give you an estimated schedule. We’ll also confirm the warranty period for the agreed materials and workmanship.</p>
<h2>What should you send us to get started?</h2>
<p>You don’t need to have every detail settled. The following gives us a useful starting point:</p>
<ul>
<li>A short description of what you need.</li>
<li>Approximate dimensions.</li>
<li>Photos of the space or existing item.</li>
<li>Any sketch, drawing or example you have.</li>
<li>Your postcode.</li>
<li>Whether you need delivery, installation or a repair visit.</li>
</ul>
<p>If there’s a particular date you’re working towards, include that too.</p>
<hr>
<h3>Have a metalwork job in mind?</h3>
<p>Send us a few photos and tell us what the piece needs to do. We’ll talk through the measurements, material and next steps with you.</p>
<p><a href="https://wa.me/{{whatsapp}}">Message us on WhatsApp</a> · <a href="tel:{{phone}}">Call us</a> · <a href="/get-a-quote">Request a quote</a></p>
HTML;
        $content = str_replace(['{{whatsapp}}', '{{phone}}'], [ltrim($phone, '+'), $phone], $content);

        DB::transaction(function () use ($slug, $content) {
            BlogPost::where('slug', '!=', $slug)->update(['active' => false]);
            // Keep subsequent admin edits intact if this publishing script is rerun.
            $post = BlogPost::firstOrCreate(['slug' => $slug], [
                'title' => 'Bespoke Metal Fabrication: What Can We Make for Your Project?',
                'image' => '/images/blog/bespoke-metal-fabrication-workshop.webp',
                'excerpt' => 'Need metalwork made to fit? We make kitchen equipment, frames, shelves, brackets and replacement parts. Tell our London team what you have in mind.',
                'content' => HtmlSanitizer::richText($content),
                'author' => 'Midia M Metal',
                'category' => 'Bespoke Metalwork',
                'active' => true,
                'published_at' => now(),
            ]);
            $this->command?->info('Published article ID: '.$post->id.'; active posts: '.BlogPost::where('active', true)->count());
        });
    }
}
