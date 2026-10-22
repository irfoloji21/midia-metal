<?php

namespace Tests\Feature;

use App\Mail\CustomerPasswordReset;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CustomerPasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_request_and_use_reset_link_only_once(): void
    {
        Mail::fake();
        $customer = Customer::create(['name' => 'Test Customer', 'email' => 'customer+test@example.com', 'password' => 'OldPassword123!']);
        $this->postJson('/api/v1/customer/forgot-password', ['email' => $customer->email])->assertOk();
        $mail = Mail::sent(CustomerPasswordReset::class)->first();
        $this->assertNotNull($mail);
        parse_str(parse_url($mail->resetUrl, PHP_URL_QUERY), $credentials);
        $this->assertSame($customer->email, $credentials['email']);
        $payload = [...$credentials, 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'];
        $this->postJson('/api/v1/customer/reset-password', $payload)->assertOk();
        $this->assertTrue(Hash::check('NewPassword123!', $customer->fresh()->password));
        $this->postJson('/api/v1/customer/reset-password', $payload)->assertUnprocessable();
    }

    public function test_invalid_reset_token_does_not_change_the_password(): void
    {
        $customer = Customer::create(['name' => 'Test Customer', 'email' => 'customer@example.com', 'password' => 'OldPassword123!']);
        $this->postJson('/api/v1/customer/reset-password', ['email' => $customer->email, 'token' => 'invalid', 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'])
            ->assertUnprocessable();
        $this->assertTrue(Hash::check('OldPassword123!', $customer->fresh()->password));
    }
}
