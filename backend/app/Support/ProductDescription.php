<?php

namespace App\Support;

use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ProductDescription
{
    /** Call after sanitization. Keep image bytes intact; store each distinct image once. */
    public static function optimize(string $html): string
    {
        $html = preg_replace_callback('/(<img\b[^>]*?\bsrc=)(["\'])(data:image\/[^"\']+)\2/i', function ($match) {
            if (! preg_match('#^data:image/(png|jpe?g|gif|webp);base64,([a-zA-Z0-9+/=\s]+)$#i', $match[3], $data)) {
                throw ValidationException::withMessages(['description' => 'Please use PNG, JPEG, GIF or WebP images in the description.']);
            }
            $bytes = base64_decode($data[2], true);
            $info = $bytes === false ? false : @getimagesizefromstring($bytes);
            $extensions = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/gif' => 'gif', 'image/webp' => 'webp'];
            if (! $info || ! isset($extensions[$info['mime']]) || strlen($bytes) > 10 * 1024 * 1024 || $info[0] * $info[1] > 40000000) {
                throw ValidationException::withMessages(['description' => 'A description image is invalid or too large. Use images under 10 MB and 40 megapixels.']);
            }
            $path = 'product-content/'.hash('sha256', $bytes).'.'.$extensions[$info['mime']];
            $disk = Storage::disk('public');
            if (! $disk->exists($path) && ! $disk->put($path, $bytes)) {
                throw ValidationException::withMessages(['description' => 'The description image could not be saved. Please try again.']);
            }

            return $match[1].$match[2].e($disk->url($path)).$match[2];
        }, $html);

        if (! str_contains($html, 'word-paste')) {
            return $html;
        }

        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="UTF-8"><html><body>'.$html.'</body></html>', LIBXML_NONET);
            $xpath = new DOMXPath($document);
            $inWord = 'ancestor::div[contains(concat(" ", normalize-space(@class), " "), " word-paste ")]';
            foreach ($xpath->query('//*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6]['.$inWord.']') as $heading) {
                if (preg_match('/\bword-heading-[1-6]\b/', $heading->getAttribute('class'))) {
                    continue;
                }
                $level = (int) substr($heading->tagName, 1);
                $replacement = $document->createElement('h'.min(6, $level + 1));
                foreach ($heading->attributes as $attribute) {
                    $replacement->setAttribute($attribute->name, $attribute->value);
                }
                $replacement->setAttribute('class', 'word-heading-'.$level);
                while ($heading->firstChild) {
                    $replacement->appendChild($heading->firstChild);
                }
                $heading->parentNode->replaceChild($replacement, $heading);
            }
            foreach ($xpath->query('//div[contains(concat(" ", normalize-space(@class), " "), " word-table ")]['.$inWord.']') as $wrapper) {
                $rows = $xpath->query('./table/tr | ./table/tbody/tr', $wrapper);
                if ($rows->length !== 1 || str_contains($wrapper->getAttribute('class'), 'word-table--bordered') || $xpath->query('.//th | .//thead', $wrapper)->length || ! $xpath->query('.//img', $wrapper)->length) {
                    continue;
                }
                $wrapper->setAttribute('class', 'word-table word-table--layout');
                foreach ($xpath->query('./td', $rows->item(0)) as $cell) {
                    if (trim(str_replace("\xc2\xa0", '', $cell->textContent)) === '' && ! $cell->getElementsByTagName('img')->length) {
                        $cell->setAttribute('class', 'word-spacer');
                    }
                }
            }
            $body = $document->getElementsByTagName('body')->item(0);

            return implode('', array_map(fn ($node) => $document->saveHTML($node), iterator_to_array($body->childNodes)));
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }
}
