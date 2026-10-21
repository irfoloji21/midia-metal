<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\StripeRefundAccounting;
use Illuminate\Console\Command;

class ReconcileOrderRefunds extends Command
{
    protected $signature = 'orders:reconcile-refunds';

    protected $description = 'Read Stripe refund totals for historical orders with an unknown refunded amount (never creates refunds)';

    public function handle(StripeRefundAccounting $accounting): int
    {
        $failed = 0;
        foreach (Order::whereNull('refunded_amount')->lazyById(100) as $order) {
            try {
                if (! $order->stripe_payment_intent_id) {
                    throw new \RuntimeException('No Stripe payment is attached.');
                }
                $accounting->sync($order);
                $this->info($order->order_number.': reconciled');
            } catch (\Throwable $error) {
                report($error);
                $failed++;
                $this->warn($order->order_number.': refund amount remains unverified');
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
