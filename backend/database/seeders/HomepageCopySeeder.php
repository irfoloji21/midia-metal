<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HomepageCopySeeder extends Seeder
{
    public function run(): void
    {
        $copy = [
            'home_hero_title' => 'Bespoke commercial kitchen equipment.',
            'home_hero_desc' => 'We manufacture stainless steel kitchen equipment and bespoke metalwork at our London factory. Our team manages site measurements, fabrication and installation, with every component made to your project specifications.',
            'home_hero_phone_label' => 'Call Us',
            'home_hero_quote_label' => 'Request a Quote',
            'home_reward_title' => 'Made to measure',
            'home_reward_desc' => 'Equipment manufactured to your dimensions and layout.',
            'home_discount_title' => 'In-house fabrication',
            'home_discount_desc' => 'Your project is handled by our own fabrication team.',
            'home_shipping_title' => 'Clear project pricing',
            'home_shipping_desc' => 'An initial estimate, with the final price agreed before production.',
            'home_prices_title' => 'Installation services',
            'home_prices_desc' => 'Fabrication and installation coordinated by one team.',
            'home_fabrication_section_label' => 'Welding & Fabrication',
            'home_fabrication_section_title' => 'Metalwork built to specification',
            'home_welding_label' => 'Custom Metalwork',
            'home_welding_title' => 'Stainless steel fabrication & welding',
            'home_welding_desc' => "We manufacture worktops, cupboards, sink units, grills, extraction canopies and ductwork for commercial kitchens. Each item is fabricated to the agreed dimensions, material and finish.",
            'home_welding_primary_cta' => 'Request a Quote',
            'home_welding_secondary_cta' => 'View Fabrication Services',
            'home_welding_card_label' => 'Project Preparation',
            'home_welding_card_title' => 'Confirmed specifications before production',
            'home_welding_card_desc' => 'We verify site measurements and confirm the design, materials and final price with you before fabrication begins.',
            'home_categories_section_label' => 'Product Categories',
            'home_categories_section_title' => 'Equipment, parts & materials',
            'home_catalog_label' => 'Our Range',
            'home_trending_title' => 'Products & spare parts',
            'home_view_more_label' => 'View All Products',
            'home_installation_title' => 'Commercial kitchen installation',
            'home_installation_desc' => 'We install equipment for new kitchens and upgrades to existing premises. Our team coordinates the measurements, fitting requirements and installation schedule for your project.',
            'home_request_quote_label' => 'Request an Installation Quote',
            'home_comfort_title' => 'Equipment, components & spare parts',
            'home_comfort_desc' => 'Explore our range of kitchen equipment, replacement parts and fabrication materials. Bespoke sizes and components are available on request.',
            'home_learn_more_label' => 'Browse Products',
            'meta_title' => 'Midia M Metal | Commercial Kitchen Equipment & Welding',
            'meta_description' => 'Commercial kitchen equipment, stainless steel fabrication, ventilation systems and canopy installation. Our factory is in London.',
        ];

        // Apply only when this seeder is explicitly requested; preserve other settings.
        DB::transaction(function () use ($copy) {
            foreach ($copy as $key => $value) {
                $setting = SiteSetting::firstOrNew(['key' => $key]);
                $setting->value = $value;
                if (! $setting->exists) {
                    $setting->type = str_ends_with($key, '_desc') || $key === 'meta_description' ? 'textarea' : 'text';
                    $setting->group = str_starts_with($key, 'meta_') ? 'seo' : 'home';
                }
                $setting->save();
            }
        });
    }
}
