<?php

namespace App\Services;

use App\Models\BlogPost;
use App\Models\PortfolioProject;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;
use App\Models\SiteSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SeoMetaService
{
    /**
     * Resolve the canonical base URL for the site.
     */
    public function resolveBaseUrl(Request $request): string
    {
        $configuredFrontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return $configuredFrontendUrl !== '' && ! preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i', $configuredFrontendUrl)
            ? $configuredFrontendUrl
            : rtrim($request->getSchemeAndHttpHost(), '/');
    }

    /**
     * Normalize text by stripping tags and trimming to a limit.
     */
    public function normalizeText(?string $text, int $limit = 160): string
    {
        return Str::limit(trim(preg_replace('/\s+/', ' ', strip_tags((string) $text))), $limit, '...');
    }

    /**
     * Build an absolute URL from a base URL and optional path.
     */
    public function absoluteUrl(string $baseUrl, ?string $path = null): string
    {
        if (! $path) {
            return $baseUrl.'/';
        }

        if (preg_match('/^https?:\/\//i', $path)) {
            return $path;
        }

        return $baseUrl.'/'.ltrim($path, '/');
    }

    /**
     * Build a BreadcrumbList JSON-LD schema object.
     */
    public function breadcrumbJsonLd(array $items): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => array_map(function ($item, $index) {
                return [
                    '@type' => 'ListItem',
                    'position' => $index + 1,
                    'name' => $item['name'],
                    'item' => $item['url'],
                ];
            }, $items, array_keys($items)),
        ];
    }

    /**
     * Build the SEO meta array for a given request path.
     *
     * May return a RedirectResponse for slug canonicalization (product/blog numeric IDs → slugs).
     *
     * @return array|RedirectResponse
     */
    public function buildSeoMeta(Request $request, int $status = 200)
    {
        $path = trim($request->path(), '/');
        $baseUrl = $this->resolveBaseUrl($request);
        $settings = Schema::hasTable('site_settings')
            ? SiteSetting::pluck('value', 'key')
            : collect();
        $siteName = $settings->get('site_name', 'Midia M Metal');
        $defaultImage = $this->absoluteUrl($baseUrl, $settings->get('site_logo') ?: '/logo.png');
        $contactPhone = $settings->get('contact_phone') ?: $settings->get('company_phone');
        $contactEmail = $settings->get('contact_email') ?: $settings->get('company_email');
        $contactAddress = $settings->get('contact_address') ?: $settings->get('company_address');
        $twitterHandle = trim((string) $settings->get('social_twitter', '@midiametal'));
        if ($twitterHandle !== '' && ! Str::startsWith($twitterHandle, '@')) {
            $twitterHandle = preg_match('~twitter\.com/([^/?#]+)~i', $twitterHandle, $matches) ? '@'.$matches[1] : '@midiametal';
        }

        $meta = [
            'title' => $settings->get('meta_title', $siteName.' | Commercial Kitchen Ventilation & Fabrication'),
            'description' => $this->normalizeText($settings->get('meta_description', 'Commercial kitchen ventilation, stainless steel fabrication, canopy systems, and custom metalwork across the UK.')),
            'canonical' => $path === '' ? $baseUrl.'/' : $this->absoluteUrl($baseUrl, $path),
            'type' => 'website',
            'image' => $defaultImage,
            'robots' => $status === 404 ? 'noindex, nofollow' : 'index, follow',
            'siteName' => $siteName,
            'twitterSite' => $twitterHandle !== '' ? $twitterHandle : '@midiametal',
            'jsonLd' => [$this->breadcrumbJsonLd([
                ['name' => 'Home', 'url' => $baseUrl.'/'],
            ])],
        ];

        if ($path === '') {
            $organization = [
                '@context' => 'https://schema.org',
                '@type' => 'LocalBusiness',
                'name' => $siteName,
                'url' => $baseUrl.'/',
                'image' => $defaultImage,
            ];

            if ($contactPhone) {
                $organization['telephone'] = $contactPhone;
            }

            if ($contactEmail) {
                $organization['email'] = $contactEmail;
            }

            if ($contactAddress) {
                $organization['address'] = [
                    '@type' => 'PostalAddress',
                    'streetAddress' => $contactAddress,
                ];
            }

            $meta['jsonLd'] = array_values(array_filter([
                $this->breadcrumbJsonLd([
                    ['name' => 'Home', 'url' => $baseUrl.'/'],
                ]),
                $organization,
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'WebSite',
                    'name' => $siteName,
                    'url' => $baseUrl.'/',
                ],
            ]));
        }

        if ($path === 'admin' || $path === 'admin/login' || Str::startsWith($path, 'admin/')) {
            $meta['title'] = 'Admin | '.$siteName;
            $meta['description'] = 'Admin dashboard access.';
            $meta['robots'] = 'noindex, nofollow';
            $meta['jsonLd'] = [];

            return $meta;
        }

        $staticMeta = $this->buildStaticMeta($settings, $siteName);

        if (array_key_exists($path, $staticMeta)) {
            $meta = array_merge($meta, $staticMeta[$path]);

            if ($path === 'shop' && (
                $request->filled('search') ||
                $request->filled('category') ||
                $request->filled('tag') ||
                $request->boolean('stock') ||
                $request->boolean('in_stock') ||
                $request->filled('min_price') ||
                $request->filled('max_price') ||
                $request->filled('sort')
            )) {
                $meta['robots'] = 'noindex, follow';
            }

            if ($path !== '') {
                $pageName = Str::before($meta['title'], ' | '.$siteName);
                $meta['jsonLd'] = [$this->breadcrumbJsonLd([
                    ['name' => 'Home', 'url' => $baseUrl.'/'],
                    ['name' => $pageName !== '' ? $pageName : $meta['title'], 'url' => $meta['canonical']],
                ])];
            }

            return $meta;
        }

        // Dynamic route: category page
        if (preg_match('#^shop/category/([^/]+)$#', $path, $matches)) {
            return $this->buildCategoryMeta($meta, $matches[1], $baseUrl, $siteName);
        }

        // Dynamic route: product page
        if (preg_match('#^shop/([^/]+)$#', $path, $matches)) {
            return $this->buildProductMeta($meta, $matches[1], $baseUrl, $siteName, $defaultImage);
        }

        // Dynamic route: service page
        if (preg_match('#^services/([^/]+)$#', $path, $matches)) {
            return $this->buildServiceMeta($meta, $matches[1], $baseUrl, $siteName, $defaultImage);
        }

        // Dynamic route: portfolio page
        if (preg_match('#^portfolio/([^/]+)$#', $path, $matches)) {
            return $this->buildPortfolioMeta($meta, $matches[1], $baseUrl, $siteName, $defaultImage);
        }

        // Dynamic route: blog post
        if (preg_match('#^blog/([^/]+)$#', $path, $matches)) {
            return $this->buildBlogMeta($meta, $matches[1], $baseUrl, $siteName, $defaultImage);
        }

        if ($status === 404) {
            $meta['title'] = '404 Not Found | '.$siteName;
            $meta['description'] = 'The page you requested could not be found.';
            $meta['robots'] = 'noindex, nofollow';
        }

        return $meta;
    }

    /**
     * Inject SEO meta tags into the SPA HTML <head>.
     */
    public function injectSpaMeta(string $html, array $meta): string
    {
        $escape = fn (string $value) => htmlspecialchars($value, ENT_QUOTES, 'UTF-8');

        $patterns = [
            '/<title>.*?<\/title>/is',
            '/<meta[^>]+name=["\']description["\'][^>]*>/i',
            '/<meta[^>]+name=["\']robots["\'][^>]*>/i',
            '/<meta[^>]+property=["\']og:title["\'][^>]*>/i',
            '/<meta[^>]+property=["\']og:description["\'][^>]*>/i',
            '/<meta[^>]+property=["\']og:type["\'][^>]*>/i',
            '/<meta[^>]+property=["\']og:url["\'][^>]*>/i',
            '/<meta[^>]+property=["\']og:image["\'][^>]*>/i',
            '/<meta[^>]+property=["\']og:site_name["\'][^>]*>/i',
            '/<meta[^>]+name=["\']twitter:card["\'][^>]*>/i',
            '/<meta[^>]+name=["\']twitter:site["\'][^>]*>/i',
            '/<meta[^>]+name=["\']twitter:title["\'][^>]*>/i',
            '/<meta[^>]+name=["\']twitter:description["\'][^>]*>/i',
            '/<meta[^>]+name=["\']twitter:image["\'][^>]*>/i',
            '/<link[^>]+rel=["\']canonical["\'][^>]*>/i',
            '/<script[^>]+data-server-seo=["\']true["\'][^>]*>.*?<\/script>/is',
        ];

        $html = preg_replace($patterns, '', $html) ?? $html;

        $tags = [
            '<title>'.$escape($meta['title']).'</title>',
            '<meta name="description" content="'.$escape($meta['description']).'">',
            '<meta name="robots" content="'.$escape($meta['robots']).'">',
            '<link rel="canonical" href="'.$escape($meta['canonical']).'">',
            '<meta property="og:title" content="'.$escape($meta['title']).'">',
            '<meta property="og:description" content="'.$escape($meta['description']).'">',
            '<meta property="og:type" content="'.$escape($meta['type']).'">',
            '<meta property="og:url" content="'.$escape($meta['canonical']).'">',
            '<meta property="og:image" content="'.$escape($meta['image']).'">',
            '<meta property="og:site_name" content="'.$escape($meta['siteName'] ?? 'Midia M Metal').'">',
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="twitter:site" content="'.$escape($meta['twitterSite'] ?? '@midiametal').'">',
            '<meta name="twitter:title" content="'.$escape($meta['title']).'">',
            '<meta name="twitter:description" content="'.$escape($meta['description']).'">',
            '<meta name="twitter:image" content="'.$escape($meta['image']).'">',
        ];

        foreach ($meta['jsonLd'] as $jsonLd) {
            $tags[] = '<script type="application/ld+json" data-server-seo="true">'.json_encode($jsonLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).'</script>';
        }

        return preg_replace('/<\/head>/i', implode("\n", $tags)."\n</head>", $html, 1) ?? $html;
    }

    /**
     * Inject noscript product content before </body> for SEO.
     */
    public function injectNoscriptContent(string $html, array $meta): string
    {
        if (empty($meta['_product_noscript'])) {
            return $html;
        }
        $p = $meta['_product_noscript'];
        $escape = fn (string $value) => htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        $lines = [
            '<noscript><div style="display:none" aria-hidden="true">',
            '<h1>'.$escape($p['name']).'</h1>',
            '<p>'.$escape($p['description']).'</p>',
        ];
        if ($p['price_on_request'] ?? false) {
            $lines[] = '<p>Contact us for price</p>';
        } elseif ($p['price']) {
            $lines[] = '<p>Price: &pound;'.$escape($p['price']).' GBP</p>';
        }
        if ($p['availability']) {
            $lines[] = '<p>Availability: '.$escape($p['availability']).'</p>';
        }
        if ($p['category']) {
            $lines[] = '<p>Category: '.$escape($p['category']).'</p>';
        }
        $lines[] = '</div></noscript>';

        return preg_replace('/<\/body>/i', implode('', $lines).'</body>', $html, 1) ?? $html;
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Build the static meta map for known pages.
     */
    private function buildStaticMeta(Collection $settings, string $siteName): array
    {
        return [
            'about' => [
                'title' => 'About Us | '.$siteName,
                'description' => $this->normalizeText($settings->get('about_subtitle') ?: $settings->get('about_content_1')),
            ],
            'contact' => [
                'title' => 'Contact | '.$siteName,
                'description' => $this->normalizeText($settings->get('contact_welcome', 'Get in touch with Midia M Metal for custom metal fabrication and ventilation enquiries.')),
            ],
            'shop' => [
                'title' => 'Shop | '.$siteName,
                'description' => 'Browse commercial kitchen products, grease filters, canopies, ventilation parts, and stainless steel fabrication items.',
            ],
            'services' => [
                'title' => 'Services | '.$siteName,
                'description' => $this->normalizeText($settings->get('services_hero_desc', 'Commercial kitchen ventilation, stainless steel welding, custom fabrication, and canopy installation services.')),
            ],
            'portfolio' => [
                'title' => 'Portfolio | '.$siteName,
                'description' => 'View recent commercial kitchen ventilation, stainless steel fabrication, canopy installation, and custom metalwork projects.',
            ],
            'blog' => [
                'title' => 'Blog | '.$siteName,
                'description' => 'Read insights on commercial kitchen ventilation, stainless steel fabrication, hygiene, and maintenance.',
            ],
            'get-a-quote' => [
                'title' => 'Request a Quote | '.$siteName,
                'description' => 'Request a quote for canopies, ventilation systems, custom fabrication, and stainless steel catering equipment.',
            ],
            'faq' => [
                'title' => ($settings->get('faq_page_title') ?: 'Frequently Asked Questions').' | '.$siteName,
                'description' => $this->normalizeText($settings->get('faq_page_content')),
            ],
            'privacy-policy' => [
                'title' => ($settings->get('privacy_policy_title') ?: 'Privacy Policy').' | '.$siteName,
                'description' => $this->normalizeText($settings->get('privacy_policy_content')),
            ],
            'terms-of-service' => [
                'title' => ($settings->get('terms_conditions_title') ?: 'Terms & Conditions').' | '.$siteName,
                'description' => $this->normalizeText($settings->get('terms_conditions_content')),
            ],
            'returns-policy' => [
                'title' => ($settings->get('returns_refunds_title') ?: 'Returns & Refunds').' | '.$siteName,
                'description' => $this->normalizeText($settings->get('returns_refunds_content')),
            ],
            'cookies' => [
                'title' => ($settings->get('cookies_page_title') ?: 'Cookies Page').' | '.$siteName,
                'description' => $this->normalizeText($settings->get('cookies_page_content')),
            ],
            'cart' => [
                'title' => 'Basket | '.$siteName,
                'description' => 'Review the products in your basket before checkout.',
                'robots' => 'noindex, nofollow',
            ],
            'checkout' => [
                'title' => 'Checkout | '.$siteName,
                'description' => 'Complete your checkout securely.',
                'robots' => 'noindex, nofollow',
            ],
            'payment' => [
                'title' => 'Payment | '.$siteName,
                'description' => 'Secure payment page.',
                'robots' => 'noindex, nofollow',
            ],
            'thank-you' => [
                'title' => 'Order Confirmation | '.$siteName,
                'description' => 'Your order confirmation page.',
                'robots' => 'noindex, nofollow',
            ],
            'login' => [
                'title' => 'Customer Login | '.$siteName,
                'description' => 'Log in to your customer account.',
                'robots' => 'noindex, nofollow',
            ],
            'register' => [
                'title' => 'Create Account | '.$siteName,
                'description' => 'Register for a customer account.',
                'robots' => 'noindex, nofollow',
            ],
            'account' => [
                'title' => 'My Account | '.$siteName,
                'description' => 'Manage your orders, quotes, and saved details.',
                'robots' => 'noindex, nofollow',
            ],
            'forgot-password' => [
                'title' => 'Forgot Password | '.$siteName,
                'description' => 'Reset your customer account password.',
                'robots' => 'noindex, nofollow',
            ],
            'reset-password' => [
                'title' => 'Reset Password | '.$siteName,
                'description' => 'Set a new password for your customer account.',
                'robots' => 'noindex, nofollow',
            ],
            'admin/forgot-password' => [
                'title' => 'Admin Forgot Password | '.$siteName,
                'description' => 'Admin password reset.',
                'robots' => 'noindex, nofollow',
            ],
            'admin/reset-password' => [
                'title' => 'Admin Reset Password | '.$siteName,
                'description' => 'Admin password reset.',
                'robots' => 'noindex, nofollow',
            ],
        ];
    }

    /**
     * Build SEO meta for a category page.
     */
    private function buildCategoryMeta(array $meta, string $slug, string $baseUrl, string $siteName): array
    {
        $category = ProductCategory::where('active', true)->where('slug', $slug)->first();
        if ($category) {
            $meta['title'] = $category->name.' Products | '.$siteName;
            $meta['description'] = $this->normalizeText($category->description ?: ('Browse '.$category->name.' products from '.$siteName.'.'));
            $meta['image'] = $this->absoluteUrl($baseUrl, $category->image);
            $meta['jsonLd'] = [$this->breadcrumbJsonLd([
                ['name' => 'Home', 'url' => $baseUrl.'/'],
                ['name' => 'Shop', 'url' => $this->absoluteUrl($baseUrl, 'shop')],
                ['name' => $category->name, 'url' => $meta['canonical']],
            ])];
        }

        return $meta;
    }

    /**
     * Build SEO meta for a product page. Returns a RedirectResponse for numeric ID → slug.
     *
     * @return array|RedirectResponse
     */
    private function buildProductMeta(array $meta, string $identifier, string $baseUrl, string $siteName, string $defaultImage)
    {
        $product = Product::with('category')
            ->where('active', true)
            ->where(fn ($query) => $query->where('slug', $identifier)->orWhere('id', $identifier))
            ->first();

        if ($product) {
            // 301 redirect: numeric ID → canonical slug URL
            if ($product->slug && $identifier !== $product->slug && is_numeric($identifier)) {
                return redirect($this->absoluteUrl($baseUrl, 'shop/'.$product->slug), 301);
            }

            $canonicalUrl = $this->absoluteUrl($baseUrl, 'shop/'.($product->slug ?: $identifier));
            $meta['canonical'] = $canonicalUrl;
            $meta['title'] = $product->name.' | '.$siteName;
            $meta['description'] = $this->normalizeText($product->description ?: ($product->category->description ?? $product->name));
            $meta['type'] = 'product';
            $meta['image'] = $this->absoluteUrl($baseUrl, $product->image);
            $stockQuantity = (int) ($product->stock_quantity ?? 0);
            $trackStock = (bool) ($product->track_stock ?? false);
            $availability = (! $trackStock || $stockQuantity > 0)
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock';
            $meta['jsonLd'] = [
                $this->breadcrumbJsonLd(array_values(array_filter([
                    ['name' => 'Home', 'url' => $baseUrl.'/'],
                    ['name' => 'Shop', 'url' => $this->absoluteUrl($baseUrl, 'shop')],
                    $product->category ? ['name' => $product->category->name, 'url' => $this->absoluteUrl($baseUrl, 'shop/category/'.$product->category->slug)] : null,
                    ['name' => $product->name, 'url' => $canonicalUrl],
                ]))),
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'Product',
                    'name' => $product->name,
                    'description' => $this->normalizeText($product->description ?: $product->name, 500),
                    'image' => [$this->absoluteUrl($baseUrl, $product->image)],
                    'sku' => $product->sku ?? (string) $product->id,
                    'brand' => [
                        '@type' => 'Brand',
                        'name' => $siteName,
                    ],
                    ...($product->price_on_request ? [] : ['offers' => [
                        '@type' => 'Offer',
                        'url' => $canonicalUrl,
                        'priceCurrency' => 'GBP',
                        'price' => preg_replace('/[^\d.]/', '', (string) $product->price),
                        'availability' => $availability,
                        'seller' => [
                            '@type' => 'Organization',
                            'name' => $siteName,
                        ],
                    ]]),
                ],
            ];
            $meta['_product_noscript'] = [
                'price_on_request' => $product->price_on_request,
                'name' => $product->name,
                'description' => $this->normalizeText($product->description ?: $product->name, 300),
                'price' => preg_replace('/[^\d.]/', '', (string) $product->price),
                'category' => $product->category->name ?? null,
                'availability' => $trackStock ? ($stockQuantity > 0 ? 'In Stock' : 'Out of Stock') : 'Available',
            ];
        }

        return $meta;
    }

    /**
     * Build SEO meta for a service page.
     */
    private function buildServiceMeta(array $meta, string $slug, string $baseUrl, string $siteName, string $defaultImage): array
    {
        $service = Service::where('active', true)->where('slug', $slug)->first();
        if ($service) {
            $meta['title'] = $service->title.' | '.$siteName;
            $meta['description'] = $this->normalizeText($service->excerpt ?: $service->content ?: $service->title);
            $meta['image'] = $service->image ? $this->absoluteUrl($baseUrl, $service->image) : $defaultImage;
            $meta['jsonLd'] = [
                $this->breadcrumbJsonLd([
                    ['name' => 'Home', 'url' => $baseUrl.'/'],
                    ['name' => 'Services', 'url' => $this->absoluteUrl($baseUrl, 'services')],
                    ['name' => $service->title, 'url' => $meta['canonical']],
                ]),
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'Service',
                    'name' => $service->title,
                    'description' => $this->normalizeText($service->excerpt ?: $service->content ?: $service->title, 500),
                    'provider' => [
                        '@type' => 'Organization',
                        'name' => $siteName,
                        'url' => $baseUrl.'/',
                    ],
                ],
            ];
        }

        return $meta;
    }

    /**
     * Build SEO meta for a portfolio page.
     */
    private function buildPortfolioMeta(array $meta, string $slug, string $baseUrl, string $siteName, string $defaultImage): array
    {
        $project = PortfolioProject::where('active', true)->where('slug', $slug)->first();
        if ($project) {
            $meta['title'] = $project->title.' | '.$siteName;
            $meta['description'] = $this->normalizeText($project->description ?: $project->title);
            $meta['image'] = $project->image ? $this->absoluteUrl($baseUrl, $project->image) : $defaultImage;
            $meta['jsonLd'] = [$this->breadcrumbJsonLd([
                ['name' => 'Home', 'url' => $baseUrl.'/'],
                ['name' => 'Portfolio', 'url' => $this->absoluteUrl($baseUrl, 'portfolio')],
                ['name' => $project->title, 'url' => $meta['canonical']],
            ])];
        }

        return $meta;
    }

    /**
     * Build SEO meta for a blog post page. Returns a RedirectResponse for numeric ID → slug.
     *
     * @return array|RedirectResponse
     */
    private function buildBlogMeta(array $meta, string $identifier, string $baseUrl, string $siteName, string $defaultImage)
    {
        $post = BlogPost::where('active', true)
            ->where(fn ($query) => $query->where('slug', $identifier)->orWhere('id', $identifier))
            ->first();

        if ($post) {
            // 301 redirect: numeric ID → canonical slug URL
            if ($post->slug && $identifier !== $post->slug && is_numeric($identifier)) {
                return redirect($this->absoluteUrl($baseUrl, 'blog/'.$post->slug), 301);
            }

            $canonicalUrl = $this->absoluteUrl($baseUrl, 'blog/'.($post->slug ?: $identifier));
            $meta['canonical'] = $canonicalUrl;
            $meta['title'] = $post->title.' | '.$siteName;
            $meta['description'] = $this->normalizeText($post->excerpt ?: $post->content ?: $post->title);
            $meta['type'] = 'article';
            $meta['image'] = $post->image ? $this->absoluteUrl($baseUrl, $post->image) : $defaultImage;
            $meta['jsonLd'] = [
                $this->breadcrumbJsonLd([
                    ['name' => 'Home', 'url' => $baseUrl.'/'],
                    ['name' => 'Blog', 'url' => $this->absoluteUrl($baseUrl, 'blog')],
                    ['name' => $post->title, 'url' => $canonicalUrl],
                ]),
                [
                    '@context' => 'https://schema.org',
                    '@type' => 'Article',
                    'headline' => $post->title,
                    'description' => $this->normalizeText($post->excerpt ?: $post->content ?: $post->title),
                    'image' => [$meta['image']],
                    'author' => [
                        '@type' => 'Person',
                        'name' => $post->author ?: 'Admin',
                    ],
                    'publisher' => [
                        '@type' => 'Organization',
                        'name' => $siteName,
                        'logo' => [
                            '@type' => 'ImageObject',
                            'url' => $defaultImage,
                        ],
                    ],
                    'datePublished' => optional($post->published_at)->toAtomString(),
                    'dateModified' => optional($post->updated_at)->toAtomString(),
                    'mainEntityOfPage' => $canonicalUrl,
                ],
            ];
        }

        return $meta;
    }
}
