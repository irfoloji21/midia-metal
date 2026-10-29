<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\ProductPdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductPdfController extends Controller
{
    public function __invoke(string $id, Request $request, ProductPdf $pdf)
    {
        $product = Product::with('category')->where('active', true)->where('pdf_download_enabled', true)
            ->where(fn ($query) => $query->where('id', $id)->orWhere('slug', $id))->firstOrFail();

        $filename = (Str::slug($product->product_code ?: $product->name) ?: 'product-'.$product->id).'-product-information.pdf';

        return response($pdf->render($product, $this->siteOrigin($request)), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function siteOrigin(Request $request): string
    {
        // Keep the browser's current site domain across the API proxy, but only
        // accept configured site origins (never an arbitrary QR destination).
        $origin = static function (?string $url): ?string {
            if (! $url || strlen($url) > 2048 || preg_match('/[\x00-\x20\\\\]/', $url)) {
                return null;
            }
            $parts = parse_url($url);
            if (! $parts || ! isset($parts['scheme'], $parts['host']) || isset($parts['user']) || isset($parts['pass'])
                || ! in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
                return null;
            }
            $scheme = strtolower($parts['scheme']);
            $port = $parts['port'] ?? null;
            $suffix = $port && $port !== ($scheme === 'https' ? 443 : 80) ? ':'.$port : '';

            return $scheme.'://'.strtolower($parts['host']).$suffix;
        };
        $fallback = $origin(config('app.frontend_url')) ?? $origin(config('app.url')) ?? $request->getSchemeAndHttpHost();
        $allowed = array_filter(array_map($origin, [
            $fallback, $request->getSchemeAndHttpHost(), ...config('cors.allowed_origins', []),
        ]));
        foreach ([$request->header('X-Site-Origin'), $request->header('Origin'), $request->header('Referer')] as $candidate) {
            $candidate = $origin($candidate);
            if ($candidate && in_array($candidate, $allowed, true)) {
                return $candidate;
            }
        }

        return $fallback;
    }
}
