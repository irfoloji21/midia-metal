<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WebsiteCopyRefreshSeeder extends Seeder
{
    public function run(): void
    {
        // Explicit content refresh: preserve contact details and unrelated page content.
        DB::transaction(function () {
            $this->call(HomepageCopySeeder::class);

            // Replace legacy cooling imagery without overwriting later image selections.
            foreach ([
                'home_comfort_image' => '/images/products/prep-table.webp',
                'home_gallery_2' => '/images/products/sink-unit.webp',
            ] as $key => $image) {
                SiteSetting::where('key', $key)->where('value', '/images/air-conditioner.jpg')
                    ->update(['value' => $image]);
            }

            $copy = [
                'contact_welcome' => 'Contact Midia M Metal for enquiries about commercial kitchen equipment, fabrication and installation.',
                'contact_form_error_message' => 'Your enquiry could not be sent. Please try again or contact us by phone or email.',
                'contact_meta_description' => 'Contact Midia M Metal for kitchen equipment, bespoke fabrication, ventilation systems, canopies and wall cladding. Our factory is in London.',
                'footer_info_cookies' => 'Cookie Policy',
                'services_coverage_desc' => '',
            ];

            foreach ($copy as $key => $value) {
                $setting = SiteSetting::firstOrNew(['key' => $key]);
                $setting->value = $value;
                if (! $setting->exists) {
                    $setting->type = 'textarea';
                    $setting->group = explode('_', $key, 2)[0];
                }
                $setting->save();
            }

            SiteSetting::whereIn('key', [
                'home_hero_whatsapp_label',
                'about_whatsapp_label',
                'services_whatsapp_label',
                'contact_whatsapp_label',
            ])->delete();

            // Existing articles store their contact links as HTML rather than page buttons.
            foreach (BlogPost::where('content', 'like', '%https://wa.me/%')->get() as $post) {
                $content = preg_replace(
                    '~<a\s+href="https://wa\.me/[^"]*"[^>]*>.*?</a>(?:\s*·\s*)?~isu',
                    '',
                    $post->content,
                );
                if ($content !== null && $content !== $post->content) {
                    $post->update(['content' => $content]);
                }
            }
        });
    }
}
