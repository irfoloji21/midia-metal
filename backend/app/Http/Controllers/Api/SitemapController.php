<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\PortfolioProject;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Service;

class SitemapController extends Controller
{
    public function __invoke()
    {
        $entries = [];
        foreach ([Product::class => '/shop/', ProductCategory::class => '/shop/category/', BlogPost::class => '/blog/', Service::class => '/services/', PortfolioProject::class => '/portfolio/'] as $model => $prefix) {
            foreach ($model::where('active', true)->orderBy('id')->get(['id', 'slug', 'updated_at']) as $record) {
                if (! $record->slug && $model === ProductCategory::class) {
                    continue;
                }
                $entries[] = ['path' => $prefix.rawurlencode($record->slug ?: $record->id), 'lastmod' => $record->updated_at?->toAtomString()];
            }
        }

        return response()->json($entries);
    }
}
