<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ContactPageCopySeeder extends Seeder
{
    public function run(): void
    {
        $copy = [
            'contact_hero_label' => 'Contact Midia M Metal',
            'contact_hero_title' => 'Let’s talk about the job.',
            'contact_welcome' => "Need something made, fitted or repaired? Call or WhatsApp us and tell us what you have in mind. We’ll talk through what you need and the next steps.\n\nYou can also email us or leave a message using the form.",
            'contact_phone_label' => 'Call Us',
            'contact_whatsapp_label' => 'WhatsApp Us',
            'contact_form_title' => 'Leave us a message.',
            'contact_form_intro' => 'Tell us what you need and where the job is. Include your postcode and any approximate measurements you have, so we can understand the work involved.',
            'contact_form_name_label' => 'Your Name',
            'contact_form_email_label' => 'Email Address',
            'contact_form_phone_label' => 'Phone Number (optional)',
            'contact_form_subject_label' => 'Subject (optional)',
            'contact_form_message_placeholder' => 'Tell us about the work you need.',
            'contact_form_button_label' => 'Send Message',
            'contact_form_sending_label' => 'Sending...',
            'contact_form_success_message' => 'Thanks, we’ve received your message. We’ll get back to you using the contact details you provided.',
            'contact_form_error_message' => 'Your message couldn’t be sent. Please try again, or contact us by phone or WhatsApp.',
            'contact_form_privacy_error' => 'Please tick the privacy policy box before sending your message.',
            'contact_form_privacy_prefix' => 'I agree to the',
            'contact_form_privacy_link_label' => 'privacy policy.',
            'contact_quote_title' => 'Looking for a price estimate?',
            'contact_quote_desc' => 'Use our quote form to tell us what you need made or supplied.',
            'contact_quote_button_label' => 'Request a Quote',
            'contact_meta_title' => 'Contact Midia M Metal | Discuss Your Job',
            'contact_meta_description' => 'Call, WhatsApp or email Midia M Metal about commercial kitchen equipment, ventilation, custom fabrication, installation or repairs. Based in London.',
        ];

        // Run explicitly to apply the approved copy, retaining the contact details.
        DB::transaction(function () use ($copy) {
            foreach ($copy as $key => $value) {
                $setting = SiteSetting::firstOrNew(['key' => $key]);
                $setting->value = $value;
                if (! $setting->exists) {
                    $setting->type = str_ends_with($key, '_description') || str_ends_with($key, '_desc') || str_ends_with($key, '_message') || str_ends_with($key, '_intro') ? 'textarea' : 'text';
                    $setting->group = 'contact';
                }
                $setting->save();
            }
        });
    }
}
