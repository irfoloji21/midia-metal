<?php

namespace Database\Seeders;

use App\Models\Faq;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faqs = [
            [
                'question' => 'Do you sell both standard products and custom fabrication?',
                'answer' => 'Yes. We supply selected standard products through the shop and also handle custom stainless steel fabrication and ventilation work.',
                'order' => 1,
            ],
            [
                'question' => 'How do I request a custom quote?',
                'answer' => 'Use the quote request form and include as much project detail as possible, including drawings, dimensions, and site requirements.',
                'order' => 2,
            ],
            [
                'question' => 'How long does delivery take?',
                'answer' => 'Lead times depend on whether the item is stock-based or made to order. Standard items are usually faster; custom work depends on project scope and scheduling.',
                'order' => 3,
            ],
            [
                'question' => 'Where is your factory?',
                'answer' => 'Our factory is in London.',
                'order' => 4,
            ],
            [
                'question' => 'Can I return custom-fabricated items?',
                'answer' => 'Custom items are generally non-returnable unless faulty or not produced to the agreed specification.',
                'order' => 5,
            ],
            [
                'question' => 'What should I do if my order arrives damaged?',
                'answer' => 'Contact us within 48 hours with photographs and your order reference so we can review and resolve the issue quickly.',
                'order' => 6,
            ],
            [
                'question' => 'Can I speak with someone before ordering?',
                'answer' => 'Yes. You can contact the team directly to discuss specifications, lead times, and the right solution for your site.',
                'order' => 7,
            ],
        ];

        foreach ($faqs as $faq) {
            Faq::create($faq);
        }
    }
}
