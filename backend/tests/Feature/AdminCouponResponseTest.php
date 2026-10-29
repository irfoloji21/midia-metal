<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCouponResponseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_created_coupon_has_the_same_usage_count_as_the_reloaded_list(): void
    {
        $created = $this->postJson('/api/admin/coupons', [
            'code' => 'NEW10',
            'type' => 'percentage',
            'value' => 10,
            'min_order_amount' => 10,
            'max_uses' => 3,
            'active' => true,
        ]);

        $created->assertCreated()
            ->assertJsonPath('used_count', 0)
            ->assertJsonPath('max_uses', 3);

        $listed = $this->getJson('/api/admin/coupons')->assertOk();

        $this->assertSame($created->json(), $listed->json('0'));
    }

    public function test_creation_includes_defaults_for_an_unlimited_coupon(): void
    {
        $this->postJson('/api/admin/coupons', [
            'code' => 'DEFAULTS',
            'type' => 'fixed',
            'value' => 5,
        ])->assertCreated()
            ->assertJsonPath('used_count', 0)
            ->assertJsonPath('max_uses', null)
            ->assertJsonPath('expires_at', null)
            ->assertJsonPath('min_order_amount', 0)
            ->assertJsonPath('active', true);
    }
}
