<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeroSlide;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\SiteSetting;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'search' => 'nullable|string|max:200',
            'per_page' => 'nullable|integer|min:1|max:500',
        ]);

        $perPage = max(1, min((int) $request->integer('per_page', 18), 500));

        $query = Product::with('category')->where('active', true);

        if ($request->category) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $request->category));
        }
        if ($request->search) {
            $query->where('name', 'like', "%{$request->search}%");
        }
        if ($request->tag) {
            $query->whereJsonContains('tags', $request->tag);
        }
        if ($request->featured) {
            $query->where('featured', true);
        }
        if ($request->boolean('in_stock')) {
            $query->where(function ($q) {
                $q->where('track_stock', false)
                    ->orWhereNull('track_stock')
                    ->orWhere('stock_quantity', '>', 0);
            });
        }

        $products = $query->orderBy('order')->orderBy('id')->paginate($perPage);
        $products->getCollection()->each->makeHidden(['description', 'gallery']);

        return response()->json($products);
    }

    public function show($id)
    {
        $product = Product::with(['category', 'reviews.customer:id,name'])->where('active', true)
            ->where(fn ($q) => $q->where('id', $id)->orWhere('slug', $id))
            ->firstOrFail();

        $configuredFrontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $frontendUrl = $configuredFrontendUrl !== '' && ! preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i', $configuredFrontendUrl)
            ? $configuredFrontendUrl
            : rtrim((string) request()->getSchemeAndHttpHost(), '/');
        $productPath = '/shop/'.($product->slug ?: $product->id);
        $shareUrl = $frontendUrl.$productPath;
        $shareText = $product->name.' | Midia M Metal';

        $instagramUrl = trim((string) SiteSetting::where('key', 'social_instagram')->value('value'));
        if ($instagramUrl !== '' && ! preg_match('/^https?:\/\//i', $instagramUrl)) {
            $instagramUrl = 'https://'.$instagramUrl;
        }

        $payload = $product->toArray();
        $payload['share_url'] = $shareUrl;
        $payload['share_links'] = [
            'facebook' => 'https://www.facebook.com/sharer/sharer.php?u='.urlencode($shareUrl),
            'twitter' => 'https://twitter.com/intent/tweet?url='.urlencode($shareUrl).'&text='.urlencode($shareText),
            'instagram' => $instagramUrl !== '' ? $instagramUrl : 'https://www.instagram.com/',
        ];

        return response()->json($payload);
    }

    public function related($id)
    {
        $product = Product::where('id', $id)->orWhere('slug', $id)->firstOrFail();

        $related = Product::with('category')
            ->where('active', true)
            ->where('id', '!=', $product->id)
            ->where('product_category_id', $product->product_category_id)
            ->orderBy('order')
            ->take(4)
            ->get();

        if ($related->count() < 4) {
            $extraIds = $related->pluck('id')->push($product->id);
            $extras = Product::with('category')
                ->where('active', true)
                ->whereNotIn('id', $extraIds)
                ->orderBy('order')
                ->take(4 - $related->count())
                ->get();
            $related = $related->concat($extras);
        }

        return response()->json($related->each->makeHidden(['description', 'gallery']));
    }

    public function categories()
    {
        return response()->json(
            ProductCategory::where('active', true)
                ->withCount(['products' => fn ($q) => $q->where('active', true)])
                ->orderBy('order')
                ->get()
        );
    }

    public function categoryDetail($slug)
    {
        return response()->json(
            ProductCategory::where('active', true)
                ->where('slug', $slug)
                ->firstOrFail()
        );
    }

    public function tags()
    {
        // Fetch all product tags and flatten them
        $tags = Product::where('active', true)
            ->whereNotNull('tags')
            ->pluck('tags')
            ->flatten()
            ->unique()
            ->values();

        return response()->json($tags);
    }

    public function featured()
    {
        return response()->json(
            Product::with('category')
                ->where('active', true)
                ->where('featured', true)
                ->orderBy('order')
                ->get()->each->makeHidden(['description', 'gallery'])
        );
    }

    public function heroSlides()
    {
        return response()->json(HeroSlide::where('active', true)->orderBy('order')->get());
    }
}
