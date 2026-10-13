<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\SiteSetting;
use App\Support\HtmlSanitizer;
use Illuminate\Database\Seeder;

class ReplacementMetalPartsBlogSeeder extends Seeder
{
    public function run(): void
    {
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
<p>One damaged part can leave a perfectly usable item out of action. A cupboard door loses its bracket, an equipment leg bends, or a metal cover goes missing. You look for a replacement, but the size is wrong or the original is no longer available.</p>
<p>At Midia M Metal, we supply replacement parts and make custom metal components where a suitable part can be fabricated. A few photos and some measurements are usually enough to start the conversation.</p>
<h2>Which metal parts can be made to fit?</h2>
<p>We can look at making brackets, supports, legs, frames, covers, panels and connecting pieces for existing equipment and metalwork.</p>
<p>That might be a bracket with an unusual hole spacing, a replacement panel for a cupboard, or a support made to fit the space beneath a worktop. These jobs come up in commercial kitchens, workshops and other settings where standard parts don’t quite fit.</p>
<p>We mainly work with stainless steel, although the material depends on where the part is used and what it needs to do.</p>
<p>Before agreeing to make anything, we need to understand the whole job. The shape of a part tells us something; seeing how it fits and what it supports tells us much more.</p>
<h2>Keep the old part, even if it is damaged</h2>
<p>If you still have the original, hold on to it. It can help us understand the shape, fixing points, thickness and relationship with the surrounding equipment.</p>
<p>A broken piece may still give us useful information. If it has separated into several pieces, keep those together.</p>
<p>However, a damaged part does not always give us the correct finished dimensions. A bent bracket may have pulled out of shape, and a worn fixing hole may be larger than it originally was. We may also need measurements from the equipment itself to work out how the replacement should fit.</p>
<p>Send a clear photo of the old part alongside a photo of where it belongs.</p>
<h2>What if the original part is missing?</h2>
<p>We can still discuss the job.</p>
<p>Start with photos of the area where the part fits. Include the fixing points and enough of the surrounding equipment for us to understand its purpose.</p>
<p>Useful information includes:</p>
<ul>
<li>The space available for the replacement.</li>
<li>The distance between fixing points.</li>
<li>The dimensions of any matching part that remains.</li>
<li>What the component supports, covers or connects.</li>
<li>Whether it needs to be removable or adjustable.</li>
<li>Any model details or older photographs you have.</li>
</ul>
<p>If the item has a matching bracket or leg on the other side, photograph that too. It may help us understand what is missing, although we’ll still need to check whether both sides are the same.</p>
<p>You don’t need to know the technical name. “The bracket underneath this shelf” and a clear photograph give us somewhere to start.</p>
<h2>A replacement needs to do the job properly</h2>
<p>A part can look similar and still be unsuitable.</p>
<p>Fixing holes need to line up. A cover needs enough clearance to fit over what is underneath it. A support needs to suit the load and the way the equipment is used.</p>
<p>We’ll ask about those details before deciding on the material and construction. Tell us if the item is moved regularly, used outdoors, exposed to water or cleaned frequently. Also mention any changes you’ve made to the original equipment.</p>
<p>If the old part failed, explain what happened. Knowing whether it was damaged by an impact, worn through use or affected by movement helps us understand what needs attention.</p>
<h2>Replacement legs and castors</h2>
<p>We also supply equipment legs and castors—the wheels and fittings used to move an item.</p>
<p>When replacing one, the wheel diameter is only part of the information needed. We also need to understand how it attaches, the overall fitted height and the equipment it will carry.</p>
<p>A replacement that changes the height can leave a unit uneven. A fixing that looks close in a photograph may have a different thread or mounting pattern.</p>
<p>Photograph the complete leg or castor, its attachment and any markings. Let us know whether it needs a brake and how the equipment is used.</p>
<p>Where a ready-made replacement is suitable, we can discuss that option. If a metal mounting piece or support needs to be made to fit, we can assess that separately.</p>
<h2>Can the existing part be repaired instead?</h2>
<p>Sometimes a repair or alteration is worth considering. In other cases, making a replacement is the more practical choice.</p>
<p>That depends on the material, condition, location of the damage and purpose of the part. We need to see more than a close-up of the broken area before advising.</p>
<p>Send one photograph of the damage and another showing the whole item. If there has been movement, distortion or an earlier repair, mention it.</p>
<p>We’ll talk through the options once we understand what the part needs to do.</p>
<h2>What affects the price of a custom replacement?</h2>
<p>The price depends on the material, dimensions, shape and work involved. Fixing holes, bends, welded joints and finishing all contribute to the job.</p>
<p>The time needed to establish the correct measurements matters too. A straightforward part with clear dimensions is a different job from a damaged component whose original shape needs to be worked out.</p>
<p>If you need several identical pieces, tell us at the start so we can quote for the quantity together.</p>
<p>We prepare an initial estimate from the information you provide, then confirm the details and final price before production. Preparing a quote is free.</p>
<h2>How to get the job moving</h2>
<p>Send us what you have, even if the information is incomplete:</p>
<ul>
<li>Photos of the part and where it fits.</li>
<li>Approximate measurements.</li>
<li>A description of what it does.</li>
<li>The quantity you need.</li>
<li>Your postcode.</li>
<li>Any date you are working towards.</li>
</ul>
<p>We’ll let you know what else is needed. Depending on the job, that may mean further measurements, seeing the original part or arranging a visit.</p>
<p>Once the specification is agreed, we’ll confirm the estimated production and delivery timing with you.</p>
<h3>Need a replacement metal part?</h3>
<p>Send us a photo of the part and where it belongs. We’ll take a look and discuss whether a supplied replacement, repair or custom-made piece could suit the job.</p>
<p><a href="https://wa.me/{{whatsapp}}">Message us on WhatsApp</a> · <a href="tel:{{phone}}">Call us</a> · <a href="/get-a-quote">Request a quote</a></p>
HTML;
        $content = str_replace(['{{whatsapp}}', '{{phone}}'], [ltrim($phone, '+'), $phone], $content);

        // Explicit publication only; retain subsequent edits and all other articles.
        $post = BlogPost::firstOrCreate(['slug' => 'custom-replacement-metal-parts'], [
            'title' => 'Can’t Find a Replacement Metal Part? Here’s Where to Start',
            'excerpt' => 'Can’t find a replacement bracket, leg or metal fitting? Midia M Metal can assess your existing part and discuss a suitable replacement made to fit.',
            'content' => HtmlSanitizer::richText($content),
            'image' => '/images/blog/custom-replacement-metal-parts-v2.webp',
            'author' => 'Midia M Metal',
            'category' => 'Bespoke Metalwork',
            'active' => true,
            'published_at' => now(),
        ]);
        $this->command?->info('Published article ID: '.$post->id);
    }
}
