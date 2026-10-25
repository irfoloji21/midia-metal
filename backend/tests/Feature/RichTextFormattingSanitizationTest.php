<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Support\HtmlSanitizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RichTextFormattingSanitizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_normal_text_overrides_survive_repeated_sanitization_inside_bold_italic_headings(): void
    {
        $html = '<h2><strong><em><span style="font-weight: normal; font-style: normal; text-decoration: none;">Normal text</span></em></strong></h2>';
        $expected = '<h2><strong><em><span style="font-weight:normal; font-style:normal; text-decoration:none;">Normal text</span></em></strong></h2>';
        $this->assertSame($expected, HtmlSanitizer::richText($html));
        $this->assertSame($expected, HtmlSanitizer::richText(HtmlSanitizer::richText($expected)));
        foreach (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'span', 'td', 'th'] as $tag) {
            $formatted = '<'.$tag.' style="font-weight:normal; font-style:normal;">Text</'.$tag.'>';
            $this->assertSame($formatted, HtmlSanitizer::richText($formatted), $tag);
        }
    }

    public function test_only_enumerated_text_styles_are_added_and_hostile_css_is_removed(): void
    {
        foreach (['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as $value) {
            $this->assertSame('<span style="font-weight:'.$value.';">Text</span>', HtmlSanitizer::richText('<span style="font-weight:'.$value.'">Text</span>'));
        }
        foreach (['inherit', 'bolder', '550', 'var(--weight)', 'bold!important', 'expression(alert(1))', 'url(https://example.test)'] as $value) {
            $this->assertSame('<span>Text</span>', HtmlSanitizer::richText('<span style="font-weight:'.$value.';font-style:oblique;text-decoration:line-through">Text</span>'));
        }
        $html = '<strong style="position:fixed;display:none;width:999px;font-size:100px;FONT-WEIGHT:700;font-style:italic;text-decoration:underline" onclick="bad()">Text</strong>';
        $this->assertSame('<strong style="font-weight:700; font-style:italic; text-decoration:underline;">Text</strong>', HtmlSanitizer::richText($html));
        $this->assertSame('<span>Text</span>', HtmlSanitizer::richText('<span data-style="font-weight:bold" title="style=\'font-style:italic\'">Text</span>'));
        $this->assertSame('<span style="font-style:normal;">Text</span>', HtmlSanitizer::richText('<span data-style="font-style:italic" style="font-style:normal">Text</span>'));
        $this->assertSame('<span style="font-weight:normal;">Text</span>', HtmlSanitizer::richText('<span style="font-weight:bold;font-weight:normal">Text</span>'));
    }

    public function test_existing_span_colors_and_safe_links_keep_their_behavior_with_text_overrides(): void
    {
        foreach (['#123456', 'rgb(12, 34, 56)', 'red'] as $color) {
            $plain = '<span style="color:'.$color.'">Color</span>';
            $this->assertSame($plain, HtmlSanitizer::richText($plain));
            $combined = '<span style="color:'.$color.'; font-weight:normal; font-style:italic;">Color</span>';
            $this->assertSame($combined, HtmlSanitizer::richText(HtmlSanitizer::richText($combined)));
        }
        $link = HtmlSanitizer::richText('<a href="/contact?a=1&amp;b=2" style="font-weight:normal;text-decoration:none;position:fixed">Contact</a>');
        $this->assertStringContainsString('href="/contact?a=1&amp;b=2"', $link);
        $this->assertStringContainsString('style="font-weight:normal; text-decoration:none;"', $link);
        $this->assertStringNotContainsString('position', $link);
        $this->assertSame($link, HtmlSanitizer::richText($link));
    }

    public function test_product_save_reopen_and_public_portfolio_keep_heading_normal_overrides(): void
    {
        Http::preventStrayRequests();
        config(['services.frontend_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $html = '<div class="content-section"><div class="layout-block layout-block--image-left"><div class="layout-media"></div><div class="layout-copy"><h2><span style="font-weight:normal; font-style:normal;">Normal heading text</span></h2></div></div></div>';
        $product = $this->postJson('/api/admin/products', [
            'name' => 'Formatting persistence product', 'price_on_request' => true, 'active' => false, 'variants' => [], 'description' => $html,
        ])->assertCreated()->assertJsonPath('description', $html)->json();
        $this->getJson('/api/admin/products/'.$product['id'])->assertOk()->assertJsonPath('description', $html);
        $portfolio = $this->postJson('/api/admin/portfolio', [
            'title' => 'Formatting persistence portfolio', 'image' => '/images/project.webp', 'active' => true, 'description' => $html,
        ])->assertCreated()->assertJsonPath('description', $html)->json();
        $this->getJson('/api/v1/portfolio/'.$portfolio['slug'])->assertOk()->assertJsonPath('description_html', $html);
    }
}
