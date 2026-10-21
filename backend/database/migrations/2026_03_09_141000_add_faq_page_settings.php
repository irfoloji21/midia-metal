<?php

use App\Models\SiteSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key' => 'nav_faq',
                'value' => 'FAQ',
                'type' => 'text',
                'group' => 'general',
            ],
            [
                'key' => 'faq_page_title',
                'value' => 'Frequently Asked Questions',
                'type' => 'text',
                'group' => 'faq',
            ],
            [
                'key' => 'faq_page_content',
                'value' => <<<'HTML'
<h2>Ordering</h2>
<p><strong>Do you sell both standard products and custom fabrication?</strong><br>Yes. We supply selected standard products through the shop and also handle custom stainless steel fabrication and ventilation work.</p>
<p><strong>How do I request a custom quote?</strong><br>Use the quote request form and include as much project detail as possible, including drawings, dimensions, and site requirements.</p>
<h2>Delivery</h2>
<p><strong>How long does delivery take?</strong><br>Lead times depend on whether the item is stock-based or made to order. Standard items are usually faster; custom work depends on project scope and scheduling.</p>
<h2>Returns</h2>
<p><strong>Can I return custom-fabricated items?</strong><br>Custom items are generally non-returnable unless faulty or not produced to the agreed specification.</p>
<p><strong>What should I do if my order arrives damaged?</strong><br>Contact us within 48 hours with photographs and your order reference so we can review and resolve the issue quickly.</p>
<h2>Support</h2>
<p><strong>Where is your factory?</strong><br>Our factory is in London.</p>
<p><strong>Can I speak with someone before ordering?</strong><br>Yes. You can contact the team directly to discuss specifications, lead times, and the right solution for your site.</p>
HTML,
                'type' => 'richtext',
                'group' => 'faq',
            ],
        ];

        foreach ($settings as $setting) {
            SiteSetting::updateOrCreate(['key' => $setting['key']], $setting);
        }
    }

    public function down(): void
    {
        SiteSetting::whereIn('key', [
            'nav_faq',
            'faq_page_title',
            'faq_page_content',
        ])->delete();
    }
};
