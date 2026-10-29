<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Product;
use App\Support\HtmlSanitizer;
use App\Support\ProductDescription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WordPasteContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_word_content_survives_save_reopen_and_public_read(): void
    {
        Http::preventStrayRequests();
        Storage::fake('public');
        config(['services.frontend_content_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $product = Product::create(['name' => 'Word paste test', 'slug' => 'word-paste-test', 'price' => '£10.00', 'active' => true]);
        $description = '<div class="word-paste"><h1>Fan overview</h1><h2>Technical details</h2><h5>Notes</h5><p>A <strong>bold</strong> and <em>italic</em> description.</p><div class="word-table word-table--bordered"><table style="width:100%;border-collapse:collapse"><tbody><tr><td colspan="2">Performance</td></tr><tr><td rowspan="2">Flow</td><td>1400</td></tr><tr><td>1200</td></tr></tbody><tfoot><tr><td colspan="2">Source</td></tr></tfoot></table></div><img src="data:image/png;base64,iVBORw0KGgo=" alt="Fan front"><img src="/storage/fan.webp" alt="Fan side"></div>';
        $png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
        $description = str_replace('iVBORw0KGgo=', $png, $description);
        $payload = ['name' => $product->name, 'price' => $product->price, 'active' => true,
            'variants' => [['option' => 'Model', 'value' => 'EC', 'price' => '£10.00']], 'description' => $description];
        $saved = $this->putJson('/api/admin/products/'.$product->id, $payload)->assertOk()->json('description');
        foreach (['class="word-paste"', 'word-table word-table--bordered', '<h2 class="word-heading-1">Fan overview</h2>', '<h3 class="word-heading-2">Technical details</h3>', '<h6 class="word-heading-5">Notes</h6>', '<strong>bold</strong>', 'colspan="2"', 'rowspan="2"', '<tfoot>', '/storage/product-content/', '/storage/fan.webp'] as $expected) {
            $this->assertStringContainsString($expected, $saved);
        }
        $this->assertSame(2, substr_count($saved, '<img '));
        $this->assertStringNotContainsString('data:image', $saved);
        $this->assertStringNotContainsString('<h1', $saved);
        $files = Storage::disk('public')->allFiles('product-content');
        $this->assertCount(1, $files);
        $this->assertSame(base64_decode($png), Storage::disk('public')->get($files[0]));
        $this->getJson('/api/admin/products/'.$product->id)->assertOk()->assertJsonPath('description', $saved);
        $payload['description'] = $saved;
        $resaved = $this->putJson('/api/admin/products/'.$product->id, $payload)->assertOk()->json('description');
        $this->assertSame(ProductDescription::optimize(HtmlSanitizer::richText($saved)), $resaved);
        $payload['description'] = $resaved;
        $this->putJson('/api/admin/products/'.$product->id, $payload)->assertOk()->assertJsonPath('description', $resaved);
        $this->assertCount(1, Storage::disk('public')->allFiles('product-content'));
        $this->getJson('/api/v1/products/'.$product->slug)->assertOk()->assertJsonPath('description', $resaved);
    }

    public function test_invalid_embedded_image_does_not_replace_existing_product_content(): void
    {
        Storage::fake('public');
        config(['services.frontend_content_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $product = Product::create(['name' => 'Fan', 'slug' => 'fan', 'price' => '£10.00', 'description' => '<p>Original</p>']);
        $this->putJson('/api/admin/products/'.$product->id, ['name' => 'Fan', 'price' => '£10.00',
            'variants' => [['option' => 'Model', 'value' => 'EC', 'price' => '£10.00']],
            'description' => '<img src="data:image/png;base64,aW52YWxpZA==">'])->assertUnprocessable()->assertJsonValidationErrors('description');
        $this->assertSame('<p>Original</p>', $product->fresh()->description);
        $this->assertEmpty(Storage::disk('public')->allFiles());
    }

    public function test_existing_word_layout_is_normalized_once_without_changing_text_or_image_counts(): void
    {
        $html = '<div class="word-paste"><h1>Overview</h1><div class="word-table"><table><tr><td><strong>Text</strong></td><td>&nbsp;</td><td><img src="/fan.png" alt="Fan"></td></tr></table></div><div class="word-table word-table--bordered"><table><tr><td>Data</td><td><img src="/fan.png"></td></tr></table></div></div>';
        $result = ProductDescription::optimize($html);
        $this->assertSame(1, substr_count($result, 'word-table--layout'));
        $this->assertSame(1, substr_count($result, 'word-spacer'));
        $this->assertSame(2, substr_count($result, '<img '));
        $this->assertStringContainsString('<strong>Text</strong>', $result);
        $this->assertSame($result, ProductDescription::optimize($result));
    }

    public function test_table_spans_are_bounded_integers_and_untrusted_attributes_still_removed(): void
    {
        $html = HtmlSanitizer::richText('<div class="word-paste fixed" onclick="bad()"><table><tr><td colspan="2" rowspan="9999" onmouseover="bad()">Safe</td><td colspan="0" rowspan="-1">Invalid</td></tr></table><script>bad()</script></div>');
        $this->assertStringContainsString('colspan="2"', $html);
        foreach (['rowspan', 'colspan="0"', 'fixed', 'onclick', 'onmouseover', '<script', 'bad()'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html);
        }
    }

    public function test_existing_content_optimization_backs_up_only_the_selected_product(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        config(['services.frontend_content_deploy.enabled' => false]);
        $original = '<div class="word-paste"><h1>Original heading</h1><p>Keep this text</p></div>';
        $product = Product::create(['name' => 'Selected', 'slug' => 'selected', 'price' => '£10.00', 'description' => $original]);
        $other = Product::create(['name' => 'Other', 'slug' => 'other', 'price' => '£12.00', 'description' => $original]);
        $this->artisan('products:optimize-descriptions', ['--id' => [$product->id]])->assertSuccessful();
        $this->assertSame($original, $product->fresh()->description);
        $this->assertEmpty(Storage::disk('local')->allFiles());
        $this->artisan('products:optimize-descriptions', ['--id' => [$product->id], '--write' => true])->assertSuccessful();
        $this->assertSame($original, $other->fresh()->description);
        $this->assertSame('£10.00', $product->fresh()->price);
        $this->assertStringContainsString('word-heading-1', $product->fresh()->description);
        $backups = Storage::disk('local')->allFiles('description-backups');
        $this->assertCount(1, $backups);
        $backup = json_decode(Storage::disk('local')->get($backups[0]), true);
        $this->assertSame($product->id, $backup['id']);
        $this->assertSame($original, $backup['description']);
        $this->artisan('products:optimize-descriptions', ['--id' => [$product->id], '--write' => true])->assertSuccessful();
        $this->assertCount(1, Storage::disk('local')->allFiles('description-backups'));
    }
}
