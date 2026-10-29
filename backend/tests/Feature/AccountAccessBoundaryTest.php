<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Customer;
use App\Models\CustomerPaymentMethod;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AccountAccessBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_guest_cannot_access_admin_or_customer_data(): void
    {
        foreach (['/api/admin/me', '/api/admin/orders', '/api/admin/customers', '/api/v1/customer/me', '/api/v1/customer/orders'] as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
    }

    public function test_customer_cannot_use_admin_routes(): void
    {
        $this->actingAs(Customer::factory()->create(), 'sanctum');
        $this->getJson('/api/admin/me')->assertForbidden();
        $this->getJson('/api/admin/orders')->assertForbidden();
        $this->putJson('/api/admin/settings', ['site_name' => 'Untrusted'])->assertForbidden();
    }

    public function test_admin_cannot_use_customer_routes(): void
    {
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $this->getJson('/api/v1/customer/me')->assertForbidden();
        $this->getJson('/api/v1/customer/orders')->assertForbidden();
    }

    public function test_customer_cannot_read_or_modify_another_customers_order_or_card(): void
    {
        $owner = Customer::factory()->create();
        $stranger = Customer::factory()->create();
        $order = Order::factory()->forCustomer($owner)->create();
        $card = CustomerPaymentMethod::create([
            'customer_id' => $owner->id, 'stripe_payment_method_id' => 'pm_isolated_test',
            'brand' => 'visa', 'last4' => '4242', 'exp_month' => '12', 'exp_year' => '2030',
        ]);
        $this->actingAs($stranger, 'sanctum');
        $this->getJson('/api/v1/customer/orders')->assertOk()->assertExactJson([]);
        $this->getJson("/api/v1/customer/orders/{$order->id}")->assertNotFound();
        $this->getJson("/api/v1/customer/orders/{$order->id}/invoice")->assertNotFound();
        $this->postJson('/api/v1/customer/refund-requests', ['order_id' => $order->id, 'reason' => 'Test', 'details' => 'Test'])->assertNotFound();
        $this->deleteJson("/api/v1/customer/payment-methods/{$card->id}")->assertNotFound();
        $this->assertDatabaseHas('customer_payment_methods', ['id' => $card->id]);
        $this->assertDatabaseCount('contact_messages', 0);
    }

    public function test_profile_cannot_overwrite_identity_password_or_stripe_customer(): void
    {
        $customer = Customer::factory()->create(['stripe_customer_id' => 'cus_original']);
        $password = $customer->password;
        $this->actingAs($customer, 'sanctum');
        $this->putJson('/api/v1/customer/profile', [
            'name' => 'Updated name', 'email' => 'other@example.com', 'password' => 'NotAllowed123!',
            'stripe_customer_id' => 'cus_other', 'id' => 999,
        ])->assertOk()->assertJsonMissingPath('password')->assertJsonMissingPath('remember_token');
        $customer->refresh();
        $this->assertSame($password, $customer->password);
        $this->assertNotSame('other@example.com', $customer->email);
        $this->assertSame('cus_original', $customer->stripe_customer_id);
    }

    public function test_customer_password_reset_revokes_existing_sessions(): void
    {
        $customer = Customer::factory()->create();
        $previousSession = $customer->createToken('existing', ['customer'])->plainTextToken;
        $token = Password::broker('customers')->createToken($customer);
        $this->postJson('/api/v1/customer/reset-password', [
            'email' => $customer->email, 'token' => $token,
            'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!',
        ])->assertOk();
        $this->assertSame(0, $customer->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($previousSession)->getJson('/api/v1/customer/me')->assertUnauthorized();
    }

    public function test_admin_password_reset_revokes_existing_sessions(): void
    {
        $admin = AdminUser::factory()->create();
        $previousSession = $admin->createToken('existing', ['admin'])->plainTextToken;
        $token = Password::broker('admin_users')->createToken($admin);
        $this->postJson('/api/admin/reset-password', [
            'email' => $admin->email, 'token' => $token,
            'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!',
        ])->assertOk();
        $this->assertSame(0, $admin->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($previousSession)->getJson('/api/admin/me')->assertUnauthorized();
    }

    public function test_admin_login_rejects_non_string_password_without_server_error(): void
    {
        $admin = AdminUser::factory()->create();
        $this->postJson('/api/admin/login', ['email' => $admin->email, 'password' => ['invalid']])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_failed_password_reset_preserves_existing_sessions(): void
    {
        $customer = Customer::factory()->create();
        $customer->createToken('existing', ['customer']);
        $this->postJson('/api/v1/customer/reset-password', [
            'email' => $customer->email, 'token' => 'invalid',
            'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!',
        ])->assertUnprocessable();
        $this->assertSame(1, $customer->tokens()->count());
    }

    public function test_reset_endpoints_reject_non_string_password_and_token(): void
    {
        foreach (['/api/admin/reset-password', '/api/v1/customer/reset-password'] as $path) {
            $this->postJson($path, [
                'email' => 'isolated@example.com', 'token' => ['invalid'],
                'password' => array_fill(0, 8, 'invalid'), 'password_confirmation' => array_fill(0, 8, 'invalid'),
            ])->assertUnprocessable()->assertJsonValidationErrors(['password', 'token']);
        }
    }
}
