<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Coupon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CouponBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_percentage_creation_accepts_100_but_rejects_larger_values(): void
    {
        foreach ([100.01, 150] as $value) {
            $this->postJson('/api/admin/coupons', ['code' => 'INVALID', 'type' => 'percentage', 'value' => $value])->assertUnprocessable()->assertJsonValidationErrors('value');
        }
        $this->postJson('/api/admin/coupons', ['code' => 'FULL', 'type' => 'percentage', 'value' => 100, 'active' => true])->assertCreated();
        $this->postJson('/api/v1/coupons/apply', ['code' => 'FULL', 'order_amount' => 80])->assertOk()->assertJsonPath('discount', 80);
    }

    public function test_partial_updates_validate_the_resulting_coupon_type_and_value(): void
    {
        $fixed = Coupon::create(['code' => 'FIXED', 'type' => 'fixed', 'value' => 150, 'active' => true]);
        $this->putJson('/api/admin/coupons/'.$fixed->id, ['type' => 'percentage'])->assertUnprocessable()->assertJsonValidationErrors('value');
        $this->assertSame('fixed', $fixed->fresh()->type);
        $this->putJson('/api/admin/coupons/'.$fixed->id, ['type' => 'percentage', 'value' => 50])->assertOk();
        $this->putJson('/api/admin/coupons/'.$fixed->id, ['value' => 150])->assertUnprocessable()->assertJsonValidationErrors('value');
        $this->assertSame(50.0, $fixed->fresh()->value);
    }

    public function test_existing_invalid_coupons_cannot_discount_more_than_the_order_amount(): void
    {
        foreach (['percentage', 'fixed'] as $type) {
            Coupon::create(['code' => strtoupper($type), 'type' => $type, 'value' => 150, 'active' => true]);
            $this->postJson('/api/v1/coupons/apply', ['code' => strtoupper($type), 'order_amount' => 100])->assertOk()->assertJsonPath('discount', 100);
        }
    }
}
