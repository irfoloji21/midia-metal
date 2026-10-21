<?php

namespace App\Services;

use App\Models\BlogPost;
use App\Models\PortfolioProject;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;
use Illuminate\Http\Request;

class BotContentService
{
    public function __construct(
        private SeoMetaService $seoMeta,
    ) {}

    /**
     * Check if the request user-agent belongs to a known search bot.
     */
    public function isBot(Request $request): bool
    {
        $ua = strtolower($request->userAgent() ?? '');
        if ($ua === '') {
            return false;
        }
        $bots = [
            'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
            'yandexbot', 'facebot', 'twitterbot', 'linkedinbot', 'applebot',
            'semrushbot', 'ahrefsbot', 'mj12bot', 'rogerbot', 'dotbot',
        ];
        foreach ($bots as $bot) {
            if (str_contains($ua, $bot)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build semantic HTML content for a bot request based on the path.
     *
     * Returns null if no bot-specific content is available for the path.
     */
    public function buildBotHtml(Request $request, array $meta): ?string
    {
        $path = trim($request->path(), '/');
        $baseUrl = $this->seoMeta->resolveBaseUrl($request);
        $e = fn (string $v) => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');

        // ── Product detail ──────────────────────────────────────────────
        if (preg_match('#^shop/([^/]+)$#', $path, $m)) {
            return $this->buildProductBotHtml($m[1], $baseUrl, $e);
        }

        // ── Blog post ───────────────────────────────────────────────────
        if (preg_match('#^blog/([^/]+)$#', $path, $m)) {
            return $this->buildBlogBotHtml($m[1], $baseUrl, $e);
        }

        // ── Category page ───────────────────────────────────────────────
        if (preg_match('#^shop/category/([^/]+)$#', $path, $m)) {
            return $this->buildCategoryBotHtml($m[1], $baseUrl, $e);
        }

        // ── Shop listing ────────────────────────────────────────────────
        if ($path === 'shop') {
            return $this->buildShopListingBotHtml($baseUrl, $e);
        }

        // ── Services listing ────────────────────────────────────────────
        if ($path === 'services') {
            return $this->buildServicesListingBotHtml($baseUrl, $e);
        }

        // ── Service detail ──────────────────────────────────────────────
        if (preg_match('#^services/([^/]+)$#', $path, $m)) {
            return $this->buildServiceBotHtml($m[1], $baseUrl, $e);
        }

        // ── Portfolio detail ────────────────────────────────────────────
        if (preg_match('#^portfolio/([^/]+)$#', $path, $m)) {
            return $this->buildPortfolioBotHtml($m[1], $baseUrl, $e);
        }

        // ── Blog listing ────────────────────────────────────────────────
        if ($path === 'blog') {
            return $this->buildBlogListingBotHtml($baseUrl, $e);
        }

        // ── Homepage ────────────────────────────────────────────────────
        if ($path === '') {
            return $this->buildHomepageBotHtml($meta, $baseUrl, $e);
        }

        return null;
    }

    /**
     * Wrap bot HTML content in a hidden off-screen div and inject before </body>.
     */
    public function injectBotContent(string $html, ?string $botHtml): string
    {
        if (! $botHtml) {
            return $html;
        }
        $wrapper = '<div id="ssr-content" style="position:absolute;left:-9999px;top:0;width:1px;';
        $wrapper .= 'height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;" ';
        $wrapper .= 'aria-hidden="true">'.$botHtml.'</div>';

        return preg_replace('/<\/body>/i', $wrapper.'</body>', $html, 1) ?? $html;
    }

    // =========================================================================
    // Private bot HTML builders
    // =========================================================================

    private function buildProductBotHtml(string $identifier, string $baseUrl, \Closure $e): ?string
    {
        $product = Product::with(['category', 'reviews'])
            ->where('active', true)
            ->where(fn ($q) => $q->where('slug', $identifier)->orWhere('id', $identifier))
            ->first();
        if (! $product) {
            return null;
        }
        $price = preg_replace('/[^\d.]/', '', (string) $product->price);
        $trackStock = (bool) ($product->track_stock ?? false);
        $stock = (int) ($product->stock_quantity ?? 0);
        $avail = (! $trackStock || $stock > 0) ? 'In Stock' : 'Out of Stock';
        $catName = $product->category->name ?? null;
        $catSlug = $product->category->slug ?? null;
        $desc = $this->seoMeta->normalizeText($product->description ?: $product->name, 400);
        $specs = is_array($product->specifications) ? $product->specifications : [];

        $html = '<main>';
        $html .= '<nav><a href="'.$e($baseUrl.'/shop').'">Shop</a>';
        if ($catSlug) {
            $html .= ' &rsaquo; <a href="'.$e($baseUrl.'/shop/category/'.$catSlug).'">'.$e($catName).'</a>';
        }
        $html .= ' &rsaquo; '.$e($product->name).'</nav>';
        $html .= '<h1>'.$e($product->name).'</h1>';
        if ($product->price_on_request) {
            $html .= '<p><a href="'.$e($baseUrl.'/get-a-quote').'">Contact us for price</a></p>';
        } elseif ($price) {
            $html .= '<p><strong>Price:</strong> &pound;'.$e($price).'</p>';
        }
        $html .= '<p><strong>Availability:</strong> '.$e($avail).'</p>';
        if ($catName) {
            $html .= '<p><strong>Category:</strong> <a href="'.$e($baseUrl.'/shop/category/'.$catSlug).'">'.$e($catName).'</a></p>';
        }
        if ($desc) {
            $html .= '<p>'.$e($desc).'</p>';
        }
        if (! empty($specs)) {
            $html .= '<table><caption>Specifications</caption><tbody>';
            foreach ($specs as $k => $v) {
                $html .= '<tr><th>'.$e((string) $k).'</th><td>'.$e((string) $v).'</td></tr>';
            }
            $html .= '</tbody></table>';
        }
        // related products via category
        if ($catSlug) {
            $related = Product::where('active', true)
                ->where('product_category_id', $product->product_category_id)
                ->where('id', '!=', $product->id)
                ->limit(4)
                ->get();
            if ($related->isNotEmpty()) {
                $html .= '<section><h2>Related Products</h2><ul>';
                foreach ($related as $rel) {
                    $relUrl = $baseUrl.'/shop/'.($rel->slug ?: $rel->id);
                    $html .= '<li><a href="'.$e($relUrl).'">'.$e($rel->name).'</a>';
                    if ($rel->price_on_request) {
                        $html .= ' &mdash; Contact us for price';
                    } elseif ($rel->price) {
                        $rp = preg_replace('/[^\d.]/', '', (string) $rel->price);
                        $html .= ' &mdash; &pound;'.$e($rp);
                    }
                    $html .= '</li>';
                }
                $html .= '</ul></section>';
            }
        }
        $html .= '</main>';

        return $html;
    }

    private function buildBlogBotHtml(string $identifier, string $baseUrl, \Closure $e): ?string
    {
        $post = BlogPost::where('active', true)
            ->where(fn ($q) => $q->where('slug', $identifier)->orWhere('id', $identifier))
            ->first();
        if (! $post) {
            return null;
        }
        $date = optional($post->published_at ?? $post->created_at)->format('F j, Y') ?? '';
        $excerpt = $this->seoMeta->normalizeText($post->excerpt ?: $post->content ?: '', 200);

        $html = '<main><article>';
        $html .= '<nav><a href="'.$e($baseUrl.'/blog').'">Blog</a> &rsaquo; '.$e($post->title).'</nav>';
        $html .= '<h1>'.$e($post->title).'</h1>';
        if ($date) {
            $html .= '<p><time datetime="'.$e($date).'">'.$e($date).'</time>';
        }
        if ($post->author) {
            $html .= ' &mdash; By '.$e($post->author);
        }
        if ($date || $post->author) {
            $html .= '</p>';
        }
        if ($excerpt) {
            $html .= '<p>'.$e($excerpt).'</p>';
        }
        if ($post->content) {
            $clean = preg_replace('/<(script|style)[^>]*>.*?<\/\1>/is', '', $post->content) ?? $post->content;
            $html .= '<div>'.$clean.'</div>';
        }
        $html .= '</article></main>';

        return $html;
    }

    private function buildCategoryBotHtml(string $slug, string $baseUrl, \Closure $e): ?string
    {
        $category = ProductCategory::where('active', true)->where('slug', $slug)->first();
        if (! $category) {
            return null;
        }
        $products = Product::where('active', true)
            ->where('product_category_id', $category->id)
            ->orderBy('order')
            ->limit(48)
            ->get();

        $html = '<main>';
        $html .= '<nav><a href="'.$e($baseUrl.'/shop').'">Shop</a> &rsaquo; '.$e($category->name).'</nav>';
        $html .= '<h1>'.$e($category->name).' Products</h1>';
        if ($category->description) {
            $html .= '<p>'.$e($this->seoMeta->normalizeText($category->description, 300)).'</p>';
        }
        if ($products->isNotEmpty()) {
            $html .= '<ul>';
            foreach ($products as $product) {
                $pUrl = $baseUrl.'/shop/'.($product->slug ?: $product->id);
                $price = preg_replace('/[^\d.]/', '', (string) $product->price);
                $html .= '<li>';
                $html .= '<a href="'.$e($pUrl).'"><strong>'.$e($product->name).'</strong></a>';
                if ($product->price_on_request) {
                    $html .= ' &mdash; Contact us for price';
                } elseif ($price) {
                    $html .= ' &mdash; &pound;'.$e($price);
                }
                if ($product->description) {
                    $html .= '<p>'.$e($this->seoMeta->normalizeText($product->description, 120)).'</p>';
                }
                $html .= '</li>';
            }
            $html .= '</ul>';
        }
        $html .= '</main>';

        return $html;
    }

    private function buildShopListingBotHtml(string $baseUrl, \Closure $e): string
    {
        $products = Product::with('category')
            ->where('active', true)
            ->orderBy('order')
            ->limit(48)
            ->get();

        $html = '<main>';
        $html .= '<h1>Shop &mdash; Commercial Kitchen Products</h1>';
        $html .= '<p>Browse our range of commercial kitchen ventilation, grease filters, canopies, and stainless steel fabrication products.</p>';
        if ($products->isNotEmpty()) {
            $html .= '<ul>';
            foreach ($products as $product) {
                $pUrl = $baseUrl.'/shop/'.($product->slug ?: $product->id);
                $price = preg_replace('/[^\d.]/', '', (string) $product->price);
                $html .= '<li>';
                $html .= '<a href="'.$e($pUrl).'"><strong>'.$e($product->name).'</strong></a>';
                if ($product->category) {
                    $catUrl = $baseUrl.'/shop/category/'.$product->category->slug;
                    $html .= ' in <a href="'.$e($catUrl).'">'.$e($product->category->name).'</a>';
                }
                if ($product->price_on_request) {
                    $html .= ' &mdash; Contact us for price';
                } elseif ($price) {
                    $html .= ' &mdash; &pound;'.$e($price);
                }
                if ($product->description) {
                    $html .= '<p>'.$e($this->seoMeta->normalizeText($product->description, 120)).'</p>';
                }
                $html .= '</li>';
            }
            $html .= '</ul>';
        }
        $html .= '</main>';

        return $html;
    }

    private function buildServicesListingBotHtml(string $baseUrl, \Closure $e): string
    {
        $services = Service::where('active', true)->orderBy('order')->get();

        $html = '<main>';
        $html .= '<h1>Our Services</h1>';
        $html .= '<p>Commercial kitchen ventilation, stainless steel fabrication, canopy installation and custom metalwork. Our factory is in London.</p>';
        if ($services->isNotEmpty()) {
            $html .= '<ul>';
            foreach ($services as $service) {
                $sUrl = $baseUrl.'/services/'.$service->slug;
                $html .= '<li>';
                $html .= '<a href="'.$e($sUrl).'"><strong>'.$e($service->title).'</strong></a>';
                if ($service->excerpt) {
                    $html .= '<p>'.$e($this->seoMeta->normalizeText($service->excerpt, 150)).'</p>';
                }
                $html .= '</li>';
            }
            $html .= '</ul>';
        }
        $html .= '</main>';

        return $html;
    }

    private function buildServiceBotHtml(string $slug, string $baseUrl, \Closure $e): ?string
    {
        $service = Service::where('active', true)->where('slug', $slug)->first();
        if (! $service) {
            return null;
        }
        $features = is_array($service->features) ? $service->features : [];

        $html = '<main>';
        $html .= '<nav><a href="'.$e($baseUrl.'/services').'">Services</a> &rsaquo; '.$e($service->title).'</nav>';
        $html .= '<h1>'.$e($service->title).'</h1>';
        if ($service->excerpt) {
            $html .= '<p>'.$e($this->seoMeta->normalizeText($service->excerpt, 300)).'</p>';
        }
        if ($service->content) {
            $clean = preg_replace('/<(script|style)[^>]*>.*?<\/\1>/is', '', $service->content) ?? $service->content;
            $html .= '<div>'.$clean.'</div>';
        }
        if (! empty($features)) {
            $html .= '<section><h2>Service Features</h2><ul>';
            foreach ($features as $feature) {
                $html .= '<li>'.$e((string) $feature).'</li>';
            }
            $html .= '</ul></section>';
        }
        $html .= '</main>';

        return $html;
    }

    private function buildPortfolioBotHtml(string $slug, string $baseUrl, \Closure $e): ?string
    {
        $project = PortfolioProject::where('active', true)->where('slug', $slug)->first();
        if (! $project) {
            return null;
        }

        $html = '<main>';
        $html .= '<nav><a href="'.$e($baseUrl.'/portfolio').'">Portfolio</a> &rsaquo; '.$e($project->title).'</nav>';
        $html .= '<h1>'.$e($project->title).'</h1>';
        if ($project->description) {
            $html .= '<p>'.$e($this->seoMeta->normalizeText($project->description, 400)).'</p>';
        }
        $html .= '</main>';

        return $html;
    }

    private function buildBlogListingBotHtml(string $baseUrl, \Closure $e): string
    {
        $posts = BlogPost::where('active', true)
            ->orderByDesc('published_at')
            ->limit(20)
            ->get();

        $html = '<main>';
        $html .= '<h1>Blog &mdash; Insights on Commercial Kitchen Ventilation</h1>';
        if ($posts->isNotEmpty()) {
            $html .= '<ul>';
            foreach ($posts as $post) {
                $pUrl = $baseUrl.'/blog/'.$post->slug;
                $date = optional($post->published_at ?? $post->created_at)->format('F j, Y') ?? '';
                $html .= '<li>';
                $html .= '<a href="'.$e($pUrl).'"><strong>'.$e($post->title).'</strong></a>';
                if ($date) {
                    $html .= ' <time>'.$e($date).'</time>';
                }
                if ($post->excerpt) {
                    $html .= '<p>'.$e($this->seoMeta->normalizeText($post->excerpt, 150)).'</p>';
                }
                $html .= '</li>';
            }
            $html .= '</ul>';
        }
        $html .= '</main>';

        return $html;
    }

    private function buildHomepageBotHtml(array $meta, string $baseUrl, \Closure $e): string
    {
        $featured = Product::with('category')
            ->where('active', true)
            ->where('featured', true)
            ->limit(6)
            ->get();
        $services = Service::where('active', true)->limit(4)->get();

        $siteName = $meta['siteName'] ?? 'Midia M Metal';
        $html = '<main>';
        $html .= '<h1>'.$e($siteName).'</h1>';
        $html .= '<p>Commercial kitchen ventilation, stainless steel fabrication, canopy systems, grease filters and custom metalwork. Our factory is in London.</p>';
        if ($featured->isNotEmpty()) {
            $html .= '<section><h2>Featured Products</h2><ul>';
            foreach ($featured as $product) {
                $pUrl = $baseUrl.'/shop/'.($product->slug ?: $product->id);
                $price = preg_replace('/[^\d.]/', '', (string) $product->price);
                $html .= '<li><a href="'.$e($pUrl).'">'.$e($product->name).'</a>';
                if ($product->price_on_request) {
                    $html .= ' &mdash; Contact us for price';
                } elseif ($price) {
                    $html .= ' &mdash; &pound;'.$e($price);
                }
                $html .= '</li>';
            }
            $html .= '</ul></section>';
        }
        if ($services->isNotEmpty()) {
            $html .= '<section><h2>Our Services</h2><ul>';
            foreach ($services as $service) {
                $sUrl = $baseUrl.'/services/'.$service->slug;
                $html .= '<li><a href="'.$e($sUrl).'">'.$e($service->title).'</a></li>';
            }
            $html .= '</ul></section>';
        }
        $html .= '</main>';

        return $html;
    }
}
