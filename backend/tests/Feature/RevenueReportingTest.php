<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RevenueReportingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->travelTo(now()->setDate(2026, 10, 18)->startOfDay());
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    private function order(string $status, float $total, array $attributes = []): Order
    {
        return Order::factory()->create($attributes + [
            'payment_status' => $status, 'total' => $total, 'subtotal' => $total,
            'shipping' => 0, 'discount_amount' => 0,
        ])->fresh();
    }

    private function item(Order $order, Product $product, float $price, int $quantity = 1): void
    {
        OrderItem::factory()->create(['order_id' => $order->id, 'product_id' => $product->id,
            'product_name' => $product->name, 'product_price' => '£'.number_format($price, 2), 'quantity' => $quantity]);
    }

    public function test_report_regression_and_year_month_boundaries(): void
    {
        $this->order('paid', 2439);
        $this->order('pending', 7548.25);
        $this->order('refunded', 953.75);
        $this->order('paid', 9000, ['created_at' => '2025-10-18 00:00:00']);
        $this->order('paid', 8000, ['created_at' => '2026-09-30 23:59:59']);
        $this->order('paid', 7000, ['created_at' => '2026-11-01 00:00:00']);
        $this->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('payments.net_collected', 2439)
            ->assertJsonPath('payments.pending_payments', 7548.25)
            ->assertJsonPath('payments.completed_refunds', 953.75)
            ->assertJsonPath('payments.unreconciled_orders', 0)
            ->assertJsonPath('stats.monthly_revenue', 2439)
            ->assertJsonPath('period.label', 'October 2026');
    }

    public function test_only_completed_refunds_reduce_collection_and_unknown_amounts_are_flagged(): void
    {
        $this->order('paid', 120);
        $this->order('partially_refunded', 100, ['refunded_amount' => 30]);
        $this->order('pending', 200);
        $this->order('pending', 50, ['bank_transfer_details' => ['amount_remaining' => 1000]]);
        $this->order('refunded', 90);
        $this->order('refund_pending', 80, ['refunded_amount' => 20]);
        $this->order('refund_failed', 60, ['refunded_amount' => 0]);
        $this->order('manual_refund_pending', 50, ['refunded_amount' => 0]);
        $this->order('failed', 70);
        $this->order('partially_refunded', 500, ['refunded_amount' => null]);
        $this->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('payments.net_collected', 360)
            ->assertJsonPath('payments.pending_payments', 210)
            ->assertJsonPath('payments.completed_refunds', 140)
            ->assertJsonPath('payments.unreconciled_orders', 1);
    }

    public function test_top_products_exclude_unpaid_and_full_refunds_and_allocate_discounts_and_partial_refunds(): void
    {
        $a = Product::factory()->create(['name' => 'Same name']);
        $b = Product::factory()->create(['name' => 'Same name']);
        $order = $this->order('partially_refunded', 100, ['subtotal' => 100, 'shipping' => 10, 'discount_amount' => 10, 'refunded_amount' => 20]);
        $this->item($order, $a, 60);
        $this->item($order, $b, 20, 2);
        foreach (['pending', 'failed', 'refunded'] as $status) {
            $this->item($this->order($status, 1000), $a, 1000, 10);
        }
        $this->item($this->order('paid', 900, ['created_at' => '2025-10-18']), $a, 900);
        $rows = collect($this->getJson('/api/admin/stats/top-products')->assertOk()->json())->keyBy('product_id');
        $this->assertCount(2, $rows);
        $this->assertEquals(43.20, $rows[$a->id]['total_revenue']);
        $this->assertEquals(28.80, $rows[$b->id]['total_revenue']);
        $this->assertSame(1, $rows[$a->id]['total_sold']);
        $this->assertSame(2, $rows[$b->id]['total_sold']);
    }

    public function test_product_allocation_preserves_pennies(): void
    {
        $order = $this->order('partially_refunded', 3, ['refunded_amount' => 1]);
        foreach (range(1, 3) as $i) {
            $this->item($order, Product::factory()->create(), 1);
        }
        $rows = $this->getJson('/api/admin/stats/top-products')->assertOk()->json();
        $this->assertEquals(2, array_sum(array_column($rows, 'total_revenue')));
    }

    public function test_sales_overview_uses_the_same_accounting_on_sqlite_and_crosses_years(): void
    {
        $this->travelTo(now()->setDate(2027, 1, 12));
        $this->order('paid', 100, ['created_at' => '2027-01-01']);
        $this->order('pending', 500, ['created_at' => '2027-01-01']);
        $this->order('refunded', 60, ['created_at' => '2027-01-01']);
        $this->order('paid', 200, ['created_at' => '2026-12-31 23:59:59']);
        $this->order('paid', 999, ['created_at' => '2026-01-12']);
        $response = $this->getJson('/api/admin/stats/sales-overview')->assertOk()->assertJsonCount(12);
        $response->assertJsonPath('0.month', '2027-01')->assertJsonPath('0.revenue', 100)
            ->assertJsonPath('0.pending_payments', 500)->assertJsonPath('0.completed_refunds', 60)
            ->assertJsonPath('1.month', '2026-12')->assertJsonPath('1.revenue', 200);
    }

    public function test_historical_refunds_are_backfilled_without_guessing_partial_amounts(): void
    {
        $full = $this->order('refunded', 40);
        $partial = $this->order('partially_refunded', 80, ['refunded_amount' => 20]);
        $pending = $this->order('pending', 100);
        $migration = require database_path('migrations/2026_10_18_190000_add_refunded_amount_to_orders.php');
        $migration->down();
        $migration->up();
        $this->assertSame('40.00', $full->fresh()->refunded_amount);
        $this->assertNull($partial->fresh()->refunded_amount);
        $this->assertSame('0.00', $pending->fresh()->refunded_amount);
    }
}
