<?php

namespace Database\Seeders;

use App\Models\SiteSetting;
use Illuminate\Database\Seeder;

class SiteSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // Home Page
            // Home Page
            ['key' => 'home_installation_title', 'value' => 'Installation services', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_installation_desc', 'value' => 'Professional installation for all our custom fabricated stainless steel products and ventilation systems.', 'type' => 'textarea', 'group' => 'home'],
            ['key' => 'home_comfort_title', 'value' => 'Our products bring comfort to your home', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_comfort_desc', 'value' => 'Quality fabrication that enhances your living and working environments.', 'type' => 'textarea', 'group' => 'home'],
            ['key' => 'home_comfort_image', 'value' => '/images/air-conditioner.jpg', 'type' => 'image', 'group' => 'home'],
            ['key' => 'home_reward_title', 'value' => 'Reward program', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_reward_desc', 'value' => 'Exclusive benefits for our repeat customers.', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_discount_title', 'value' => 'Special discounts', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_discount_desc', 'value' => 'Seasonal offers on selected fabrication services.', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_shipping_title', 'value' => 'Fast shipping', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_shipping_desc', 'value' => 'Reliable delivery for all our standard products.', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_prices_title', 'value' => 'Great Prices', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_prices_desc', 'value' => 'Competitive pricing without compromising quality.', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_catalog_label', 'value' => 'OUR CATALOG', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_trending_title', 'value' => 'Trending items', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_view_more_label', 'value' => 'View More Products', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_request_quote_label', 'value' => 'Request a Quote', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_learn_more_label', 'value' => 'Learn More', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_label', 'value' => 'Metal welding services', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_title', 'value' => 'Metal welding & bespoke fabrication', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_desc', 'value' => 'Custom stainless steel builds, repair work, on-site modifications, and workshop welding for commercial kitchens, industrial spaces, and made-to-order metalwork.', 'type' => 'textarea', 'group' => 'home'],
            ['key' => 'home_welding_primary_cta', 'value' => 'Request Welding Quote', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_secondary_cta', 'value' => 'View More', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_service_slug', 'value' => 'custom-fabrication', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_image', 'value' => '/images/welding.jpg', 'type' => 'image', 'group' => 'home'],
            ['key' => 'home_welding_image_alt', 'value' => 'Metal welding and fabrication work', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_secondary_image', 'value' => '/images/workshop.jpg', 'type' => 'image', 'group' => 'home'],
            ['key' => 'home_welding_secondary_image_alt', 'value' => 'Workshop fabrication', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_card_label', 'value' => 'Workshop + site support', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_card_title', 'value' => 'From fabrication bench to final install', 'type' => 'text', 'group' => 'home'],
            ['key' => 'home_welding_card_desc', 'value' => 'Built for projects that need custom metalwork, fast adjustments, and practical welding support on the job.', 'type' => 'textarea', 'group' => 'home'],
            ['key' => 'footer_working_hours', 'value' => "Mon-Fri: 9 AM — 6 PM\nSaturday: 9 AM — 4 PM\nSunday: Closed", 'type' => 'textarea', 'group' => 'general'],
            ['key' => 'social_facebook', 'value' => '#', 'type' => 'url', 'group' => 'general'],
            ['key' => 'social_twitter', 'value' => '#', 'type' => 'url', 'group' => 'general'],
            ['key' => 'social_dribbble', 'value' => '#', 'type' => 'url', 'group' => 'general'],
            ['key' => 'social_instagram', 'value' => '#', 'type' => 'url', 'group' => 'general'],

            // About Page
            ['key' => 'about_title', 'value' => 'Precision Metal Solutions for Modern Spaces', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_subtitle', 'value' => 'Midia M Metal specializes in stainless steel fabrication and ventilation systems.', 'type' => 'textarea', 'group' => 'about'],
            ['key' => 'about_content_1', 'value' => 'Midia M Metal specializes in stainless steel fabrication, kitchen ventilation systems, and tailored installation services. We design and produce practical solutions that balance durability, performance, and clean visual finish.', 'type' => 'textarea', 'group' => 'about'],
            ['key' => 'about_content_2', 'value' => 'From initial consultation to final handover, we focus on quality workmanship, reliable timelines, and clear communication. Our goal is to support every client with long-term value, not just short-term delivery.', 'type' => 'textarea', 'group' => 'about'],
            ['key' => 'about_image', 'value' => '', 'type' => 'image', 'group' => 'about'],
            ['key' => 'about_exp_value', 'value' => '15+', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_exp_label', 'value' => 'Years of Experience', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_proj_value', 'value' => '1,200+', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_proj_label', 'value' => 'Projects Completed', 'type' => 'text', 'group' => 'about'],

            // Services Section (General or Home)
            ['key' => 'services_hero_title', 'value' => 'Our Services', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_hero_label', 'value' => 'YOUR COMFORT', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_hero_subtitle', 'value' => 'Stainless steel welding', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_hero_tagline', 'value' => 'Professional craftsmanship for demanding projects.', 'type' => 'textarea', 'group' => 'services'],
            ['key' => 'services_hero_desc', 'value' => 'Professional metal solutions for modern architectural needs.', 'type' => 'textarea', 'group' => 'services'],

            // Contact Page
            ['key' => 'contact_welcome', 'value' => 'Get in touch with us for Any custom stainless steel fabrication or ventilation system inquiries.', 'type' => 'textarea', 'group' => 'contact'],
            ['key' => 'contact_hero_label', 'value' => 'CONTACT US', 'type' => 'text', 'group' => 'contact'],
            ['key' => 'contact_hero_title', 'value' => "Have Questions?\nGet in Touch!", 'type' => 'textarea', 'group' => 'contact'],
            ['key' => 'contact_form_message_placeholder', 'value' => 'How can we help you? Feel free to get in touch!', 'type' => 'text', 'group' => 'contact'],
            ['key' => 'contact_form_button_label', 'value' => 'Get in Touch', 'type' => 'text', 'group' => 'contact'],
            ['key' => 'contact_address', 'value' => '123 Metal Street, Industrial Zone, London, UK', 'type' => 'text', 'group' => 'contact'],
            ['key' => 'contact_phone', 'value' => '+44 123 456 7890', 'type' => 'text', 'group' => 'contact'],
            ['key' => 'contact_email', 'value' => 'softwaredevelopment2181@gmail.com', 'type' => 'text', 'group' => 'contact'],
            ['key' => 'contact_map_url', 'value' => 'https://www.google.com/maps/embed?pb=...', 'type' => 'url', 'group' => 'contact'],

            // Services Page
            ['key' => 'services_hero_phone', 'value' => '0 800 555 44 33', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_hero_image_1', 'value' => '/images/hero-kitchen.jpg', 'type' => 'image', 'group' => 'services'],
            ['key' => 'services_hero_image_2', 'value' => '/images/welding.jpg', 'type' => 'image', 'group' => 'services'],
            ['key' => 'services_quality_label', 'value' => 'PREMIUM QUALITY', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_quality_title', 'value' => 'Our services make your life comfortable', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_cta_title', 'value' => 'Contact us today for a free consultation and quote.', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_modern_label', 'value' => 'MODERN SOLUTIONS', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_modern_title', 'value' => 'Project with Expert & Metal Welding Collaboration', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_modern_desc', 'value' => 'Professional metal solutions for modern architectural needs.', 'type' => 'textarea', 'group' => 'services'],
            ['key' => 'services_modern_image_1', 'value' => '/images/workshop.jpg', 'type' => 'image', 'group' => 'services'],
            ['key' => 'services_modern_image_2', 'value' => '/images/hero-kitchen.jpg', 'type' => 'image', 'group' => 'services'],

            ['key' => 'services_feature_1_title', 'value' => 'Restaurant Expertise', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_feature_1_desc', 'value' => 'Specialized fabrication for commercial kitchens and dining spaces.', 'type' => 'textarea', 'group' => 'services'],
            ['key' => 'services_feature_2_title', 'value' => 'Quality Assurance', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_feature_2_desc', 'value' => 'Rigorous testing and inspection for every piece we produce.', 'type' => 'textarea', 'group' => 'services'],
            ['key' => 'services_feature_3_title', 'value' => 'Custom Solutions', 'type' => 'text', 'group' => 'services'],
            ['key' => 'services_feature_3_desc', 'value' => 'Tailored designs that meet your specific project requirements.', 'type' => 'textarea', 'group' => 'services'],

            // About Page
            ['key' => 'about_hero_title', 'value' => 'About Us', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_who_label', 'value' => 'Who We Are', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_image_1', 'value' => '/images/workshop.jpg', 'type' => 'image', 'group' => 'about'],
            ['key' => 'about_image_2', 'value' => '/images/welding.jpg', 'type' => 'image', 'group' => 'about'],
            ['key' => 'about_image_3', 'value' => '/images/hero-kitchen.jpg', 'type' => 'image', 'group' => 'about'],
            ['key' => 'about_image_4', 'value' => '/images/canopy.jpg', 'type' => 'image', 'group' => 'about'],
            ['key' => 'about_values_label', 'value' => 'Our Core Values', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_values_title', 'value' => 'Built on Quality and Trust', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_cta_title', 'value' => 'Need a custom metal solution for your business?', 'type' => 'textarea', 'group' => 'about'],

            ['key' => 'about_value_1_title', 'value' => 'Quality First', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_value_1_desc', 'value' => 'Every product is fabricated with strict quality control.', 'type' => 'textarea', 'group' => 'about'],
            ['key' => 'about_value_2_title', 'value' => 'Expert Craftsmanship', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_value_2_desc', 'value' => 'Our team combines technical skill and field experience.', 'type' => 'textarea', 'group' => 'about'],
            ['key' => 'about_value_3_title', 'value' => 'Custom Fabrication', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_value_3_desc', 'value' => 'We build tailored stainless steel systems.', 'type' => 'textarea', 'group' => 'about'],
            ['key' => 'about_value_4_title', 'value' => 'On-Time Delivery', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_value_4_desc', 'value' => 'Clear planning and efficient production.', 'type' => 'textarea', 'group' => 'about'],

            ['key' => 'about_satisfaction_value', 'value' => '98%', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_satisfaction_label', 'value' => 'Client Satisfaction', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_support_value', 'value' => '24/7', 'type' => 'text', 'group' => 'about'],
            ['key' => 'about_support_label', 'value' => 'Support Availability', 'type' => 'text', 'group' => 'about'],

            // Portfolio Page
            ['key' => 'portfolio_hero_title', 'value' => 'Portfolio', 'type' => 'text', 'group' => 'portfolio'],
            ['key' => 'portfolio_cta_label', 'value' => 'Ready to start', 'type' => 'text', 'group' => 'portfolio'],
            ['key' => 'portfolio_cta_title', 'value' => 'Have a project in mind?', 'type' => 'text', 'group' => 'portfolio'],

            // Blog Page
            ['key' => 'blog_hero_title', 'value' => 'Blog', 'type' => 'text', 'group' => 'blog'],
            ['key' => 'blog_sidebar_search', 'value' => 'Search', 'type' => 'text', 'group' => 'blog'],
            ['key' => 'blog_sidebar_categories', 'value' => 'Categories', 'type' => 'text', 'group' => 'blog'],
            ['key' => 'blog_sidebar_recent', 'value' => 'Recent Posts', 'type' => 'text', 'group' => 'blog'],

            ['key' => 'site_name', 'value' => 'Midia M Metal', 'type' => 'text', 'group' => 'header'],
            ['key' => 'site_logo', 'value' => '', 'type' => 'image', 'group' => 'header'],
            ['key' => 'header_nav_home', 'value' => 'Home', 'type' => 'text', 'group' => 'header'],
            ['key' => 'header_nav_services', 'value' => 'Services', 'type' => 'text', 'group' => 'header'],
            ['key' => 'header_nav_about', 'value' => 'About Us', 'type' => 'text', 'group' => 'header'],
            ['key' => 'header_nav_portfolio', 'value' => 'Portfolio', 'type' => 'text', 'group' => 'header'],
            ['key' => 'header_nav_blog', 'value' => 'Blog', 'type' => 'text', 'group' => 'header'],
            ['key' => 'header_nav_shop', 'value' => 'Shop', 'type' => 'text', 'group' => 'header'],
            ['key' => 'header_nav_contact', 'value' => 'Contact', 'type' => 'text', 'group' => 'header'],

            ['key' => 'footer_text', 'value' => '© 2024 Midia M Metal. All rights reserved.', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_working_hours', 'value' => "Mon-Fri: 9 AM — 6 PM\nSaturday: 9 AM — 4 PM\nSunday: Closed", 'type' => 'textarea', 'group' => 'footer'],
            ['key' => 'footer_label_office', 'value' => 'Office', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_label_links', 'value' => 'Links', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_label_working_hours', 'value' => 'Working Hours', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_label_get_in_touch', 'value' => 'Get in Touch', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_label_info', 'value' => 'Information', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'contact_address', 'value' => 'Unit 8A Cromwell Centre, Hainaut Business Park, ILFORD, IG6 3UG', 'type' => 'textarea', 'group' => 'footer'],
            ['key' => 'contact_phone', 'value' => '07545888522', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'contact_email', 'value' => 'softwaredevelopment2181@gmail.com', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'social_facebook', 'value' => '#', 'type' => 'url', 'group' => 'footer'],
            ['key' => 'social_twitter', 'value' => '#', 'type' => 'url', 'group' => 'footer'],
            ['key' => 'social_dribbble', 'value' => '#', 'type' => 'url', 'group' => 'footer'],
            ['key' => 'social_instagram', 'value' => '#', 'type' => 'url', 'group' => 'footer'],
            ['key' => 'footer_nav_home', 'value' => 'Home', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_nav_services', 'value' => 'Services', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_nav_about', 'value' => 'About Us', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_nav_shop', 'value' => 'Shop', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_nav_contact', 'value' => 'Contact', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_info_privacy', 'value' => 'Privacy Policy', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_info_terms', 'value' => 'Terms & Conditions', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_info_cookies', 'value' => 'Cookies Page', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_info_returns', 'value' => 'Returns & Refunds', 'type' => 'text', 'group' => 'footer'],
            ['key' => 'footer_info_faq', 'value' => 'FAQ', 'type' => 'text', 'group' => 'footer'],

            ['key' => 'shipping_rate', 'value' => '10.00', 'type' => 'text', 'group' => 'shipping-tax'],
            ['key' => 'shipping_type', 'value' => 'flat', 'type' => 'text', 'group' => 'shipping-tax'],
            ['key' => 'vat_enabled', 'value' => '1', 'type' => 'boolean', 'group' => 'shipping-tax'],
            ['key' => 'vat_rate', 'value' => '20', 'type' => 'text', 'group' => 'shipping-tax'],
        ];

        $settingsByKey = [];
        foreach ($settings as $setting) {
            $settingsByKey[$setting['key']] = $setting;
        }

        foreach ($settingsByKey as $setting) {
            SiteSetting::firstOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
