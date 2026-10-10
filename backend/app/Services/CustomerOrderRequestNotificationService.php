<?php

namespace App\Services;

use App\Mail\CustomerOrderRequestUpdate;
use App\Models\ContactMessage;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class CustomerOrderRequestNotificationService
{
    public function sendForRequest(ContactMessage $orderRequest, string $event): void
    {
        $orderRequest->loadMissing('order');
        $email = $orderRequest->email ?: $orderRequest->order?->customer_email;

        if (! $email) {
            return;
        }

        try {
            Mail::to($email)->send(new CustomerOrderRequestUpdate($orderRequest, $event));
        } catch (Throwable $exception) {
            Log::error('Failed to send customer order request update email', [
                'contact_message_id' => $orderRequest->id,
                'event' => $event,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function sendLatestForOrder(Order $order, string $event): void
    {
        $orderRequest = ContactMessage::query()
            ->where('order_id', $order->id)
            ->where('message_type', 'order_request')
            ->where('request_type', 'cancel_refund')
            ->latest()
            ->first();

        if ($orderRequest) {
            $this->sendForRequest($orderRequest, $event);
        }
    }
}
