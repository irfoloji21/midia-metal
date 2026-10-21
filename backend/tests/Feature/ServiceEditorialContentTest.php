<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Service;
use App\Support\HtmlSanitizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ServiceEditorialContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_layout_survives_admin_save_and_reopen_without_allowing_arbitrary_classes_or_scripts(): void
    {
        Http::preventStrayRequests();
        config(['services.frontend_content_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $service = Service::create(['title' => 'Wall Cladding', 'slug' => 'wall-cladding', 'active' => false]);
        $html = <<<'HTML'
<div class="service-section service-section--image-left fixed"><div class="service-copy" onclick="bad()"><div class="service-eyebrow">Wall panels</div><h2>Made for the space</h2><p>Panels around a sink.</p></div><div class="service-media"><img src="/images/panels.webp" alt="Panels around a sink" onerror="bad()" /></div></div><script>bad()</script>
HTML;
        $saved = $this->putJson('/api/admin/services/'.$service->id, [
            'title' => $service->title, 'content' => $html,
        ])->assertOk()->json('content');

        $this->assertStringContainsString('class="service-section service-section--image-left"', $saved);
        $this->assertStringContainsString('class="service-media"', $saved);
        $this->assertStringContainsString('alt="Panels around a sink"', $saved);
        $this->assertStringNotContainsString('fixed', $saved);
        $this->assertStringNotContainsString('onclick', $saved);
        $this->assertStringNotContainsString('onerror', $saved);
        $this->assertStringNotContainsString('bad()', $saved);
        // The existing sanitizer normalises image style ordering on the next save.
        $normalised = HtmlSanitizer::richText($saved);
        $this->putJson('/api/admin/services/'.$service->id, [
            'title' => $service->title, 'content' => $saved,
        ])->assertOk()->assertJsonPath('content', $normalised);
        $this->getJson('/api/admin/services/'.$service->id)->assertOk()->assertJsonPath('content', $normalised);
        $this->assertSame($normalised, HtmlSanitizer::richText($normalised));
    }

    public function test_existing_plain_rich_text_and_image_rows_still_work(): void
    {
        $html = '<h2>Existing heading</h2><p>Some <strong>formatted</strong> text.</p><div class="img-row"><img src="/images/existing.webp" alt="Existing photo" /></div>';
        $clean = HtmlSanitizer::richText($html);
        $this->assertStringContainsString('<h2>Existing heading</h2>', $clean);
        $this->assertStringContainsString('<strong>formatted</strong>', $clean);
        $this->assertStringContainsString('class="img-row"', $clean);
        $this->assertStringContainsString('src="/images/existing.webp"', $clean);
    }
}
