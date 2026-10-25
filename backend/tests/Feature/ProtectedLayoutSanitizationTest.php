<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Service;
use App\Support\HtmlSanitizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ProtectedLayoutSanitizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['services.frontend_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_each_fixed_layout_preserves_its_empty_media_slots_and_text_after_repeated_sanitization(): void
    {
        foreach (['image-left' => 1, 'image-right' => 1, 'images-2' => 2, 'images-3' => 3, 'text' => 0, 'image' => 1] as $type => $images) {
            $text = in_array($type, ['image-left', 'image-right', 'text'], true) ? '<div class="layout-copy"><h2>Heading</h2><p>Some <strong>formatted</strong> text.</p></div>' : '';
            $html = '<div class="content-section"><div class="layout-block layout-block--'.$type.'">'.str_repeat('<div class="layout-media"></div>', $images).$text.'</div></div>';
            $saved = HtmlSanitizer::richText($html);
            $this->assertSame($html, $saved, $type.' must preserve its structural HTML.');
            $this->assertSame($saved, HtmlSanitizer::richText($saved));
            $this->assertSame($images, substr_count($saved, '<div class="layout-media"></div>'));
        }
    }

    public function test_layout_save_reopen_and_public_portfolio_read_preserve_empty_image_slots(): void
    {
        $html = '<div class="content-section"><div class="layout-block layout-block--image-right"><div class="layout-media"></div><div class="layout-copy"><h2>Project overview</h2><p>Details remain editable.</p></div></div></div>';
        $service = Service::create(['title' => 'Fixed service', 'slug' => 'fixed-service', 'active' => false]);
        $this->putJson('/api/admin/services/'.$service->id, ['title' => $service->title, 'content' => $html])->assertOk()->assertJsonPath('content', $html);
        $this->getJson('/api/admin/services/'.$service->id)->assertOk()->assertJsonPath('content', $html);
        $portfolio = $this->postJson('/api/admin/portfolio', ['title' => 'Fixed portfolio', 'image' => '/images/project.webp', 'active' => true, 'description' => $html])->assertCreated()->json();
        $this->getJson('/api/admin/portfolio/'.$portfolio['id'])->assertOk()->assertJsonPath('description', $html);
        $this->getJson('/api/v1/portfolio/'.$portfolio['slug'])->assertOk()->assertJsonPath('description_html', $html);
    }

    public function test_product_description_optimization_preserves_gallery_slots_on_create_and_reopen(): void
    {
        $html = '<div class="content-section"><div class="layout-block layout-block--images-3"><div class="layout-media"></div><div class="layout-media"><img src="/images/fan.webp" alt="Fan"></div><div class="layout-media"></div></div></div>';
        $expected = HtmlSanitizer::richText($html);
        $product = $this->postJson('/api/admin/products', [
            'name' => 'Protected product gallery', 'price_on_request' => true, 'active' => false,
            'variants' => [], 'description' => $html,
        ])->assertCreated()->assertJsonPath('description', $expected)->json();
        $this->getJson('/api/admin/products/'.$product['id'])->assertOk()->assertJsonPath('description', $expected);
        $this->putJson('/api/admin/products/'.$product['id'], [
            'name' => $product['name'], 'price_on_request' => true, 'variants' => [], 'description' => $expected,
        ])->assertOk()->assertJsonPath('description', $expected);
        $this->assertSame(2, substr_count($expected, '<div class="layout-media"></div>'));
    }

    public function test_allowing_fixed_layout_classes_does_not_allow_editor_controls_scripts_or_arbitrary_css(): void
    {
        $html = '<div class="content-section"><div class="layout-block layout-block--images-2 fixed" contenteditable="true" onclick="bad()" style="position:fixed"><div class="layout-media" data-slot="1"><img src="javascript:bad()" onerror="bad()"></div><div class="layout-media"><img src="/safe.webp" alt="Steel &amp; glass"></div><div class="layout-copy"><p>Safe <strong>text</strong>.</p><script>bad()</script><iframe src="https://example.invalid"></iframe></div></div></div>';
        $saved = HtmlSanitizer::richText($html);
        $this->assertStringContainsString('class="layout-block layout-block--images-2"', $saved);
        $this->assertStringContainsString('<div class="layout-media"></div>', $saved);
        $this->assertStringContainsString('src="/safe.webp"', $saved);
        $this->assertStringContainsString('<p>Safe <strong>text</strong>.</p>', $saved);
        foreach (['fixed', 'contenteditable', 'onclick', 'data-slot', 'javascript:', 'onerror', '<script', '<iframe', 'bad()'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $saved);
        }
        $this->assertSame($saved, HtmlSanitizer::richText($saved));
    }
}
