<?php

namespace Database\Seeders;

use App\Models\AdminUser;
use App\Models\BlogPost;
use App\Models\Customer;
use App\Models\HeroSlide;
use App\Models\PortfolioCategory;
use App\Models\PortfolioProject;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;
use App\Models\SiteSetting;
use App\Models\Testimonial;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Admin User
        AdminUser::create([
            'name' => 'Admin',
            'email' => 'admin@midiametal.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        Customer::create([
            'name' => 'Playwright Customer',
            'email' => 'asd@asd.com',
            'password' => Hash::make('12345678'),
            'phone' => '07123456789',
            'address' => '1 Test Street',
            'city' => 'London',
            'postcode' => 'E1 6AN',
            'country' => 'United Kingdom',
            'billing_address' => '1 Test Street',
            'billing_city' => 'London',
            'billing_postcode' => 'E1 6AN',
            'billing_country' => 'United Kingdom',
            'shipping_address' => '1 Test Street',
            'shipping_city' => 'London',
            'shipping_postcode' => 'E1 6AN',
            'shipping_country' => 'United Kingdom',
            'is_business' => false,
        ]);

        // Hero Slides
        HeroSlide::create(['image' => '/images/portfolio-banner-kitchen.png', 'alt' => 'Commercial kitchen', 'order' => 1, 'active' => true]);
        HeroSlide::create(['image' => '/images/hero-kitchen.jpg', 'alt' => 'Kitchen ventilation installation', 'order' => 2, 'active' => true]);

        // Product Categories
        $categories = [
            ['name' => 'Baffle Filters', 'slug' => 'baffle-filters', 'image' => '/images/baffle-filter.jpg', 'description' => 'High-quality baffle grease filters for commercial kitchens.', 'order' => 1],
            ['name' => 'Canopies', 'slug' => 'canopies', 'image' => '/images/canopy.jpg', 'description' => 'Commercial canopy solutions for extraction and heat management.', 'order' => 2],
            ['name' => 'Cutting Disks', 'slug' => 'cutting-disks', 'image' => '/images/cutting-disk.jpg', 'description' => 'Precision cutting products for fabrication projects.', 'order' => 3],
            ['name' => 'LED Lights', 'slug' => 'led-lights', 'image' => '/images/products/sealed-led.webp', 'description' => 'Archived catalogue category.', 'order' => 4, 'active' => false],
            ['name' => 'Ventilation Fans', 'slug' => 'ventilation-components', 'image' => '/images/centrifugal-fan-square.png', 'description' => 'Centrifugal and duct fans for commercial kitchen ventilation systems.', 'order' => 5],
            ['name' => 'Stainless Steel Sheets', 'slug' => 'stainless-steel-sheets', 'image' => '/images/wall-cladding.jpg', 'description' => 'Premium stainless steel sheets for commercial use.', 'order' => 6],
        ];
        foreach ($categories as $cat) {
            ProductCategory::create($cat + ['active' => true]);
        }

        // Products
        $products = [
            ['name' => 'Baffle Grease Filters', 'price' => '£1,000.00', 'image' => '/images/baffle-filter.jpg', 'product_category_id' => 1, 'tags' => ['New', 'Stock'], 'featured' => true],
            ['name' => 'Canopy', 'price' => '£800.00', 'image' => '/images/canopy.jpg', 'product_category_id' => 2, 'tags' => ['Sale', 'Stock'], 'featured' => true],
            ['name' => 'Centrifugal Fan', 'price' => '£830.00', 'image' => '/images/centrifugal-fan-square.png', 'product_category_id' => 5, 'tags' => ['Simple', 'Smart'], 'featured' => true],
            ['name' => 'Aluminium Conveyor Feet Commercial Kitchens', 'price' => '£900.00', 'image' => '/images/conveyor-feet.png', 'product_category_id' => 6, 'tags' => ['Variable', 'Discount'], 'featured' => false],
            ['name' => 'Ventilation Fan', 'price' => '£700.00', 'image' => '/images/ventilation-fan-circular.png', 'product_category_id' => 5, 'tags' => ['Item', 'Simple'], 'featured' => false],
            ['name' => 'Stainless Steel Gridmesh Style Grease Filters', 'price' => '£800.00', 'image' => '/images/mesh-filter.jpg', 'product_category_id' => 1, 'tags' => ['Simple', 'Stock'], 'featured' => true, 'active' => false],
            ['name' => 'Canopy Grease Filter Cleaning Tank and Crystals', 'price' => '£700.00', 'image' => '/images/centrifugal-fan.jpg', 'product_category_id' => 1, 'tags' => ['Available', 'Item'], 'featured' => false, 'active' => false],
            ['name' => 'Commercial Canopy Hood', 'price' => '£920.00', 'image' => '/images/canopy.jpg', 'product_category_id' => 2, 'tags' => ['New', 'Smart'], 'featured' => true],
            ['name' => 'Stainless Extraction Canopy', 'price' => '£860.00', 'image' => '/images/hero-kitchen.jpg', 'product_category_id' => 2, 'tags' => ['Simple', 'Sale'], 'featured' => false],
            ['name' => 'Cutting Disk Pro 200', 'price' => '£540.00', 'image' => '/images/cutting-disk.jpg', 'product_category_id' => 3, 'tags' => ['Stock', 'Available'], 'featured' => false],
            ['name' => 'Cutting Disk Pro 250', 'price' => '£610.00', 'image' => '/images/cutting-disk.jpg', 'product_category_id' => 3, 'tags' => ['Stock', 'New'], 'featured' => false],
            ['name' => 'Precision Cutting Disk Set', 'price' => '£680.00', 'image' => '/images/cutting-disk.jpg', 'product_category_id' => 3, 'tags' => ['Item', 'Simple'], 'featured' => false],
            ['name' => 'LED Canopy Light Bar', 'price' => '£430.00', 'image' => '/images/mesh-filter.jpg', 'product_category_id' => 4, 'tags' => ['Available', 'Smart'], 'featured' => true, 'active' => false],
            ['name' => 'Waterproof LED Unit', 'price' => '£470.00', 'image' => '/images/products/sealed-led.webp', 'product_category_id' => 4, 'tags' => ['New', 'Stock'], 'featured' => false, 'active' => false],
            ['name' => 'Commercial LED Light Pack', 'price' => '£520.00', 'image' => '/images/control-panel.jpg', 'product_category_id' => 4, 'tags' => ['Sale', 'Variable'], 'featured' => false, 'active' => false],
            ['name' => 'Wall Cladding Sheets', 'price' => '£900.00', 'image' => '/images/wall-cladding.jpg', 'product_category_id' => 6, 'tags' => ['Item', 'Stock'], 'featured' => true],
            ['name' => 'Brushed Stainless Panel', 'price' => '£830.00', 'image' => '/images/wall-cladding.jpg', 'product_category_id' => 6, 'tags' => ['Available', 'Simple'], 'featured' => false],
        ];
        foreach ($products as $i => $p) {
            Product::create($p + ['slug' => Str::slug($p['name']).'-'.($i + 1), 'active' => true, 'order' => $i + 1]);
        }

        // Services
        $services = [
            ['title' => 'Ventilation Systems', 'slug' => 'ventilation-systems', 'icon' => 'Wind', 'image' => '/images/hero-kitchen.jpg', 'excerpt' => 'Complete commercial kitchen ventilation design and installation.', 'features' => ['Site Survey', 'Ducting Design', 'Fan Installation', 'Commissioning'], 'order' => 1],
            ['title' => 'Canopy Installation', 'slug' => 'canopy-installation', 'icon' => 'Building', 'image' => '/images/canopy.jpg', 'excerpt' => 'Professional canopy installation for commercial and industrial kitchens.', 'features' => ['Supply', 'Install', 'Balancing', 'Testing'], 'order' => 2],
            ['title' => 'Wall Cladding', 'slug' => 'wall-cladding', 'icon' => 'Layers', 'image' => '/images/wall-cladding.jpg', 'excerpt' => 'Hygienic stainless steel wall cladding for food areas.', 'features' => ['Panel Fabrication', 'On-site Installation', 'Finishing'], 'order' => 3],
            ['title' => 'Custom Fabrication', 'slug' => 'custom-fabrication', 'icon' => 'Wrench', 'image' => '/images/welding.jpg', 'excerpt' => 'Bespoke stainless steel fabrication and welding services.', 'features' => ['Design Support', 'Welding', 'Quality Check', 'Delivery'], 'order' => 4],
        ];
        foreach ($services as $s) {
            Service::create(array_merge($s, ['active' => true]));
        }

        // Portfolio Categories
        $pCats = [
            ['name' => 'Ventilation', 'slug' => 'ventilation'],
            ['name' => 'Cladding', 'slug' => 'cladding'],
            ['name' => 'Installation', 'slug' => 'installation'],
            ['name' => 'Custom Work', 'slug' => 'custom-work'],
        ];
        foreach ($pCats as $pc) {
            PortfolioCategory::create($pc);
        }

        // Portfolio Projects
        $projects = [
            ['title' => 'Commercial Kitchen Ventilation', 'slug' => 'commercial-kitchen-ventilation', 'image' => '/images/hero-kitchen.jpg', 'description' => 'Full ventilation system for a restaurant in London.', 'location' => 'London, UK', 'client' => 'Restaurant Group', 'year' => '2025', 'portfolio_category_id' => 1, 'services_list' => ['Site Survey', 'Ducting Design', 'Fan Installation'], 'gallery' => ['/images/hero-kitchen.jpg', '/images/workshop.jpg', '/images/centrifugal-fan.jpg']],
            ['title' => 'Stainless Steel Wall Cladding', 'slug' => 'stainless-steel-wall-cladding', 'image' => '/images/wall-cladding.jpg', 'description' => 'Hygienic wall cladding for a food processing plant.', 'location' => 'Birmingham, UK', 'client' => 'Food Production Site', 'year' => '2024', 'portfolio_category_id' => 2, 'services_list' => ['Panel Fabrication', 'On-site Installation', 'Finishing'], 'gallery' => ['/images/wall-cladding.jpg', '/images/workshop.jpg', '/images/hero-kitchen.jpg']],
            ['title' => 'Industrial Canopy Installation', 'slug' => 'industrial-canopy-installation', 'image' => '/images/canopy.jpg', 'description' => 'Large-scale canopy system for an industrial kitchen.', 'location' => 'Manchester, UK', 'client' => 'Industrial Kitchen', 'year' => '2025', 'portfolio_category_id' => 3, 'services_list' => ['Canopy Install', 'Balancing', 'Commissioning'], 'gallery' => ['/images/canopy.jpg', '/images/hero-kitchen.jpg', '/images/welding.jpg']],
            ['title' => 'Custom Welding Project', 'slug' => 'custom-welding-project', 'image' => '/images/welding.jpg', 'description' => 'Bespoke stainless steel fabrication for a hotel chain.', 'location' => 'Leeds, UK', 'client' => 'Hotel Chain', 'year' => '2026', 'portfolio_category_id' => 4, 'services_list' => ['Design Support', 'Welding', 'Quality Check'], 'gallery' => ['/images/welding.jpg', '/images/workshop.jpg', '/images/installation-service.jpg']],
            ['title' => 'Exhaust Fan System', 'slug' => 'exhaust-fan-system', 'image' => '/images/centrifugal-fan.jpg', 'description' => 'High-capacity exhaust system for a commercial bakery.', 'location' => 'Liverpool, UK', 'client' => 'Bakery', 'year' => '2025', 'portfolio_category_id' => 1, 'services_list' => ['System Upgrade', 'Fan Install', 'Testing'], 'gallery' => ['/images/centrifugal-fan.jpg', '/images/ventilation-fan-circular.png', '/images/workshop.jpg']],
            ['title' => 'Workshop Fit-Out', 'slug' => 'workshop-fit-out', 'image' => '/images/workshop.jpg', 'description' => 'Complete workshop ventilation and equipment setup.', 'location' => 'Bristol, UK', 'client' => 'Engineering Workshop', 'year' => '2024', 'portfolio_category_id' => 3, 'services_list' => ['Planning', 'Install', 'Handover'], 'gallery' => ['/images/workshop.jpg', '/images/control-panel.jpg', '/images/hero-kitchen.jpg']],
            ['title' => 'Baffle Filter Installation', 'slug' => 'baffle-filter-installation', 'image' => '/images/baffle-filter.jpg', 'description' => 'Multi-unit baffle filter system for a restaurant group.', 'location' => 'London, UK', 'client' => 'Restaurant Group', 'year' => '2026', 'portfolio_category_id' => 1, 'services_list' => ['Supply', 'Install'], 'gallery' => ['/images/baffle-filter.jpg', '/images/canopy.jpg', '/images/hero-kitchen.jpg']],
            ['title' => 'Control Panel Setup', 'slug' => 'control-panel-setup', 'image' => '/images/control-panel.jpg', 'description' => 'Custom control panels for automated ventilation systems.', 'location' => 'Nottingham, UK', 'client' => 'Factory Site', 'year' => '2025', 'portfolio_category_id' => 4, 'services_list' => ['Panel Design', 'Assembly', 'Configuration'], 'gallery' => ['/images/control-panel.jpg', '/images/workshop.jpg', '/images/ventilation-fan-circular.png']],
        ];
        foreach ($projects as $i => $p) {
            PortfolioProject::create(array_merge($p, ['active' => true, 'order' => $i + 1]));
        }

        // Blog Posts
        $posts = [
            ['title' => 'The Importance of Commercial Kitchen Ventilation', 'slug' => 'importance-of-commercial-ventilation', 'image' => '/images/hero-kitchen.jpg', 'excerpt' => 'A well-designed ventilation system is crucial for safety, compliance, and comfort in any commercial kitchen environment.', 'content' => '<p>Commercial kitchen ventilation is one of the most critical aspects of food service operation. Without proper ventilation, kitchens can become hotbeds for grease fires, heat exhaustion, and poor air quality.</p><p>A well-designed system removes heat, steam, smoke, and grease-laden vapors from the cooking environment, protecting both staff and customers.</p>', 'author' => 'Admin', 'category' => 'Ventilation', 'published_at' => now()->subDays(13)],
            ['title' => 'Choosing the Right Grease Filters for Your Setup', 'slug' => 'choosing-right-grease-filters', 'image' => '/images/baffle-filter.jpg', 'excerpt' => 'Baffle vs mesh filters — which one is best for your kitchen? We break down the pros and cons of each type.', 'content' => '<p>Grease filters are an essential component of any commercial kitchen extraction system. They capture grease droplets before they enter the ductwork, reducing the risk of fire and improving air quality.</p>', 'author' => 'Admin', 'category' => 'Products', 'published_at' => now()->subDays(18)],
            ['title' => 'A Complete Guide to Stainless Steel Wall Cladding', 'slug' => 'stainless-steel-wall-cladding-guide', 'image' => '/images/wall-cladding.jpg', 'excerpt' => 'Discover why stainless steel wall cladding is the gold standard for hygiene in food preparation areas.', 'content' => '<p>Stainless steel wall cladding offers unmatched durability, hygiene, and aesthetics for commercial food preparation areas. Its non-porous surface prevents bacteria growth and is easy to clean and disinfect.</p>', 'author' => 'Admin', 'category' => 'Guides', 'published_at' => now()->subDays(23)],
            ['title' => 'Industrial Welding Techniques for Kitchen Equipment', 'slug' => 'industrial-welding-techniques', 'image' => '/images/welding.jpg', 'excerpt' => 'TIG, MIG, and spot welding — learn which technique is used for different kitchen fabrication projects.', 'content' => '<p>The choice of welding technique significantly impacts the quality and durability of kitchen fabrication projects. TIG welding offers precision and clean welds ideal for stainless steel, while MIG welding is faster for thicker materials.</p>', 'author' => 'Admin', 'category' => 'Fabrication', 'published_at' => now()->subDays(28)],
            ['title' => '5 Tips for a Perfect Canopy Installation', 'slug' => 'canopy-installation-tips', 'image' => '/images/canopy.jpg', 'excerpt' => 'Avoid common mistakes and ensure your kitchen canopy is installed correctly the first time.', 'content' => '<p>Installing a kitchen canopy requires careful planning and execution. Getting it right the first time saves time and money, while ensuring optimal performance of your extraction system.</p>', 'author' => 'Admin', 'category' => 'Installation', 'published_at' => now()->subDays(35)],
            ['title' => 'How to Maintain Your Exhaust Fan System', 'slug' => 'exhaust-fan-maintenance', 'image' => '/images/centrifugal-fan.jpg', 'excerpt' => 'Regular maintenance extends the life of your exhaust fans and keeps your kitchen compliant with regulations.', 'content' => '<p>Exhaust fan maintenance is not just about extending equipment life — it is a legal requirement in many commercial kitchen environments. Regular servicing ensures your system meets building regulations and fire safety standards.</p>', 'author' => 'Admin', 'category' => 'Maintenance', 'published_at' => now()->subDays(43)],
        ];
        foreach ($posts as $p) {
            BlogPost::create(array_merge($p, ['active' => true]));
        }

        // Testimonials
        $testimonials = [
            [
                'name' => 'Daniel Harper',
                'company' => 'Riverside Grill, London',
                'content' => 'From design to installation, the team delivered on time and the canopy system has been excellent in daily service.',
                'rating' => 5,
                'active' => true,
                'order' => 1,
            ],
            [
                'name' => 'Sophie Bennett',
                'company' => 'Bennett Catering Ltd',
                'content' => 'Great communication and clean workmanship. The custom stainless fabrication matched our exact site requirements.',
                'rating' => 5,
                'active' => true,
                'order' => 2,
            ],
            [
                'name' => 'Michael Reed',
                'company' => 'Northfield Kitchens',
                'content' => 'Reliable delivery, practical advice, and strong aftercare. We have used them on multiple kitchen fit-out projects.',
                'rating' => 5,
                'active' => true,
                'order' => 3,
            ],
        ];
        foreach ($testimonials as $testimonial) {
            Testimonial::updateOrCreate(
                ['name' => $testimonial['name'], 'company' => $testimonial['company']],
                $testimonial
            );
        }

        // Site Settings
        $settings = [
            ['key' => 'site_name', 'value' => 'Midia M Metal', 'type' => 'text', 'group' => 'general'],
            ['key' => 'contact_phone', 'value' => '07545888522', 'type' => 'text', 'group' => 'general'],
            ['key' => 'contact_email', 'value' => 'info@midia-metal.com', 'type' => 'text', 'group' => 'general'],
            ['key' => 'contact_address', 'value' => 'Unit 8A Cromwell Centre, Hainaut Business Park, ILFORD, IG6 3UG', 'type' => 'text', 'group' => 'general'],
            ['key' => 'meta_title', 'value' => 'Midia Metal - Commercial Kitchen Solutions', 'type' => 'text', 'group' => 'seo'],
            ['key' => 'meta_description', 'value' => 'Commercial kitchen equipment, stainless steel fabrication, ventilation systems and canopy installation. Our factory is in London.', 'type' => 'text', 'group' => 'seo'],
        ];
        foreach ($settings as $s) {
            SiteSetting::create($s);
        }

        $this->call(SiteSettingsSeeder::class);
    }
}
