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
            'about_title' => 'Metalwork made by our own team.',
            'about_content_1' => 'We’re Midia M Metal, a London-based team making and fitting equipment for commercial kitchens. Worktops, cupboards, sinks, grills, canopies and ventilation systems are all part of our work. We also make custom metalwork and take on welding, alterations and repairs.',
            'about_content_2' => 'We start by talking through what you need and how it will be used. Most of our work is in stainless steel, but we choose the material with you to suit the job. The measurements, layout and finish all matter. Our aim is to make something that fits your space, works properly and comes at a sensible price.',
            'about_exp_value' => 'London-based',
            'about_exp_label' => 'Taking on projects across the UK, depending on the work and location.',
            'about_proj_value' => 'Our own team',
            'about_proj_label' => 'Your metalwork is made by our own fabricators.',
            'about_satisfaction_value' => 'Made to measure',
            'about_satisfaction_label' => 'Dimensions and materials agreed around your needs.',
            'about_support_value' => 'From start to finish',
            'about_support_label' => 'Measurement, fabrication, delivery and installation.',
            'about_values_label' => 'How We Approach the Job',
            'about_values_title' => 'The fit, the finish and the details.',
            'about_value_1_title' => 'Good workmanship',
            'about_value_1_desc' => 'The welds, the finish and how each piece fits together matter. We take care with the details because the equipment needs to stand up to everyday use.',
            'about_value_2_title' => 'Room for your ideas',
            'about_value_2_desc' => 'Tell us how you want it to work. We’ll discuss the dimensions, materials and layout with you, and work towards the result you have in mind.',
            'about_value_3_title' => 'Straightforward pricing',
            'about_value_3_desc' => 'We give you a free initial estimate from the information you provide. Once the measurements and details are confirmed, we agree the final price with you before production.',
            'about_value_4_title' => 'Work that keeps moving',
            'about_value_4_desc' => 'We work quickly and tell you the expected production and delivery times once the job is agreed. The warranty period is also confirmed as part of your project details.',
            'about_cta_title' => 'Got a job in mind? Talk it through with us.',
            'about_phone_label' => 'Call Us',
            'about_whatsapp_label' => 'WhatsApp Us',
            'about_discuss_label' => 'Discuss Your Job',
            'about_quote_label' => 'Request a Quote',
            'about_meta_title' => 'About Midia M Metal | London Fabrication & Welding Team',
            'about_meta_description' => 'Meet Midia M Metal, a London-based team making and fitting commercial kitchen equipment. Custom stainless steel fabrication, welding, alterations and repairs.',
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
