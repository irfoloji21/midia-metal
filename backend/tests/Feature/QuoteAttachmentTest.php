<?php

namespace Tests\Feature;

use App\Models\QuoteRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class QuoteAttachmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        Storage::fake('public');
    }

    private function payload(array $files = []): array
    {
        return ['name' => 'Test Customer', 'email' => 'test@example.com', 'description' => 'Kitchen drawing', 'files' => $files];
    }

    private function upload(string $name, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'quote-test-');
        file_put_contents($path, $content);
        $this->beforeApplicationDestroyed(fn () => unlink($path));

        return new UploadedFile($path, $name, null, null, true);
    }

    public function test_rejects_svg_even_when_renamed_as_a_raster_image(): void
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="document.title=1"></svg>';
        foreach (['drawing.svg', 'drawing.jpg'] as $name) {
            $this->postJson('/api/v1/quote', $this->payload([$this->upload($name, $svg)]))
                ->assertUnprocessable()->assertJsonValidationErrors('files.0');
        }
        $this->assertDatabaseCount('quote_requests', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
        Mail::assertNothingSent();
    }

    public function test_rejects_active_extensions_and_attachment_urls(): void
    {
        $this->postJson('/api/v1/quote', $this->payload([
            $this->upload('drawing.html', "%PDF-1.4\n% test drawing\n"),
        ]))->assertUnprocessable()->assertJsonValidationErrors('files.0');
        $this->postJson('/api/v1/quote', $this->payload(['https://example.com/drawing.svg']))
            ->assertUnprocessable()->assertJsonValidationErrors('files.0');
        $this->assertDatabaseCount('quote_requests', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_accepts_pdf_and_png_and_uses_detected_file_extensions(): void
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=');
        $this->postJson('/api/v1/quote', $this->payload([
            $this->upload('drawing.pdf', "%PDF-1.4\n% test drawing\n"),
            $this->upload('photo.jpg', $png),
        ]))->assertCreated();
        $files = QuoteRequest::firstOrFail()->files;
        $this->assertCount(2, $files);
        $this->assertStringEndsWith('.pdf', $files[0]);
        $this->assertStringEndsWith('.png', $files[1]);
        $this->assertCount(2, Storage::disk('public')->allFiles('quote-attachments'));
    }

    public function test_accepts_a_quote_without_attachments(): void
    {
        $this->postJson('/api/v1/quote', $this->payload())->assertCreated();
        $this->assertSame([], QuoteRequest::firstOrFail()->files);
    }
}
