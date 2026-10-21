<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Stripe\Refund;

class StripeRefundAccounting
{
    public function __construct(private StripeGateway $gateway) {}

    public function sync(Order $order, ?Refund $justCreated = null): Order
    {
        return DB::transaction(function () use ($order, $justCreated) {
            // Serialize the read from Stripe as well as the write, so an older
            // concurrent webhook cannot overwrite a newer refund total.
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $refunds = collect($this->gateway->listRefunds($locked->stripe_payment_intent_id));
            if ($justCreated && ! $refunds->contains('id', $justCreated->id)) {
                $refunds->push($justCreated->toArray());
            }
            $completed = (int) $refunds->where('status', 'succeeded')->sum('amount');
            $total = (int) round((float) $locked->total * 100);
            if ($completed < 0 || $completed > $total) {
                throw new \RuntimeException('Stripe refund total does not match the order.');
            }
            $pending = $refunds->whereIn('status', ['pending', 'requires_action'])->isNotEmpty();
            $status = $completed >= $total ? 'refunded' : ($pending ? 'refund_pending'
                : ($completed > 0 ? 'partially_refunded' : ($refunds->isEmpty() ? 'paid' : 'refund_failed')));
            $locked->update(['refunded_amount' => $completed / 100, 'payment_status' => $status]);

            return $locked;
        });
    }
}
