<?php

namespace App\Services;

use App\Models\Order;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/** Order-date reporting, in GBP pence; this is not a payment-date cash-flow report. */
class OrderRevenue
{
    public const COLLECTED_STATUSES = ['paid', 'refunded', 'partially_refunded', 'refund_pending', 'manual_refund_pending', 'refund_failed'];

    public function period(): array
    {
        $start = now()->startOfMonth();

        return ['start' => $start, 'end' => $start->copy()->addMonth(), 'label' => $start->format('F Y')];
    }

    public function orders(CarbonInterface $start, CarbonInterface $end): Builder
    {
        return Order::where('created_at', '>=', $start)->where('created_at', '<', $end);
    }

    public function amounts(Order $order): array
    {
        $total = $this->pence($order->total);
        $result = ['net_collected' => 0, 'pending_payments' => 0, 'completed_refunds' => 0, 'unreconciled_orders' => 0];
        if ($order->payment_status === 'pending') {
            $remaining = data_get($order->bank_transfer_details, 'amount_remaining');
            $result['pending_payments'] = is_numeric($remaining) ? max(0, min($total, (int) $remaining)) : $total;
        } elseif (in_array($order->payment_status, self::COLLECTED_STATUSES, true)) {
            if ($order->payment_status !== 'refunded' && $order->refunded_amount === null) {
                $result['unreconciled_orders'] = 1;
            } else {
                $refunded = $order->payment_status === 'refunded' ? $total : min($total, $this->pence($order->refunded_amount));
                $result['net_collected'] = $total - $refunded;
                $result['completed_refunds'] = $refunded;
            }
        }

        return $result;
    }

    public function totals(Builder $query): array
    {
        $totals = ['net_collected' => 0, 'pending_payments' => 0, 'completed_refunds' => 0, 'unreconciled_orders' => 0];
        foreach ($query->lazyById(250) as $order) {
            foreach ($this->amounts($order) as $key => $amount) {
                $totals[$key] += $amount;
            }
        }
        foreach (['net_collected', 'pending_payments', 'completed_refunds'] as $key) {
            $totals[$key] /= 100;
        }

        return $totals;
    }

    public function topProducts(Builder $query): array
    {
        $products = [];
        foreach ($query->whereIn('payment_status', self::COLLECTED_STATUSES)->with('items')->lazyById(250) as $order) {
            $net = $this->amounts($order)['net_collected'];
            $total = $this->pence($order->total);
            if ($net <= 0 || $total <= 0) {
                continue;
            }
            $lines = $order->items->map(fn ($item) => $this->pence($item->product_price) * $item->quantity);
            $grossProducts = $lines->sum();
            if ($grossProducts <= 0) {
                continue;
            }
            $discountedProducts = max(0, $grossProducts - $this->pence($order->discount_amount));
            // Refunds have no line-item allocation. Allocate proportionally across
            // discounted products and delivery; never fabricate returned quantities.
            $productNet = (int) round(min($total, $discountedProducts) * $net / $total);
            $allocated = 0;
            $lineAmounts = [];
            foreach ($lines as $index => $gross) {
                $exact = $productNet * $gross / $grossProducts;
                $lineAmounts[$index] = ['pence' => (int) floor($exact), 'remainder' => $exact - floor($exact)];
                $allocated += $lineAmounts[$index]['pence'];
            }
            uasort($lineAmounts, fn ($a, $b) => $b['remainder'] <=> $a['remainder']);
            $extra = $productNet - $allocated;
            foreach ($lineAmounts as &$line) {
                if ($extra-- > 0) {
                    $line['pence']++;
                }
            }
            unset($line);
            foreach ($order->items as $index => $item) {
                $key = $item->product_id ? 'id:'.$item->product_id : 'name:'.$item->product_name;
                $products[$key] ??= ['product_id' => $item->product_id, 'product_name' => $item->product_name, 'total_sold' => 0, 'total_revenue' => 0];
                $products[$key]['total_sold'] += $item->quantity;
                $products[$key]['total_revenue'] += $lineAmounts[$index]['pence'];
            }
        }
        usort($products, fn ($a, $b) => ($b['total_sold'] <=> $a['total_sold']) ?: ($b['total_revenue'] <=> $a['total_revenue']));

        return array_map(function ($product) {
            $product['total_revenue'] /= 100;

            return $product;
        }, array_slice($products, 0, 5));
    }

    private function pence(mixed $amount): int
    {
        return max(0, (int) round((float) str_replace(['£', ','], '', (string) $amount) * 100));
    }
}
