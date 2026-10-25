<?php

namespace App\Support;

class HtmlSanitizer
{
    public static function richText(?string $content): string
    {
        $content = trim((string) $content);

        if ($content === '') {
            return '';
        }

        $content = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $content) ?? '';
        $content = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $content) ?? '';
        $content = preg_replace('/\s+on[a-z]+\s*=\s*"[^"]*"/i', '', $content) ?? '';
        $content = preg_replace("/\s+on[a-z]+\s*=\s*'[^']*'/i", '', $content) ?? '';
        $content = preg_replace('/\s+on[a-z]+\s*=\s*[^\s>]+/i', '', $content) ?? '';
        $sanitizeStyle = static function (string $rawStyle, array $allowedProps): string {
            $safeStyles = [];

            foreach ($allowedProps as $prop) {
                if (! preg_match('/(?:^|;)\s*'.preg_quote($prop, '/').'\s*:\s*([^;]+)/i', $rawStyle, $match)) {
                    continue;
                }

                $value = trim($match[1]);
                if (! preg_match('/^[a-zA-Z0-9\s%.,#()_-]+$/', $value)) {
                    continue;
                }

                $safeStyles[] = $prop.':'.$value;
            }

            return $safeStyles ? implode('; ', $safeStyles).';' : '';
        };

        $extractStyle = static function (string $attributes) use ($sanitizeStyle): string {
            if (
                ! preg_match('/style\s*=\s*"([^"]*)"/i', $attributes, $styleMatch) &&
                ! preg_match("/style\s*=\s*'([^']*)'/i", $attributes, $styleMatch)
            ) {
                return '';
            }

            return $sanitizeStyle($styleMatch[1] ?? '', [
                'text-align',
                'width',
                'min-width',
                'max-width',
                'display',
                'vertical-align',
                'float',
                'clear',
                'gap',
                'column-gap',
                'row-gap',
                'justify-content',
                'align-items',
                'flex-wrap',
                'flex-direction',
                'margin',
                'margin-top',
                'margin-bottom',
                'margin-left',
                'margin-right',
                'padding',
                'padding-top',
                'padding-bottom',
                'padding-left',
                'padding-right',
                'border-collapse',
                'border-spacing',
            ]);
        };

        $extractTextStyle = static function (string $attributes, bool $includeColor = false): string {
            // Match the actual attribute, excluding data-style and text inside other attributes.
            if (! preg_match('/"[^"]*"(*SKIP)(*F)|\'[^\']*\'(*SKIP)(*F)|(?:^|\s)style\s*=\s*(["\'])(.*?)\1/is', $attributes, $match)) {
                return '';
            }
            $rawStyle = html_entity_decode($match[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $allowed = [
                'font-weight' => '/^(?:normal|bold|[1-9]00)$/',
                'font-style' => '/^(?:normal|italic)$/',
                'text-decoration' => '/^(?:none|underline)$/',
            ];
            $values = [];
            foreach (explode(';', $rawStyle) as $declaration) {
                $parts = explode(':', $declaration, 2);
                if (count($parts) !== 2) {
                    continue;
                }
                $property = strtolower(trim($parts[0]));
                $value = strtolower(trim($parts[1]));
                if (isset($allowed[$property]) && preg_match($allowed[$property], $value)) {
                    $values[$property] = $value;
                }
            }
            $safe = [];
            foreach ($allowed as $property => $pattern) {
                if (isset($values[$property])) {
                    $safe[] = $property.':'.$values[$property].';';
                }
            }
            $textStyle = implode(' ', $safe);
            // Keep the existing span colour semantics, independent of the new enum-only styles.
            if ($includeColor && preg_match('/(?:^|;)\s*color\s*:\s*([^;]+)/i', $rawStyle, $colorMatch)) {
                $color = trim($colorMatch[1]);
                if (preg_match('/^(#[0-9a-fA-F]{3,8}|rgb(a)?\([^)]+\)|hsl(a)?\([^)]+\)|[a-zA-Z]+)$/', $color)) {
                    return 'color:'.$color.($textStyle ? '; '.$textStyle : '');
                }
            }

            return $textStyle;
        };

        // Only these presentation classes are accepted from the rich text editor.
        $extractLayoutClasses = static function (string $attributes): string {
            // Skip other quoted attributes; data-class is not a class attribute.
            if (! preg_match('/"[^"]*"(*SKIP)(*F)|\'[^\']*\'(*SKIP)(*F)|(?:^|\s)class\s*=\s*(["\'])(.*?)\1/is', $attributes, $match)) {
                return '';
            }

            return implode(' ', array_intersect(
                [
                    'content-section',
                    'layout-block', 'layout-block--image-left', 'layout-block--image-right',
                    'layout-block--images-2', 'layout-block--images-3', 'layout-block--text', 'layout-block--image',
                    'layout-media', 'layout-copy',
                    'service-section', 'service-section--image-left', 'service-copy', 'service-media', 'service-eyebrow', 'service-caption',
                    'product-section', 'product-split', 'product-media', 'product-eyebrow', 'product-caption',
                    'product-note', 'product-table-wrap', 'product-performance-table', 'product-links', 'product-spec-slot',
                    'product-reference-table', 'img-row', 'img-row--2', 'img-row--3',
                    'word-paste', 'word-table', 'word-table--bordered', 'word-table--layout', 'word-spacer',
                    'word-heading-1', 'word-heading-2', 'word-heading-3', 'word-heading-4', 'word-heading-5', 'word-heading-6',
                ],
                preg_split('/\s+/', trim(html_entity_decode($match[2], ENT_QUOTES | ENT_HTML5, 'UTF-8')))
            ));
        };

        // Preserve editor layout blocks and safe inline styles.
        $content = preg_replace_callback('/<(\/?)(div\b[^>]*)>/i', function ($matches) use ($extractStyle, $extractLayoutClasses) {
            $isClose = $matches[1] === '/';
            if ($isClose) {
                return '</div>';
            }
            $attrs = $matches[2] ?? '';
            if (preg_match('/class\s*=\s*\'img-row\'/i', $attrs) || preg_match('/class\s*=\s*"img-row"/i', $attrs)) {
                return '<div class="img-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin:8px 0;">';
            }

            if ($classes = $extractLayoutClasses($attrs)) {
                return '<div class="'.$classes.'">';
            }

            $style = $extractStyle($attrs);

            return $style ? '<div style="'.e($style).'">' : '<div>';
        }, $content) ?? '';

        $content = preg_replace_callback('/<font\b([^>]*)>/i', function ($matches) {
            $attributes = $matches[1] ?? '';

            if (preg_match('/color\s*=\s*"([^"]+)"/i', $attributes, $colorMatch) ||
                preg_match("/color\s*=\s*'([^']+)'/i", $attributes, $colorMatch) ||
                preg_match('/color\s*=\s*([^\s>]+)/i', $attributes, $colorMatch)) {
                return '<span style="color:'.e(trim($colorMatch[1])).'">';
            }

            return '<span>';
        }, $content) ?? '';
        $content = preg_replace('/<\/font>/i', '</span>', $content) ?? '';

        $content = strip_tags(
            $content,
            '<p><br><strong><b><em><i><u><ul><ol><li><h1><h2><h3><h4><h5><h6><blockquote><a><span><img><div><table><thead><tbody><tfoot><tr><td><th>'
        );

        $content = preg_replace_callback('/<div\b([^>]*)>/i', function ($matches) use ($extractStyle, $extractLayoutClasses) {
            $attrs = $matches[1] ?? '';
            if (preg_match('/class\s*=\s*(["\'])img-row\1/i', $attrs)) {
                return '<div class="img-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin:8px 0;">';
            }

            if ($classes = $extractLayoutClasses($attrs)) {
                return '<div class="'.$classes.'">';
            }

            $style = $extractStyle($attrs);

            return $style ? '<div style="'.e($style).'">' : '<div>';
        }, $content) ?? '';

        foreach (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'] as $tagName) {
            $content = preg_replace_callback('/<'.$tagName.'\b([^>]*)>/i', function ($matches) use ($tagName, $extractStyle, $extractTextStyle, $extractLayoutClasses) {
                $style = $extractStyle($matches[1] ?? '');
                if (in_array($tagName, ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th'], true)) {
                    $style = trim($style.' '.$extractTextStyle($matches[1] ?? ''));
                }
                $attributes = $style ? ' style="'.e($style).'"' : '';
                if ($classes = $extractLayoutClasses($matches[1] ?? '')) {
                    $attributes .= ' class="'.$classes.'"';
                }
                if (in_array($tagName, ['td', 'th'], true)) {
                    foreach (['colspan', 'rowspan'] as $span) {
                        if (preg_match('/\b'.$span.'\s*=\s*(["\'])([1-9][0-9]{0,2})\1/i', $matches[1] ?? '', $match)) {
                            $attributes .= ' '.$span.'="'.$match[2].'"';
                        }
                    }
                }

                return '<'.$tagName.$attributes.'>';
            }, $content) ?? '';
        }

        foreach (['strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote'] as $tagName) {
            $content = preg_replace_callback('/<'.$tagName.'\b([^>]*)>/i', function ($matches) use ($tagName, $extractTextStyle) {
                $style = $extractTextStyle($matches[1] ?? '');

                return '<'.$tagName.($style ? ' style="'.e($style).'"' : '').'>';
            }, $content) ?? '';
        }

        $content = preg_replace_callback('/<a\b([^>]*)>/i', function ($matches) use ($extractTextStyle) {
            $attributes = $matches[1] ?? '';
            $style = $extractTextStyle($attributes);
            $styleAttribute = $style ? ' style="'.e($style).'"' : '';

            if (! preg_match('/href\s*=\s*"([^"]+)"/i', $attributes, $hrefMatch) &&
                ! preg_match("/href\s*=\s*'([^']+)'/i", $attributes, $hrefMatch)) {
                return '<a'.$styleAttribute.'>';
            }

            $href = trim(html_entity_decode($hrefMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            // Browsers ignore embedded ASCII control characters in URL schemes.
            $schemeValue = preg_replace('/[\x00-\x20\x7f]+/', '', $href);
            if (preg_match('/^javascript:/i', $schemeValue)) {
                return '<a'.$styleAttribute.'>';
            }

            return '<a href="'.e($href).'" target="_blank" rel="noopener noreferrer"'.$styleAttribute.'>';
        }, $content) ?? '';

        $content = preg_replace_callback('/<span\b([^>]*)>/i', function ($matches) use ($extractTextStyle) {
            $style = $extractTextStyle($matches[1] ?? '', true);

            return $style ? '<span style="'.e($style).'">' : '<span>';
        }, $content) ?? '';

        $content = preg_replace_callback('/<img\b([^>]*)>/i', function ($matches) use ($sanitizeStyle) {
            $attributes = $matches[1] ?? '';

            if (! preg_match('/src\s*=\s*"([^"]+)"/i', $attributes, $srcMatch) &&
                ! preg_match("/src\s*=\s*'([^']+)'/i", $attributes, $srcMatch)) {
                return '';
            }

            $src = trim(html_entity_decode($srcMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            if (
                preg_match('/^\s*javascript:/i', $src) ||
                ! preg_match('/^(https?:\/\/|\/|data:image\/)/i', $src)
            ) {
                return '';
            }

            $alt = '';
            if (
                preg_match('/alt\s*=\s*"([^"]*)"/i', $attributes, $altMatch) ||
                preg_match("/alt\s*=\s*'([^']*)'/i", $attributes, $altMatch)
            ) {
                $alt = trim(html_entity_decode($altMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }

            $style = '';
            if (preg_match('/style\s*=\s*"([^"]*)"/i', $attributes, $styleMatch) ||
                preg_match("/style\s*=\s*'([^']*)'/i", $attributes, $styleMatch)) {
                $rawStyle = trim($styleMatch[1]);
                $style = $sanitizeStyle($rawStyle, [
                    'width',
                    'height',
                    'min-width',
                    'max-width',
                    'display',
                    'float',
                    'margin',
                    'margin-top',
                    'margin-bottom',
                    'margin-left',
                    'margin-right',
                ]);
            }

            if (! $style) {
                $style = 'height:auto; max-width:100%; display:inline-block; margin:5px;';
            }

            return '<img src="'.e($src).'" alt="'.e($alt).'" loading="lazy" style="'.$style.'" />';
        }, $content) ?? '';

        return $content;
    }
}
