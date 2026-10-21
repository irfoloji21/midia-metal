<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\SiteSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function authenticatedAdmin(): AdminUser
    {
        $admin = AdminUser::factory()->create();
        $this->actingAs($admin, 'sanctum');

        return $admin;
    }

    // ─── Settings read ────────────────────────────────────────────────

    public function test_admin_can_read_all_settings(): void
    {
        $this->authenticatedAdmin();
        SiteSetting::create(['key' => 'site_name', 'value' => 'Midia Metal', 'group' => 'general']);
        SiteSetting::create(['key' => 'contact_email', 'value' => 'info@example.com', 'group' => 'contact']);

        $response = $this->getJson('/api/admin/settings');

        $response->assertOk();
        $data = $response->json();
        $this->assertIsArray($data);
    }

    // ─── Settings update ──────────────────────────────────────────────

    public function test_manual_bank_details_are_hidden_and_cannot_be_updated(): void
    {
        $this->authenticatedAdmin();
        SiteSetting::updateOrCreate(['key' => 'bank_transfer_accounts'], ['value' => '[]', 'group' => 'payment']);
        $this->getJson('/api/admin/settings')->assertOk()->assertJsonMissing(['key' => 'bank_transfer_accounts']);
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonMissing(['key' => 'bank_transfer_accounts']);
        $this->putJson('/api/admin/settings', ['settings' => ['bank_transfer_accounts' => '[]']])->assertStatus(422);
    }

    public function test_admin_can_update_editable_setting(): void
    {
        $this->authenticatedAdmin();
        SiteSetting::create(['key' => 'site_name', 'value' => 'Old Name', 'group' => 'general']);

        $response = $this->putJson('/api/admin/settings', [
            'settings' => [
                'site_name' => 'New Name',
            ],
        ]);

        $response->assertOk();
        $this->assertSame('New Name', SiteSetting::where('key', 'site_name')->value('value'));
        $this->assertContains('site_name', $response->json('updated'));
    }

    public function test_admin_can_update_freight_surcharges(): void
    {
        $this->authenticatedAdmin();
        SiteSetting::updateOrCreate(
            ['key' => 'freight_surcharge_highlands'],
            ['value' => '7.00', 'group' => 'shipping-freight'],
        );

        $response = $this->putJson('/api/admin/settings', [
            'settings' => [
                'freight_surcharge_highlands' => '10.00',
            ],
        ]);

        $response->assertOk();
        $this->assertSame('10.00', SiteSetting::where('key', 'freight_surcharge_highlands')->value('value'));
    }

    public function test_settings_update_ignores_nonexistent_keys(): void
    {
        $this->authenticatedAdmin();
        SiteSetting::create(['key' => 'site_name', 'value' => 'Test', 'group' => 'general']);

        $response = $this->putJson('/api/admin/settings', [
            'settings' => [
                'nonexistent_key' => 'should be ignored',
                'site_name' => 'Updated',
            ],
        ]);

        $response->assertOk();
        $this->assertSame('Updated', SiteSetting::where('key', 'site_name')->value('value'));
        $this->assertNotContains('nonexistent_key', $response->json('updated'));
    }

    public function test_settings_update_blocks_non_editable_group(): void
    {
        $this->authenticatedAdmin();
        // Create a setting in a non-editable group (hypothetical internal group)
        SiteSetting::create(['key' => 'internal_secret', 'value' => 'original', 'group' => 'system']);

        $response = $this->putJson('/api/admin/settings', [
            'settings' => [
                'internal_secret' => 'hacked',
            ],
        ]);

        $response->assertOk();
        // Should NOT be updated due to group restriction
        $this->assertSame('original', SiteSetting::where('key', 'internal_secret')->value('value'));
        $this->assertNotContains('internal_secret', $response->json('updated'));
    }

    // ─── Auth guard ───────────────────────────────────────────────────

    public function test_unauthenticated_cannot_update_settings(): void
    {
        $response = $this->putJson('/api/admin/settings', [
            'settings' => ['site_name' => 'Hacked'],
        ]);

        $response->assertStatus(401);
    }
}
