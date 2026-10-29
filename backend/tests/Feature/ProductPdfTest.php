<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Product;
use App\Services\ProductPdf;
use App\Services\ProductPdfMedia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ProductPdfTest extends TestCase
{
    use RefreshDatabase;

    private function payload(): array
    {
        return ['name' => 'PDF test fan', 'price' => '£25.00', 'active' => true,
            'variants' => [['option' => 'Model', 'value' => 'Standard', 'price' => '£25.00']]];
    }

    public function test_new_products_default_to_enabled_and_admin_can_toggle_and_reopen(): void
    {
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $created = $this->postJson('/api/admin/products', $this->payload())->assertCreated()->assertJsonPath('pdf_download_enabled', true);
        $id = $created->json('id');
        $this->putJson('/api/admin/products/'.$id, [...$this->payload(), 'pdf_download_enabled' => false])
            ->assertOk()->assertJsonPath('pdf_download_enabled', false);
        $this->getJson('/api/admin/products/'.$id)->assertOk()->assertJsonPath('pdf_download_enabled', false);
        $this->getJson('/api/v1/products/'.$id)->assertOk()->assertJsonPath('pdf_download_enabled', false);
        $this->get('/api/v1/products/'.$id.'/pdf')->assertNotFound();
        // Older clients that omit the flag must not enable a disabled product again.
        $this->putJson('/api/admin/products/'.$id, $this->payload())->assertOk()->assertJsonPath('pdf_download_enabled', false);
        $this->putJson('/api/admin/products/'.$id, [...$this->payload(), 'pdf_download_enabled' => true])->assertOk()->assertJsonPath('pdf_download_enabled', true);
        $this->putJson('/api/admin/products/'.$id, [...$this->payload(), 'pdf_download_enabled' => 'invalid'])->assertUnprocessable();
    }

    public function test_pdf_uses_fresh_product_data_on_each_request_and_disables_caching(): void
    {
        $product = Product::factory()->create(['active' => true, 'description' => 'Original copy', 'specifications' => ['Power' => '100 W']]);
        $this->mock(ProductPdf::class, function ($mock) use ($product) {
            $mock->shouldReceive('render')->once()->withArgs(fn (Product $p) => $p->id === $product->id && $p->description === 'Original copy')->andReturn('%PDF-original');
            $mock->shouldReceive('render')->once()->withArgs(fn (Product $p) => $p->description === 'Revised copy' && $p->specifications['Power'] === '200 W' && $p->image === '/images/new.webp')->andReturn('%PDF-revised');
        });
        $this->get('/api/v1/products/'.$product->slug.'/pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Cache-Control', 'max-age=0, no-store, private')->assertSee('%PDF-original', false);
        $product->update(['description' => 'Revised copy', 'specifications' => ['Power' => '200 W'], 'image' => '/images/new.webp']);
        $this->get('/api/v1/products/'.$product->id.'/pdf')->assertOk()->assertSee('%PDF-revised', false);
        $product->update(['active' => false]);
        $this->get('/api/v1/products/'.$product->id.'/pdf')->assertNotFound();
        $this->get('/api/v1/products/non-existent/pdf')->assertNotFound();
    }

    public function test_real_pdf_contains_raster_images_and_rich_description(): void
    {
        Http::preventStrayRequests();
        $product = Product::factory()->create([
            'active' => true, 'product_code' => 'FAN-TEST',
            'image' => '/images/products/reference-catalogue/baffle-grease-filters-v1.webp',
            'gallery' => ['/images/products/longwell-dd7-5-ec/longwell-dd7-5-ec-front.webp'],
            'description' => '<h2>Türkçe ürün açıklaması</h2><p>Güncel açıklama, ölçü ve özellikler.</p><div class="product-spec-slot"></div><table><tr><td>Editable table</td></tr></table>',
            'specifications' => ['Güç' => '200 W'],
        ]);
        $response = $this->withHeader('X-Site-Origin', 'http://localhost:3000')->get('/api/v1/products/'.$product->id.'/pdf')->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="fan-test-product-information.pdf"');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertStringContainsString('/Subtype /Image', $response->getContent());
        $this->assertGreaterThan(15000, strlen($response->getContent()));
        // Assert the actual main and gallery JPEG bytes, not just the QR image.
        $media = new ProductPdfMedia;
        foreach ([$product->image, ...$product->gallery] as $source) {
            $image = $media->image($source);
            $this->assertNotNull($image);
            $this->assertStringContainsString(base64_decode(explode(',', $image['src'], 2)[1]), $response->getContent());
        }
        $this->assertStringContainsString('http://localhost:3000/shop/'.$product->slug, $response->getContent());
        $html = app(ProductPdf::class)->description($product, new ProductPdfMedia);
        $this->assertStringContainsString('Türkçe ürün açıklaması', $html);
        $this->assertStringContainsString('Editable table', $html);
        $this->assertSame(1, substr_count($html, 'Technical specifications'));
        $this->assertStringContainsString('Güç', $html);
    }

    public function test_current_site_origin_survives_proxy_and_changes_on_each_download(): void
    {
        config(['app.frontend_url' => 'https://store.example', 'cors.allowed_origins' => ['https://store.example', 'https://preview.example:8443']]);
        $product = Product::factory()->create(['active' => true]);
        $this->mock(ProductPdf::class, function ($mock) {
            $mock->shouldReceive('render')->withArgs(fn (Product $p, string $origin) => $origin === 'https://store.example')->twice()->andReturn('%PDF-store');
            $mock->shouldReceive('render')->withArgs(fn (Product $p, string $origin) => $origin === 'https://preview.example:8443')->twice()->andReturn('%PDF-preview');
        });
        $url = '/api/v1/products/'.$product->id.'/pdf';
        $this->get($url, ['X-Site-Origin' => 'https://store.example'])->assertOk()->assertSee('%PDF-store', false);
        $this->get($url, ['X-Site-Origin' => 'https://preview.example:8443'])->assertOk()->assertSee('%PDF-preview', false);
        $this->get($url, ['Referer' => 'https://preview.example:8443/shop/'.$product->slug])->assertOk()->assertSee('%PDF-preview', false);
        $this->get($url, ['X-Site-Origin' => 'https://store.example@untrusted.example', 'Origin' => 'javascript:alert(1)'])->assertOk()->assertSee('%PDF-store', false);

        $html = (new ProductPdf)->description(new Product(['description' => '<a href="/contact">Contact</a>']), new ProductPdfMedia, 'https://preview.example:8443');
        $this->assertStringContainsString('https://preview.example:8443/contact', $html);
    }

    public function test_separate_frontend_deployment_fetches_bundled_images_only_from_configured_site(): void
    {
        config(['app.frontend_url' => 'https://store.example']);
        Http::preventStrayRequests();
        Http::fake(['https://store.example/images/pdf-test.webp' => Http::response(file_get_contents(base_path('../public/images/products/reference-catalogue/baffle-grease-filters-v1.webp')), 200)]);
        $media = new ProductPdfMedia('https://preview.example');
        $this->assertNotNull($media->image('https://preview.example/images/pdf-test.webp'));
        $this->assertNull($media->image('/images/%2e%2e/private/secret.png'));
        $this->assertNull($media->image('/images/..%5cprivate/secret.png'));
        $this->assertNull($media->image('https://untrusted.example/images/pdf-test.webp'));
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === 'https://store.example/images/pdf-test.webp');
    }

    public function test_pdf_media_cannot_read_private_files_or_unapproved_remote_urls(): void
    {
        Http::preventStrayRequests();
        $media = new ProductPdfMedia;
        foreach (['file:///etc/passwd', '/images/../../.env', '/storage/../private/secret.png', 'http://169.254.169.254/latest/meta-data/', 'https://example.com/image.jpg', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='] as $source) {
            $this->assertNull($media->image($source));
        }
        Http::assertNothingSent();
        $product = new Product(['description' => '<script>alert(1)</script><img src="file:///etc/passwd" onerror="bad()"><h2>Safe heading</h2>']);
        $html = app(ProductPdf::class)->description($product, $media);
        $this->assertStringContainsString('Safe heading', $html);
        $this->assertStringNotContainsString('script', $html);
        $this->assertStringNotContainsString('file://', $html);
    }
}
