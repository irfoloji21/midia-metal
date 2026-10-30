<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\SiteSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SharedSiteSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function setting(string $key, string $value, string $group = 'general', string $type = 'text'): void
    {
        SiteSetting::updateOrCreate(['key' => $key], compact('value', 'group', 'type'));
    }

    private function migrateSettings(): void
    {
        $migration = require database_path('migrations/2026_10_18_220000_consolidate_general_site_settings.php');
        $migration->up();
    }

    public function test_migration_preserves_published_values_custom_labels_and_archives_duplicates(): void
    {
        $this->setting('site_name', 'Published Company', 'header');
        $this->setting('company_name', 'Old Company');
        $this->setting('contact_email', 'published@example.com', 'footer');
        $this->setting('company_email', 'old@example.com');
        $this->setting('contact_phone', '07545888522', 'footer');
        $this->setting('company_phone', '02012345678');
        $this->setting('services_hero_phone', '02099999999', 'services');
        $this->setting('header_nav_home', 'Welcome', 'header');
        $this->setting('footer_working_hours', "Mon-Fri: 9 AM — 6 PM\nSunday: Closed", 'footer');
        $this->setting('contact_map_url', 'https://www.google.com/maps/embed?pb=custom', 'contact');
        $this->setting('social_instagram', 'https://www.instagram.com/custom', 'footer');
        $this->setting('site_logo', '/storage/uploads/custom.png', 'header', 'image');
        $this->setting('footer_text', '© 2024 Published Company. All rights reserved.', 'footer');
        $this->setting('privacy_policy_content', '<p>Old Company: old@example.com</p>', 'legal', 'richtext');
        $before = SiteSetting::pluck('value', 'key')->all();
        $count = SiteSetting::count();

        $this->migrateSettings();
        $this->migrateSettings(); // Safe if repeated after an interrupted deployment.

        $this->assertSame($count, SiteSetting::count());
        foreach (['site_name', 'contact_email', 'contact_phone', 'header_nav_home', 'footer_working_hours', 'contact_map_url', 'social_instagram', 'site_logo'] as $key) {
            $this->assertDatabaseHas('site_settings', ['key' => $key, 'value' => $before[$key], 'group' => 'general']);
        }
        foreach (['company_name', 'company_email', 'company_phone', 'services_hero_phone'] as $key) {
            $this->assertDatabaseHas('site_settings', ['key' => $key, 'value' => $before[$key], 'group' => 'legacy-general']);
        }
        $this->assertDatabaseHas('site_settings', ['key' => 'footer_text', 'value' => '© 2024 {{site_name}}. All rights reserved.']);
        $this->assertDatabaseHas('site_settings', ['key' => 'privacy_policy_content', 'value' => '<p>{{site_name}}: {{contact_email}}</p>']);
    }

    public function test_missing_canonical_values_are_recovered_without_overwriting_intentionally_empty_values(): void
    {
        $this->setting('company_address', 'Existing factory address');
        $this->setting('contact_phone', '');
        $this->setting('company_phone', 'Old phone');
        $this->migrateSettings();
        $this->assertDatabaseHas('site_settings', ['key' => 'contact_address', 'value' => 'Existing factory address', 'group' => 'general']);
        $this->assertDatabaseHas('site_settings', ['key' => 'contact_phone', 'value' => '']);
    }

    public function test_general_updates_flow_to_public_details_and_policy_templates(): void
    {
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $this->setting('site_name', 'Old company');
        $this->setting('contact_email', 'before@example.com');
        $this->setting('contact_phone', '07545888522');
        $this->setting('site_logo', '/old.png', 'general', 'image');
        $this->setting('social_facebook', 'https://www.facebook.com/');
        $this->setting('header_nav_home', 'Home');
        $this->setting('company_email', 'archived@example.com', 'legacy-general');
        $this->setting('services_hero_phone', 'Old number', 'legacy-general');
        $this->setting('footer_text', '© {{site_name}}');
        $this->setting('privacy_policy_content', '<p>{{site_name}}: <a href="mailto:{{contact_email}}">{{contact_email}}</a></p>', 'legal', 'richtext');
        $updates = ['site_name' => 'Metal & Parts', 'contact_email' => 'new@example.com', 'site_logo' => '/storage/uploads/new.png', 'social_facebook' => 'https://www.facebook.com/example', 'header_nav_home' => 'Welcome'];
        $this->putJson('/api/admin/settings', ['settings' => $updates + ['company_email' => 'ignored@example.com']])->assertOk()->assertJsonCount(5, 'updated');

        $admin = collect($this->getJson('/api/admin/settings')->assertOk()->json())->keyBy('key');
        $this->assertFalse($admin->has('company_email'));
        $this->assertFalse($admin->has('services_hero_phone'));
        $this->assertSame('© {{site_name}}', $admin['footer_text']['value']);
        $response = $this->getJson('/api/v1/settings')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $public = collect($response->json())->keyBy('key');
        foreach ($updates as $key => $value) {
            $this->assertSame($value, $public[$key]['value']);
        }
        $this->assertSame('© Metal & Parts', $public['footer_text']['value']);
        $this->assertSame('<p>Metal &amp; Parts: <a href="mailto:new@example.com">new@example.com</a></p>', $public['privacy_policy_content']['value']);
        $this->assertFalse($public->has('company_email'));
        $this->assertDatabaseHas('site_settings', ['key' => 'contact_phone', 'value' => '07545888522']);
        $this->assertDatabaseHas('site_settings', ['key' => 'company_email', 'value' => 'archived@example.com']);
    }

    public function test_invalid_contact_email_rejects_the_entire_update(): void
    {
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $this->setting('site_name', 'Original');
        $this->setting('contact_email', 'valid@example.com');
        $this->putJson('/api/admin/settings', ['settings' => ['site_name' => 'Changed', 'contact_email' => 'not an email']])
            ->assertUnprocessable()->assertJsonValidationErrors('settings.contact_email');
        $this->assertDatabaseHas('site_settings', ['key' => 'site_name', 'value' => 'Original']);
        $this->assertDatabaseHas('site_settings', ['key' => 'contact_email', 'value' => 'valid@example.com']);
    }

    public function test_optional_logo_can_be_cleared_without_losing_other_settings(): void
    {
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $this->setting('site_logo', '/uploaded.png', 'general', 'image');
        $this->setting('site_name', 'Existing company');
        $this->putJson('/api/admin/settings', ['settings' => ['site_logo' => '']])->assertOk();
        $this->assertDatabaseHas('site_settings', ['key' => 'site_logo', 'value' => '']);
        $this->assertDatabaseHas('site_settings', ['key' => 'site_name', 'value' => 'Existing company']);
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonFragment(['key' => 'site_logo', 'value' => '']);
    }
}
