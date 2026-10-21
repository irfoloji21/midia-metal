<?php

namespace Database\Seeders;

use App\Models\BlogPost;
use App\Models\Faq;
use App\Models\SiteSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Applies the approved factory-location wording without defining a service area. */
class FactoryLocationCopySeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local') || DB::connection()->getDriverName() !== 'sqlite') {
            throw new \RuntimeException('This copy refresh is restricted to the local SQLite site.');
        }

        $copy = [
            'home_hero_desc' => 'We manufacture stainless steel kitchen equipment and bespoke metalwork at our London factory. Our team manages site measurements, fabrication and installation, with every component made to your project specifications.',
            'meta_description' => 'Commercial kitchen equipment, stainless steel fabrication, ventilation systems and canopy installation. Our factory is in London.',
            'about_content_1' => 'Midia M Metal manufactures and supplies stainless steel equipment for commercial kitchens. Our factory is in London.',
            'about_exp_label' => 'Our factory is in London.',
            'about_meta_title' => 'About Midia M Metal | Stainless Steel Fabrication',
            'about_meta_description' => 'Stainless steel kitchen equipment, bespoke fabrication, ventilation systems, canopy installation and wall cladding. Our factory is in London.',
            'services_meta_description' => 'Commercial kitchen fabrication, ventilation systems, canopy installation and stainless steel wall cladding. Our factory is in London.',
            'contact_meta_description' => 'Contact Midia M Metal for kitchen equipment, bespoke fabrication, ventilation systems, canopies and wall cladding. Our factory is in London.',
            'footer_label_office' => 'Factory',
        ];

        $legacyQuestion = 'Do you deliver across the UK?';
        $legacyAnswer = 'Yes. Delivery coverage depends on product size, access requirements, and courier or transport arrangements.';
        $factoryQuestion = 'Where is your factory?';
        $factoryAnswer = 'Our factory is in London.';
        $legacyBlogSentence = 'Midia M Metal manufactures and supplies commercial kitchen equipment in London.';

        $directory = storage_path('app/private/copy-backups');
        File::ensureDirectoryExists($directory);
        $backup = $directory.'/factory-location-before-'.now()->format('Ymd-His-u').'.json';

        DB::transaction(function () use ($copy, $legacyQuestion, $legacyAnswer, $factoryQuestion, $factoryAnswer, $legacyBlogSentence, $backup) {
            $settings = SiteSetting::whereIn('key', array_merge(array_keys($copy), ['faq_page_content', 'company_address', 'contact_address']))->get()->keyBy('key');
            $faqs = Faq::where('question', $legacyQuestion)->get();
            $posts = BlogPost::where('content', 'like', '%'.$legacyBlogSentence.'%')->get();
            if (File::put($backup, json_encode([
                'settings' => $settings->values()->map(fn ($row) => $row->getAttributes())->all(),
                'faqs' => $faqs->map(fn ($row) => $row->getAttributes())->all(),
                'posts' => $posts->map(fn ($row) => $row->getAttributes())->all(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) === false) {
                throw new \RuntimeException('Could not back up the existing copy.');
            }

            foreach ($copy as $key => $value) {
                $setting = $settings->get($key) ?? new SiteSetting([
                    'key' => $key,
                    'type' => 'textarea',
                    'group' => explode('_', $key, 2)[0],
                ]);
                $setting->value = $value;
                $setting->save();
            }

            $faqPage = $settings->get('faq_page_content');
            $legacyParagraph = '<p><strong>'.$legacyQuestion.'</strong><br>'.$legacyAnswer.'</p>';
            if ($faqPage && str_contains($faqPage->value, $legacyParagraph)) {
                $content = str_replace($legacyParagraph, '', $faqPage->value);
                if (! str_contains($content, $factoryQuestion)) {
                    $paragraph = '<p><strong>'.$factoryQuestion.'</strong><br>'.$factoryAnswer.'</p>';
                    $content = str_contains($content, '<h2>Support</h2>')
                        ? str_replace('<h2>Support</h2>', '<h2>Support</h2>'."\n".$paragraph, $content)
                        : $content."\n".$paragraph;
                }
                $faqPage->update(['value' => $content]);
            }

            foreach ($faqs as $faq) {
                $faq->update(['question' => $factoryQuestion, 'answer' => $factoryAnswer]);
            }
            foreach ($posts as $post) {
                $post->update(['content' => str_replace($legacyBlogSentence, 'Midia M Metal manufactures and supplies commercial kitchen equipment. Its factory is in London.', $post->content)]);
            }

            // Use the existing public factory address instead of the old seeded placeholder.
            $companyAddress = $settings->get('company_address');
            $contactAddress = $settings->get('contact_address')?->value;
            if ($companyAddress?->value === '123 Industrial Park, London, UK' && $contactAddress) {
                $companyAddress->update(['value' => $contactAddress]);
            }
        });

        $this->command?->info('Factory-location copy updated. Backup: '.$backup);
    }
}
