<?php

namespace App\Services;

use App\Models\Product;
use App\Support\HtmlSanitizer;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Dompdf\Dompdf;
use Dompdf\Options;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Support\Facades\File;

class ProductPdf
{
    public function render(Product $product, string $siteOrigin): string
    {
        $media = new ProductPdfMedia($siteOrigin);
        $productUrl = rtrim($siteOrigin, '/').'/shop/'.rawurlencode($product->slug ?: (string) $product->id);
        $qrCode = (new PngWriter)->write(new QrCode(
            data: $productUrl, errorCorrectionLevel: ErrorCorrectionLevel::Medium, size: 360, margin: 40,
        ))->getDataUri();
        $directory = storage_path('framework/product-pdf');
        File::ensureDirectoryExists($directory);
        $options = new Options([
            'isRemoteEnabled' => false,
            'isPhpEnabled' => false,
            'isJavascriptEnabled' => false,
            'defaultFont' => 'DejaVu Sans',
            'tempDir' => $directory,
            'fontDir' => $directory,
            'fontCache' => $directory,
            'chroot' => [$directory],
        ]);
        $pdf = new Dompdf($options);
        $pdf->setPaper('A4');
        $pdf->loadHtml(view('pdf.product', [
            'product' => $product,
            'description' => $this->description($product, $media, $siteOrigin),
            'gallery' => $this->gallery($product, $media),
            'productUrl' => $productUrl,
            'siteDomain' => preg_replace('#^https?://#', '', $siteOrigin),
            'qrCode' => $qrCode,
            'variantDetails' => $this->variants($product),
            'generatedAt' => now()->utc()->format('d M Y, H:i').' UTC',
        ])->render(), 'UTF-8');
        $pdf->render();
        $pdf->getCanvas()->page_text(470, 810, '{PAGE_NUM} / {PAGE_COUNT}', $pdf->getFontMetrics()->getFont('DejaVu Sans'), 8, [0.4, 0.45, 0.52]);

        return $pdf->output();
    }

    public function description(Product $product, ProductPdfMedia $media, ?string $siteOrigin = null): string
    {
        $html = (string) $product->description;
        if (! preg_match('/<[a-z][^>]*>/i', $html)) {
            $html = '<p>'.nl2br(e($html)).'</p>';
        }
        $html = HtmlSanitizer::richText($html);
        $specs = $this->specifications($product);
        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8"><html><body>'.$html.'</body></html>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        $xpath = new DOMXPath($document);
        $hasSpecifications = false;

        foreach (iterator_to_array($xpath->query('//*[@class]')) as $element) {
            $classes = preg_split('/\s+/', $element->getAttribute('class'));
            if (in_array('product-spec-slot', $classes, true)) {
                $this->replaceHtml($document, $element, $hasSpecifications ? '' : $specs);
                $hasSpecifications = true;
            }
        }
        // Web editor sizing/floats can overflow a printed page; print styles own sizing.
        foreach ($xpath->query('//*[@style]') as $element) {
            $element->removeAttribute('style');
        }
        foreach (iterator_to_array($xpath->query('//img')) as $image) {
            $columns = 1;
            for ($parent = $image->parentNode; $parent instanceof DOMElement; $parent = $parent->parentNode) {
                if (str_contains($parent->getAttribute('class'), 'img-row')) {
                    $columns = str_contains($parent->getAttribute('class'), 'img-row--3') ? 3 : 2;
                    break;
                }
            }
            $this->replaceHtml($document, $image, $media->markup($image->getAttribute('src'), $image->getAttribute('alt'), $columns === 1 ? 640 : ($columns === 2 ? 295 : 190), $columns === 1 ? 360 : 220));
        }
        // Dompdf supports tables, rather than CSS grid, for side-by-side images.
        foreach (iterator_to_array($xpath->query('//div[contains(concat(" ", normalize-space(@class), " "), " img-row ")]')) as $row) {
            $columns = str_contains($row->getAttribute('class'), 'img-row--3') ? 3 : 2;
            $items = [];
            foreach ($row->childNodes as $child) {
                if ($child instanceof DOMElement) {
                    $items[] = $document->saveHTML($child);
                }
            }
            $this->replaceHtml($document, $row, $this->imageRows($items, $columns));
        }
        foreach ($xpath->query('//a[@href]') as $link) {
            $href = $link->getAttribute('href');
            if (str_starts_with($href, '/') && ! str_starts_with($href, '//')) {
                $link->setAttribute('href', rtrim($siteOrigin ?? (config('app.frontend_url') ?: config('app.url')), '/').$href);
            } elseif (! preg_match('#^(https?://|mailto:|\#)#i', $href)) {
                $link->removeAttribute('href');
            }
        }
        $result = '';
        foreach ($document->getElementsByTagName('body')->item(0)->childNodes as $child) {
            $result .= $document->saveHTML($child);
        }

        return $result.($hasSpecifications ? '' : $specs);
    }

    private function replaceHtml(DOMDocument $document, DOMElement $element, string $html): void
    {
        $fragment = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $fragment->loadHTML('<?xml encoding="UTF-8"><html><body>'.$html.'</body></html>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        foreach (iterator_to_array($fragment->getElementsByTagName('body')->item(0)->childNodes) as $node) {
            $element->parentNode->insertBefore($document->importNode($node, true), $element);
        }
        $element->parentNode->removeChild($element);
    }

    private function specifications(Product $product): string
    {
        $rows = '';
        foreach (($product->specifications ?? []) as $key => $value) {
            if (is_array($value)) {
                $key = $value['key'] ?? '';
                $value = $value['value'] ?? '';
            }
            if (is_scalar($value) && trim((string) $key) !== '' && trim((string) $value) !== '') {
                $rows .= '<tr><th>'.e($key).'</th><td>'.e($value).'</td></tr>';
            }
        }

        return $rows ? '<h2>Technical specifications</h2><table class="specifications"><tbody>'.$rows.'</tbody></table>' : '';
    }

    private function gallery(Product $product, ProductPdfMedia $media): string
    {
        $sources = array_values(array_unique(array_filter([$product->image, ...($product->gallery ?? [])], 'is_string')));
        $items = [];
        foreach ($sources as $index => $source) {
            if ($source !== '' && $media->image($source)) {
                $items[] = $media->markup($source, $product->name.' - view '.($index + 1), 295, 220);
            }
        }

        return $this->imageRows($items, 2);
    }

    private function imageRows(array $items, int $columns): string
    {
        $html = '';
        foreach (array_chunk($items, $columns) as $row) {
            $html .= '<table class="image-row"><tbody><tr>';
            foreach ($row as $item) {
                $html .= '<td style="width:'.(100 / $columns).'%">'.$item.'</td>';
            }
            $html .= '</tr></tbody></table>';
        }

        return $html;
    }

    private function variants(Product $product): array
    {
        $rows = [];
        foreach (($product->variants ?? []) as $variant) {
            $attributes = $variant['attributes'] ?? [($variant['option'] ?? '') => ($variant['value'] ?? '')];
            $details = [];
            foreach ($attributes as $key => $value) {
                if (is_scalar($value) && trim((string) $key) !== '' && trim((string) $value) !== '') {
                    $details[] = $key.': '.$value;
                }
            }
            foreach (array_merge(...array_values($product->variant_table_columns ?: ['general' => []])) as $column) {
                if (! ($column['frontendVisible'] ?? false) || ! ($column['visible'] ?? true)) {
                    continue;
                }
                $key = $column['key'] ?? '';
                $customKey = str_starts_with($key, 'custom:') ? substr($key, 7) : $key;
                $value = $variant['custom_fields'][$customKey] ?? $variant[$key] ?? null;
                if (in_array($key, ['option', 'value'], true)) {
                    continue;
                }
                if (is_scalar($value) && trim((string) $value) !== '') {
                    $details[] = ($column['label'] ?? $key).': '.$value;
                }
            }
            if ($details) {
                $rows[] = implode(' | ', array_unique($details));
            }
        }

        return array_values(array_unique($rows));
    }
}
