<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class ProductPdfMedia
{
    private array $images = [];

    private const MAX_BYTES = 8 * 1024 * 1024;

    public function __construct(private ?string $siteOrigin = null) {}

    public function image(string $source): ?array
    {
        if (array_key_exists($source, $this->images)) {
            return $this->images[$source];
        }
        $this->images[$source] = null;
        $bytes = $this->read($source);
        $size = $bytes ? @getimagesizefromstring($bytes) : false;
        if (! $size || $size[0] * $size[1] > 24000000 || ! in_array($size['mime'], ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
            return null;
        }
        $original = @imagecreatefromstring($bytes);
        if (! $original) {
            return null;
        }
        $scale = min(1, 1600 / max($size[0], $size[1]));
        $width = max(1, (int) round($size[0] * $scale));
        $height = max(1, (int) round($size[1] * $scale));
        $resized = imagecreatetruecolor($width, $height);
        imagefill($resized, 0, 0, imagecolorallocate($resized, 255, 255, 255));
        imagecopyresampled($resized, $original, 0, 0, 0, 0, $width, $height, $size[0], $size[1]);
        ob_start();
        imagejpeg($resized, null, 88);
        $jpeg = ob_get_clean();
        unset($resized, $original);

        return $this->images[$source] = ['src' => 'data:image/jpeg;base64,'.base64_encode($jpeg), 'width' => $width, 'height' => $height];
    }

    public function markup(string $source, string $alt, int $maxWidth = 640, int $maxHeight = 380): string
    {
        $image = $this->image($source);
        if (! $image) {
            return '<span class="image-unavailable">'.e($alt ?: 'Product image unavailable').'</span>';
        }
        $scale = min(1, $maxWidth / $image['width'], $maxHeight / $image['height']);

        return '<img src="'.$image['src'].'" alt="'.e($alt).'" width="'.(int) round($image['width'] * $scale).'" height="'.(int) round($image['height'] * $scale).'" />';
    }

    private function read(string $source): ?string
    {
        if (strlen($source) > self::MAX_BYTES * 1.4) {
            return null;
        }
        if (preg_match('#^data:image/(?:png|jpeg|gif|webp);base64,(.+)$#s', $source, $match)) {
            $bytes = base64_decode($match[1], true);

            return $bytes !== false && strlen($bytes) <= self::MAX_BYTES ? $bytes : null;
        }
        $parts = parse_url($source);
        if ($parts === false || isset($parts['user']) || isset($parts['pass']) || (isset($parts['scheme']) && ! in_array($parts['scheme'], ['http', 'https'], true))) {
            return null;
        }
        $localHosts = array_filter([
            parse_url(config('app.url'), PHP_URL_HOST),
            parse_url(config('app.frontend_url') ?: '', PHP_URL_HOST),
            parse_url($this->siteOrigin ?: '', PHP_URL_HOST),
            request()->getHost(),
        ]);
        if (app()->environment(['local', 'testing'])) {
            $localHosts = array_merge($localHosts, ['localhost', '127.0.0.1']);
        }
        if (isset($parts['host']) && ! in_array($parts['host'], $localHosts, true)) {
            return $this->readRemote($source, $parts);
        }

        $path = rawurldecode($parts['path'] ?? '');
        if (str_contains($path, "\0") || str_contains($path, '\\') || preg_match('#(?:^|/)\.\.?(?:/|$)#', $path)) {
            return null;
        }
        $path = '/'.ltrim($path, '/');
        if (str_starts_with($path, '/uploads/')) {
            $path = '/storage'.$path;
        }
        $bundled = str_starts_with($path, '/images/');
        $roots = $bundled ? config('product_pdf.image_roots', []) : (str_starts_with($path, '/storage/') ? [storage_path('app/public')] : []);
        if (! $roots) {
            return null;
        }
        $relative = preg_replace('#^/(images|storage)/#', '', $path);
        foreach ($roots as $root) {
            $root = realpath($root);
            $file = $root ? realpath($root.DIRECTORY_SEPARATOR.$relative) : false;
            if ($file && str_starts_with($file, $root.DIRECTORY_SEPARATOR) && is_file($file) && filesize($file) <= self::MAX_BYTES) {
                return file_get_contents($file) ?: null;
            }
        }

        // Separate frontend/backend deployments may not share bundled assets.
        // Fetch only from the configured HTTPS frontend, never a client-supplied origin.
        if ($bundled) {
            $url = rtrim((string) config('app.frontend_url'), '/').'/images/'.implode('/', array_map('rawurlencode', explode('/', $relative)));
            $parts = parse_url($url);
            if ($parts && isset($parts['host'])) {
                return $this->readRemote($url, $parts, [$parts['host']]);
            }
        }

        return null;
    }

    private function readRemote(string $source, array $parts, ?array $allowedHosts = null): ?string
    {
        if (($parts['scheme'] ?? '') !== 'https' || (isset($parts['port']) && $parts['port'] !== 443)
            || ! in_array($parts['host'], $allowedHosts ?? config('product_pdf.remote_image_hosts', []), true)) {
            return null;
        }
        try {
            $response = Http::connectTimeout(3)->timeout(8)->withoutRedirecting()->withOptions(['stream' => true])->get($source);
            if (! $response->successful()) {
                return null;
            }
            $stream = $response->toPsrResponse()->getBody();
            $bytes = '';
            while (! $stream->eof() && strlen($bytes) <= self::MAX_BYTES) {
                $bytes .= $stream->read(65536);
            }
            $stream->close();

            return strlen($bytes) <= self::MAX_BYTES ? $bytes : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
