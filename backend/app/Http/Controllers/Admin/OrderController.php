<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\CustomerOrderRequestNotificationService;
use App\Services\CustomerOrderStatusNotificationService;
use App\Shipping\ShippingManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\Refund;
use Stripe\Stripe;

class OrderController extends Controller
{
    public function __construct(
        private ShippingManager $shippingManager,
        private CustomerOrderRequestNotificationService $orderRequestNotifications,
        private CustomerOrderStatusNotificationService $orderStatusNotifications,
    ) {}

    public function index(Request $request)
    {
        $query = Order::with('items')->withCount([
            'customerRequests',
            'customerRequests as unread_customer_requests_count' => fn ($customerRequestsQuery) => $customerRequestsQuery->where('read', false),
        ]);

        if ($request->search) {
            $query->where('order_number', 'like', "%{$request->search}%")
                ->orWhere('customer_name', 'like', "%{$request->search}%")
                ->orWhere('customer_email', 'like', "%{$request->search}%");
        }
        if ($request->status) {
            $query->where('status', $request->status);
        }

        return response()->json($query->latest()->paginate(15));
    }

    public function show(Order $order)
    {
        return response()->json($order->load(['items', 'customerRequests']));
    }

    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,processing,shipped,delivered,cancelled',
            'payment_status' => 'nullable|in:pending,paid,failed,refund_pending,manual_refund_pending,refunded,partially_refunded,refund_failed',
            'notes' => 'nullable|string',
            'tracking_number' => 'nullable|string|max:255',
        ]);
        $previousOrderStatus = $order->status;
        $previousPaymentStatus = $order->payment_status;
        $order->update($validated);

        if (isset($validated['status']) && $validated['status'] !== $previousOrderStatus) {
            $this->orderStatusNotifications->send($order, $previousOrderStatus);
        }

        if (isset($validated['payment_status']) && $validated['payment_status'] !== $previousPaymentStatus) {
            $event = match ($validated['payment_status']) {
                'refund_pending' => 'refund_processing',
                'manual_refund_pending' => 'manual_refund_pending',
                'refunded' => 'refund_completed',
                'partially_refunded' => 'partial_refund_completed',
                'refund_failed' => 'refund_failed',
                default => null,
            };

            if ($event) {
                $this->orderRequestNotifications->sendLatestForOrder($order, $event);
            }
        }

        return response()->json($order->load(['items', 'customerRequests']));
    }

    public function destroy(Order $order)
    {
        $order->delete();

        return response()->json(['message' => 'Order deleted']);
    }

    public function refund(Request $request, Order $order)
    {
        $validated = $request->validate([
            'amount' => 'nullable|numeric|min:0.01',
        ]);

        if ($order->payment_status !== 'paid' && $order->payment_status !== 'partially_refunded') {
            return response()->json(['message' => 'Order is not paid or already fully refunded.'], 400);
        }

        if (! $order->stripe_payment_intent_id) {
            return response()->json(['message' => 'No Stripe payment intent found for this order.'], 400);
        }

        Stripe::setApiKey(config('services.stripe.secret'));

        try {
            $refundParams = [
                'payment_intent' => $order->stripe_payment_intent_id,
            ];

            if (isset($validated['amount'])) {
                // Stripe expects amount in pence/cents
                $refundParams['amount'] = (int) round($validated['amount'] * 100);
            }

            $refund = Refund::create($refundParams);

            if ($refund->status === 'succeeded' || $refund->status === 'pending') {
                $isFullRefund = ! isset($validated['amount']) || round($validated['amount'], 2) >= round($order->total, 2);
                $newStatus = $isFullRefund ? 'refunded' : 'partially_refunded';
                $previousOrderStatus = $order->status;

                $order->update([
                    'payment_status' => $newStatus,
                    'status' => $isFullRefund ? 'cancelled' : $order->status,
                ]);
                if ($order->status !== $previousOrderStatus) {
                    $this->orderStatusNotifications->send($order, $previousOrderStatus);
                }
                $this->orderRequestNotifications->sendLatestForOrder(
                    $order,
                    $isFullRefund ? 'refund_completed' : 'partial_refund_completed',
                );

                // Void the shipping label on full refund
                if ($isFullRefund && ($order->shipping_shipment_id || ! empty(data_get($order->shipping_metadata, 'shipments')))) {
                    try {
                        $this->shippingManager->voidShipment($order);
                    } catch (\Throwable $e) {
                        Log::warning("Failed to void shipment for refunded order {$order->order_number}: ".$e->getMessage());
                    }
                }

                return response()->json([
                    'message' => 'Refund processed successfully.',
                    'order' => $order->fresh()->load(['items', 'customerRequests']),
                ]);
            }

            return response()->json(['message' => 'Refund could not be processed.'], 400);
        } catch (ApiErrorException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
