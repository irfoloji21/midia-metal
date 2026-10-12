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
            'home_hero_title' => 'Commercial kitchen equipment, made to measure.',
            'home_hero_desc' => 'From a single sink unit to a full kitchen fit-out, we make the metalwork your kitchen needs. At Midia M Metal, our own team handles the measurements, fabrication and installation. We’re based in London and take on projects across the UK, depending on the work involved.',
            'home_hero_phone_label' => 'Call Us',
            'home_hero_whatsapp_label' => 'WhatsApp Us',
            'home_hero_quote_label' => 'Request a Quote',
            'home_reward_title' => 'Made to your measurements',
            'home_reward_desc' => 'Worktops, cupboards, sinks and metalwork built to fit your space.',
            'home_discount_title' => 'Made by our own team',
            'home_discount_desc' => 'The people making your equipment understand the job from the start.',
            'home_shipping_title' => 'Straightforward pricing',
            'home_shipping_desc' => 'A free initial estimate, with the final price agreed before production.',
            'home_prices_title' => 'Fabrication and fitting',
            'home_prices_desc' => 'We make the equipment and arrange installation to suit your project.',
            'home_fabrication_section_label' => 'Welding & Fabrication',
            'home_fabrication_section_title' => 'Tell us what you need made.',
            'home_welding_label' => 'Custom Metalwork',
            'home_welding_title' => 'Worktops, sink units, canopies — and the jobs in between.',
            'home_welding_desc' => "We make cupboards, worktops, sinks, large grills, canopies, ductwork and air ventilation systems to the measurements your job needs. Most of our work is in stainless steel, but we use other metals where they suit the job.\n\nNeed a repair, an alteration or a product or service you don’t see here? Give us a call. We’ll work through the material, dimensions and details with you.",
            'home_welding_primary_cta' => 'Request a Quote',
            'home_welding_secondary_cta' => 'Our Welding Services',
            'home_welding_card_label' => 'Before We Start',
            'home_welding_card_title' => 'The details agreed. The measurements checked.',
            'home_welding_card_desc' => 'We take measurements on site and confirm the design, material and final price with you before production begins.',
            'home_categories_section_label' => 'Browse the Shop',
            'home_categories_section_title' => 'Equipment, parts & materials',
            'home_catalog_label' => 'From Our Range',
            'home_trending_title' => 'Products & spare parts',
            'home_view_more_label' => 'View All Products',
            'home_installation_title' => 'A new kitchen or a change to the one you have?',
            'home_installation_desc' => 'We handle installation as well as fabrication. Tell us what needs fitting and where the job is. We’ll discuss the work, arrange a site visit where needed and give you a quote.',
            'home_request_quote_label' => 'Discuss Your Installation',
            'home_comfort_title' => 'Looking for a part or a particular size?',
            'home_comfort_desc' => 'Browse our equipment, spare parts and materials. If you can’t find what you need, call us. The shop shows only part of what we make.',
            'home_learn_more_label' => 'Browse the Shop',
            'meta_title' => 'Midia M Metal | Commercial Kitchen Equipment & Welding',
            'meta_description' => 'Made-to-measure commercial kitchen equipment, installation and welding from our London-based team. Worktops, sinks, canopies, extraction systems and spare parts.',
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
