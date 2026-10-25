<?php

namespace App\Support;

class PortfolioDescription
{
    /** Existing descriptions are plain text; only explicitly sectioned content is HTML. */
    public static function html(?string $description): ?string
    {
        if (! $description || ! preg_match_all('/<div\b[^>]*\bclass\s*=\s*(["\'])(.*?)\1/is', $description, $matches)) {
            return null;
        }

        foreach ($matches[2] as $classes) {
            if (in_array('content-section', preg_split('/\s+/', trim($classes)), true)) {
                return HtmlSanitizer::richText($description);
            }
        }

        return null;
    }

    public static function forStorage(?string $description): ?string
    {
        return self::html($description) ?? $description;
    }
}
