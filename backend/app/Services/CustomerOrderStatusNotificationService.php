<?php

namespace App\Services;

use App\Mail\CustomerOrderStatusUpdate;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class CustomerOrderStatusNotificationService
{
    public function send(Order $order, string $previousStatus): void
    {
        if (! $order->customer_email) {
            return;
        }

        try {
            Mail::to($order->customer_email)->send(new CustomerOrderStatusUpdate($order, $previousStatus));
        } catch (Throwable $exception) {
            Log::error('Failed to send customer order status email', [
                'order_id' => $order->id,
                'order_status' => $order->status,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
