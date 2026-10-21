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
            'contact_hero_title' => 'Product and project enquiries.',
            'contact_welcome' => 'Contact Midia M Metal for enquiries about commercial kitchen equipment, fabrication and installation.',
            'contact_phone_label' => 'Call Us',
            'contact_form_title' => 'Send an enquiry.',
            'contact_form_intro' => 'Use this form for product questions and general enquiries.',
            'contact_form_name_label' => 'Full Name',
            'contact_form_email_label' => 'Email Address',
            'contact_form_phone_label' => 'Phone Number (optional)',
            'contact_form_subject_label' => 'Enquiry Subject (optional)',
            'contact_form_message_placeholder' => 'Enter your message.',
            'contact_form_button_label' => 'Send Enquiry',
            'contact_form_sending_label' => 'Sending...',
            'contact_form_success_message' => 'Your enquiry has been received. Our team will review the details and contact you using the information provided.',
            'contact_form_error_message' => 'Your enquiry could not be sent. Please try again or contact us by phone or email.',
            'contact_form_privacy_error' => 'Please confirm your agreement to the privacy policy before sending your enquiry.',
            'contact_form_privacy_prefix' => 'I agree to the',
            'contact_form_privacy_link_label' => 'Privacy Policy.',
            'contact_quote_title' => 'Request a quotation.',
            'contact_quote_desc' => 'For project pricing, use our quotation form to submit your requirements and supporting files.',
            'contact_quote_button_label' => 'Request a Quote',
            'contact_meta_title' => 'Contact Midia M Metal | Kitchen Equipment & Fabrication',
            'contact_meta_description' => 'Contact Midia M Metal for kitchen equipment, bespoke fabrication, ventilation systems, canopies and wall cladding. Our factory is in London.',
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
