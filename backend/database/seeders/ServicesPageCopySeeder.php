<?php

namespace Database\Seeders;

use App\Models\Service;
use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ServicesPageCopySeeder extends Seeder
{
    public function run(): void
    {
        $copy = [
            'services_hero_label' => 'Our Services',
            'services_hero_subtitle' => 'Commercial kitchen fabrication & installation.',
            'services_hero_tagline' => 'Stainless steel fabrication, welding and ventilation.',
            'services_hero_desc' => 'Midia M Metal manufactures and installs stainless steel equipment for commercial kitchens. Our services include ventilation systems, extraction canopy installation, wall cladding and bespoke fabrication.',
            'services_phone_label' => 'Call Us',
            'services_quote_label' => 'Request a Quote',
            'services_quality_label' => 'Our Expertise',
            'services_quality_title' => 'Our specialist services.',
            'services_cta_title' => 'Discuss your project with our team.',
            'services_modern_label' => 'Our Approach',
            'services_modern_title' => 'From site survey to installation.',
            'services_modern_desc' => "We review the kitchen layout, measurements and equipment requirements to define the fabrication and installation work. Materials, dimensions and finishes are specified to suit the space and its intended use.\n\nTo request a quotation, share your drawings, measurements or a description of the work required.",
            'services_site_visit_note' => '',
            'services_modern_cta_label' => 'Contact Us',
            'services_feature_1_title' => 'Made to your specification',
            'services_feature_1_desc' => 'We fabricate stainless steel kitchen components to the required dimensions, layout and finish.',
            'services_feature_2_title' => 'Fabrication and installation',
            'services_feature_2_desc' => 'Our team provides workshop fabrication and on-site installation for canopies, ductwork and stainless steel fittings.',
            'services_feature_3_title' => 'Stainless steel wall cladding',
            'services_feature_3_desc' => 'We fabricate and fit wall panels to the dimensions and layout of your kitchen.',
            'services_coverage_desc' => '',
            'services_meta_title' => 'Commercial Kitchen Services | Midia M Metal',
            'services_meta_description' => 'Commercial kitchen fabrication, ventilation systems, canopy installation and stainless steel wall cladding. Our factory is in London.',
        ];

        $services = [
            'ventilation-systems' => [
                'title' => 'Ventilation Systems',
                'excerpt' => 'We design and install commercial kitchen ventilation systems, from site surveys and ductwork planning to fan installation and commissioning.',
            ],
            'canopy-installation' => [
                'title' => 'Canopy Installation',
                'excerpt' => 'We supply and install extraction canopies for commercial kitchens, including system balancing and testing.',
            ],
            'wall-cladding' => [
                'title' => 'Wall Cladding',
                'excerpt' => 'We fabricate and fit stainless steel wall panels to suit the dimensions of your kitchen and the position of your equipment.',
            ],
            'custom-fabrication' => [
                'title' => 'Custom Fabrication',
                'excerpt' => 'We manufacture stainless steel tables, sinks and canopies to specified dimensions, with bespoke fabrication and welding to suit each project.',
            ],
        ];

        // This copy refresh is applied only by explicitly running this seeder.
        DB::transaction(function () use ($copy, $services) {
            // These services are outside the business scope; retain existing records unpublished.
            Service::whereIn('slug', ['air-conditioning', 'maintenance-cleaning'])->update(['active' => false]);

            foreach ($services as $slug => $values) {
                Service::where('slug', $slug)->firstOrFail()->update($values);
            }

            $phone = SiteSetting::where('key', 'contact_phone')->value('value');
            if ($phone) {
                $copy['services_hero_phone'] = $phone;
            }

            foreach ($copy as $key => $value) {
                $setting = SiteSetting::firstOrNew(['key' => $key]);
                $setting->value = $value;
                if (! $setting->exists) {
                    $setting->type = str_ends_with($key, '_desc') || str_ends_with($key, '_description') || str_ends_with($key, '_note') ? 'textarea' : 'text';
                    $setting->group = 'services';
                }
                $setting->save();
            }
        });
    }
}
