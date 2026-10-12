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
            'services_hero_subtitle' => 'Commercial kitchen fabrication, installation & welding.',
            'services_hero_tagline' => 'From one replacement unit to a full kitchen fit-out.',
            'services_hero_desc' => 'We make and fit worktops, cupboards, sinks, grills, canopies and ventilation systems. Our own team works through the measurements, materials and installation with you. We also take on custom metalwork, alterations and repairs outside the kitchen.',
            'services_phone_label' => 'Call Us',
            'services_whatsapp_label' => 'WhatsApp Us',
            'services_quote_label' => 'Request a Quote',
            'services_quality_label' => 'What We Do',
            'services_quality_title' => 'What does your kitchen need?',
            'services_cta_title' => 'Need something made, fitted or repaired?',
            'services_modern_label' => 'How We Work',
            'services_modern_title' => 'Start with a call and your approximate measurements.',
            'services_modern_desc' => "Tell us what you need and we’ll give you a free initial estimate. If that works for you, we’ll arrange a site visit where needed and check the measurements.\n\nWe then agree the design, materials and final price with you. Production starts once you’ve approved the details, and we’ll let you know the expected production and delivery times.",
            'services_site_visit_note' => 'Site measurements are usually free. This depends on the location, so please check with us when arranging your visit.',
            'services_modern_cta_label' => 'Discuss Your Job',
            'services_feature_1_title' => 'Made to fit your space',
            'services_feature_1_desc' => 'We work through the dimensions and material with you, so the finished piece suits both the space and the job it needs to do.',
            'services_feature_2_title' => 'Made and fitted by our team',
            'services_feature_2_desc' => 'Our team handles fabrication and installation. The warranty period is agreed with you as part of the project details.',
            'services_feature_3_title' => 'Help with existing equipment',
            'services_feature_3_desc' => 'You don’t always need a complete replacement. Call us about repairs, alterations or spare parts and we’ll discuss what can be done.',
            'services_coverage_desc' => 'We’re based in London and consider installation, repair and maintenance jobs across the UK, depending on the location and size of the job. Call us with your postcode and a description of the work.',
            'services_meta_title' => 'Commercial Kitchen Fabrication & Installation | Midia M Metal',
            'services_meta_description' => 'Custom kitchen equipment, ventilation, canopy installation and welding from our London-based team. Call us about fabrication, fitting, repairs or maintenance.',
        ];

        $services = [
            'ventilation-systems' => [
                'title' => 'Ventilation & Extraction',
                'excerpt' => 'We make and install ductwork and air ventilation systems to suit your kitchen and its layout. We can also alter existing metalwork when equipment is moved or the kitchen changes.',
            ],
            'canopy-installation' => [
                'title' => 'Canopy Fabrication & Installation',
                'excerpt' => 'We make extraction canopies to the dimensions your cooking area needs and fit them on site. We agree the measurements, material and installation details with you before starting.',
            ],
            'wall-cladding' => [
                'title' => 'Stainless Steel Wall Cladding',
                'excerpt' => 'We cut and fit stainless steel wall panels around your kitchen’s layout and equipment. Whether you need one section covered or a larger area finished, we measure it to fit.',
            ],
            'custom-fabrication' => [
                'title' => 'Custom Fabrication & Welding',
                'excerpt' => 'Worktops with cupboards underneath, sink units, large grills and metalwork made to your drawings or measurements. If the item you need isn’t listed, call us and tell us what you have in mind.',
            ],
            'maintenance-cleaning' => [
                'title' => 'Repairs & Maintenance',
                'excerpt' => 'We repair damaged metalwork, replace worn parts and make alterations to existing equipment. Tell us what needs attention so we can discuss the repair and whether a site visit is needed.',
            ],
            'air-conditioning' => [
                'title' => 'Air Conditioning',
                'excerpt' => 'Tell us about your premises, how the space is used and any system already in place. We’ll discuss what you need and the work involved.',
            ],
        ];

        // This copy refresh is applied only by explicitly running this seeder.
        DB::transaction(function () use ($copy, $services) {
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
