<?php

namespace Tests\Feature;

use App\Jobs\RefundStripePayment;
use App\Models\AdminUser;
use App\Models\ContactMessage;
use App\Models\Order;
use App\Services\CustomerOrderRequestNotificationService;
use App\Services\StripeGateway;
use App\Services\StripeRefundAccounting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Fakes\StripeGatewayFake;
use Tests\TestCase;

class RefundAccountingTest extends TestCase
{
    use RefreshDatabase;

    private StripeGatewayFake $gateway;

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        $this->gateway = new StripeGatewayFake;
        $this->app->instance(StripeGateway::class, $this->gateway);
        $this->order = Order::factory()->paid()->create(['total' => 100, 'shipping' => 0, 'subtotal' => 100]);
    }

    public function test_repeated_partial_refunds_accumulate_then_become_a_full_refund(): void
    {
        $url = '/api/admin/orders/'.$this->order->id.'/refund';
        $this->postJson($url, ['amount' => 40])->assertOk()->assertJsonPath('order.payment_status', 'partially_refunded')->assertJsonPath('order.refunded_amount', '40.00');
        $this->postJson($url, ['amount' => 60])->assertOk()->assertJsonPath('order.payment_status', 'refunded')->assertJsonPath('order.refunded_amount', '100.00');
        $this->assertCount(2, $this->gateway->refunds);
        $this->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('payments.net_collected', 0)->assertJsonPath('payments.completed_refunds', 100);
    }

    public function test_pending_and_failed_refunds_do_not_reduce_collected_money(): void
    {
        $this->gateway->nextRefundStatus = 'pending';
        $this->postJson('/api/admin/orders/'.$this->order->id.'/refund', ['amount' => 40])->assertOk()
            ->assertJsonPath('order.payment_status', 'refund_pending')->assertJsonPath('order.refunded_amount', '0.00');
        $this->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('payments.net_collected', 100)->assertJsonPath('payments.completed_refunds', 0);
        $this->gateway->refunds[0]['status'] = 'failed';
        app(StripeRefundAccounting::class)->sync($this->order);
        $this->assertSame('refund_failed', $this->order->fresh()->payment_status);
        $this->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('payments.net_collected', 100);
    }

    public function test_cancellation_job_records_full_refund_and_is_idempotent(): void
    {
        $message = ContactMessage::create(['name' => 'QA', 'email' => 'qa@example.com', 'message' => 'Test refund',
            'message_type' => 'order_request', 'order_id' => $this->order->id, 'request_type' => 'cancel_refund', 'request_status' => 'approved']);
        $job = new RefundStripePayment($message->id);
        $job->handle(app(CustomerOrderRequestNotificationService::class), $this->gateway, app(StripeRefundAccounting::class));
        $job->handle(app(CustomerOrderRequestNotificationService::class), $this->gateway, app(StripeRefundAccounting::class));
        $this->assertSame('100.00', $this->order->fresh()->refunded_amount);
        $this->assertSame('refunded', $this->order->fresh()->payment_status);
        $this->assertCount(1, $this->gateway->refundRequests);
    }

    public function test_reconciliation_reads_stripe_without_creating_a_refund(): void
    {
        $this->order->update(['payment_status' => 'partially_refunded', 'refunded_amount' => null]);
        $this->gateway->refunds = [['id' => 're_old', 'status' => 'succeeded', 'amount' => 2500]];
        $this->artisan('orders:reconcile-refunds')->assertExitCode(0);
        $this->assertSame('25.00', $this->order->fresh()->refunded_amount);
        $this->assertCount(0, $this->gateway->refundRequests);
    }
}
