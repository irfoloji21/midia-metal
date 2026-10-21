<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AboutPageCopySeeder extends Seeder
{
    public function run(): void
    {
        $copy = [
            'about_who_label' => 'About Midia M Metal',
            'about_title' => 'Stainless steel fabrication for commercial kitchens.',
            'about_content_1' => 'Midia M Metal manufactures and supplies stainless steel equipment for commercial kitchens. Our factory is in London.',
            'about_content_2' => 'Our in-house team carries out bespoke fabrication and on-site installation. We work from drawings and measurements to produce equipment suited to the available space and its intended use.',
            'about_values_label' => 'Our Work',
            'about_values_title' => 'From specification to installation.',
            'about_value_1_title' => 'Workmanship',
            'about_value_1_desc' => 'We pay close attention to weld quality, joints and surface finishes throughout fabrication.',
            'about_value_2_title' => 'Clear quotations',
            'about_value_2_desc' => 'We define the materials, dimensions and scope of work so you can see what your quotation includes.',
            'about_value_3_title' => 'Planned installation',
            'about_value_3_desc' => 'We coordinate fitting around site access, the kitchen layout and the position of existing equipment.',
            'about_cta_title' => 'Request a quotation for your kitchen project.',
            'about_phone_label' => 'Call Us',
            'about_discuss_label' => 'Contact Us',
            'about_quote_label' => 'Request a Quote',
            'about_meta_title' => 'About Midia M Metal | Stainless Steel Fabrication',
            'about_meta_description' => 'Stainless steel kitchen equipment, bespoke fabrication, ventilation systems, canopy installation and wall cladding. Our factory is in London.',
        ];

        // Apply only through an explicit seeder run, preserving other page settings.
        DB::transaction(function () use ($copy) {
            foreach ($copy as $key => $value) {
                $setting = SiteSetting::firstOrNew(['key' => $key]);
                $setting->value = $value;
                if (! $setting->exists) {
                    $setting->type = str_ends_with($key, '_description') || str_ends_with($key, '_desc') ? 'textarea' : 'text';
                    $setting->group = 'about';
                }
                $setting->save();
            }
        });
    }
}
