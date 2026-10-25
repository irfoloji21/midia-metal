<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\PortfolioProject;
use App\Models\Service;
use App\Models\SiteSetting;
use App\Support\HtmlSanitizer;
use App\Support\PortfolioDescription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SectionTemplateContentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['services.frontend_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_section_boundaries_survive_save_and_reopen_without_extra_attributes(): void
    {
        $html = '<div class="content-section fixed" data-secret="bad" onclick="bad()"><div class="service-section"><div class="service-copy"><h2>Section one</h2><p>Some <strong>text</strong>.</p></div></div></div><div class="content-section"><table><tr><th>Type</th><td>Steel</td></tr></table></div><script>bad()</script>';
        $service = Service::create(['title' => 'Section test', 'slug' => 'section-test', 'active' => false]);
        $saved = $this->putJson('/api/admin/services/'.$service->id, ['title' => $service->title, 'content' => $html])->assertOk()->json('content');

        $this->assertSame(2, substr_count($saved, 'class="content-section"'));
        $this->assertStringContainsString('class="service-section"', $saved);
        $this->assertStringContainsString('<th>Type</th><td>Steel</td>', $saved);
        foreach (['fixed', 'data-secret', 'onclick', '<script', 'bad()'] as $removed) {
            $this->assertStringNotContainsString($removed, $saved);
        }
        $this->assertSame($saved, HtmlSanitizer::richText($saved));
        $this->getJson('/api/admin/services/'.$service->id)->assertOk()->assertJsonPath('content', $saved);
    }

    public function test_portfolio_rich_content_is_sanitized_and_public_html_is_derived_on_read(): void
    {
        $created = $this->postJson('/api/admin/portfolio', [
            'title' => 'Section portfolio', 'image' => '/images/project.webp', 'active' => true,
            'description' => '<div class="content-section"><h2>Project scope</h2><p>Completed <strong>installation</strong>.</p><img src="/images/project.webp" onerror="bad()"></div><script>bad()</script>',
        ])->assertCreated()->json();
        $this->assertStringContainsString('<strong>installation</strong>', $created['description']);
        $this->assertStringNotContainsString('onerror', $created['description']);
        $this->assertStringNotContainsString('<script', $created['description']);
        $this->getJson('/api/admin/portfolio/'.$created['id'])->assertOk()->assertJsonPath('description', $created['description']);
        $this->getJson('/api/v1/portfolio/'.$created['slug'])->assertOk()->assertJsonPath('description_html', HtmlSanitizer::richText($created['description']));

        // Rows written before the editor upgrade still pass through read-time sanitation.
        $project = PortfolioProject::findOrFail($created['id']);
        $legacyUnsafe = '<div class="content-section" onclick="bad()"><p>Safe</p><script>bad()</script><img src="javascript:bad()"></div>';
        $project->update(['description' => $legacyUnsafe]);
        $this->getJson('/api/v1/portfolio/'.$created['slug'])->assertOk()->assertJsonPath('description_html', '<div class="content-section"><p>Safe</p></div>');
        $this->assertSame($legacyUnsafe, $project->fresh()->description, 'Reading must not rewrite stored legacy data.');
    }

    public function test_portfolio_plain_descriptions_keep_their_text_and_never_become_html(): void
    {
        $plain = "Measurements: 2 < 3 & 5 > 4.\nLiteral <strong>steel</strong> and <script>example</script>.";
        $created = $this->postJson('/api/admin/portfolio', ['title' => 'Legacy project', 'image' => '/images/project.webp', 'description' => $plain, 'active' => true])->assertCreated()->json();
        $this->assertSame($plain, $created['description']);
        $this->getJson('/api/v1/portfolio/'.$created['slug'])->assertOk()->assertJsonPath('description', $plain)->assertJsonPath('description_html', null);
        $this->putJson('/api/admin/portfolio/'.$created['id'], ['title' => 'Renamed legacy project'])->assertOk()->assertJsonPath('description', $plain);
        $this->assertNull(PortfolioDescription::html('<div class="content-section-other"><p>Not a section</p></div>'));
    }

    public function test_portfolio_sections_can_be_replaced_without_changing_other_project_fields(): void
    {
        $project = PortfolioProject::create(['title' => 'Portfolio', 'slug' => 'portfolio', 'image' => '/images/main.webp', 'client' => 'Test client', 'gallery' => ['/images/gallery.webp'], 'description' => 'Legacy text', 'active' => false]);
        $first = '<div class="content-section"><h2>First</h2></div><div class="content-section"><h2>Second</h2></div>';
        $this->putJson('/api/admin/portfolio/'.$project->id, ['title' => $project->title, 'description' => $first])->assertOk()->assertJsonPath('description', $first);
        $second = '<div class="content-section"><h2>Second edited</h2></div>';
        $this->putJson('/api/admin/portfolio/'.$project->id, ['title' => $project->title, 'description' => $second])->assertOk()->assertJsonPath('description', $second);
        $fresh = $project->fresh();
        $this->assertSame('Test client', $fresh->client);
        $this->assertSame(['/images/gallery.webp'], $fresh->gallery);
        $this->assertSame('/images/main.webp', $fresh->image);
        $this->assertFalse($fresh->active);
    }

    public function test_attribute_entities_survive_repeated_sanitization_and_portfolio_public_reads(): void
    {
        $html = '<div class="content-section"><p><a href="https://example.com/photo?width=800&amp;fit=contain">Photo</a></p><img src="https://example.com/photo?width=800&amp;fit=contain" alt="Steel &amp; glass &quot;A&quot;"></div>';
        $saved = HtmlSanitizer::richText($html);
        $this->assertSame($saved, HtmlSanitizer::richText($saved));
        $this->assertSame($saved, HtmlSanitizer::richText(HtmlSanitizer::richText($saved)));
        $this->assertStringContainsString('?width=800&amp;fit=contain', $saved);
        $this->assertStringContainsString('alt="Steel &amp; glass &quot;A&quot;"', $saved);
        $this->assertStringNotContainsString('&amp;amp;', $saved);
        $created = $this->postJson('/api/admin/portfolio', [
            'title' => 'Portfolio attribute entities', 'image' => '/images/project.webp', 'active' => true, 'description' => $html,
        ])->assertCreated()->json();
        $this->assertSame($saved, $created['description']);
        $this->getJson('/api/v1/portfolio/'.$created['slug'])->assertOk()->assertJsonPath('description_html', $saved);
        $this->putJson('/api/admin/portfolio/'.$created['id'], ['title' => $created['title'], 'description' => $saved])->assertOk()->assertJsonPath('description', $saved);
    }

    public function test_decoding_attributes_does_not_allow_entity_obfuscated_javascript_urls(): void
    {
        foreach (['java&#x73;cript:alert(1)', 'javascript&colon;alert(1)', 'jav&#x09;ascript:alert(1)', '&#10;javascript:alert(1)'] as $url) {
            $saved = HtmlSanitizer::richText('<div class="content-section"><a href="'.$url.'">Unsafe link</a><img src="'.$url.'" alt="Unsafe"></div>');
            $this->assertSame('<div class="content-section"><a>Unsafe link</a></div>', $saved);
            $this->assertSame($saved, HtmlSanitizer::richText($saved));
        }
    }

    public function test_only_real_section_class_attributes_mark_portfolio_html(): void
    {
        foreach ([
            '<div data-class="content-section">Literal legacy text</div>',
            '<div title="Example class=\'content-section\'">Literal legacy text</div>',
            '<div class="content-section-other">Literal legacy text</div>',
        ] as $plain) {
            $this->assertNull(PortfolioDescription::html($plain));
            $this->assertSame($plain, PortfolioDescription::forStorage($plain));
        }
        $this->assertSame('<div class="content-section"><p>Real section</p></div>', PortfolioDescription::html('<div data-class="different" class="content-section"><p>Real section</p></div>'));
    }

    public function test_rich_setting_keeps_section_boundaries_and_plain_settings_are_unaffected(): void
    {
        SiteSetting::create(['key' => 'test_section_policy', 'value' => '', 'type' => 'richtext', 'group' => 'legal']);
        SiteSetting::create(['key' => 'test_plain_setting', 'value' => '', 'type' => 'textarea', 'group' => 'general']);
        $section = '<div class="content-section" data-untrusted="x"><h2>Contact</h2><p>Reach us.</p></div>';
        $plain = 'Literal <strong>text</strong>';
        $this->putJson('/api/admin/settings', ['settings' => ['test_section_policy' => $section, 'test_plain_setting' => $plain]])->assertOk();
        $this->assertSame('<div class="content-section"><h2>Contact</h2><p>Reach us.</p></div>', SiteSetting::where('key', 'test_section_policy')->value('value'));
        $this->assertSame($plain, SiteSetting::where('key', 'test_plain_setting')->value('value'));
    }
}
