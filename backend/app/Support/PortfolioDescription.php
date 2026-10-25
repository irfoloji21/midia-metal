<?php

namespace App\Support;

class PortfolioDescription
{
    /** Existing descriptions are plain text; only explicitly sectioned content is HTML. */
    public static function html(?string $description): ?string
    {
        if (! $description) {
            return null;
        }

        // Read actual attributes, so data-class and text inside another attribute
        // cannot turn a legacy plain description into trusted rich content.
        $document = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="UTF-8">'.$description, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            foreach ($document->getElementsByTagName('div') as $element) {
                if (in_array('content-section', preg_split('/\s+/', trim($element->getAttribute('class'))), true)) {
                    return HtmlSanitizer::richText($description);
                }
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }

        return null;
    }

    public static function forStorage(?string $description): ?string
    {
        return self::html($description) ?? $description;
    }
}
