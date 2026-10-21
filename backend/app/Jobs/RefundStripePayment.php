<?php

namespace App\Jobs;

use App\Models\ContactMessage;
use App\Services\CustomerOrderRequestNotificationService;
use App\Services\StripeGateway;
use App\Services\StripeRefundAccounting;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\InvalidRequestException;
use Throwable;

class RefundStripePayment implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public int $contactMessageId,
    ) {}

    public function handle(CustomerOrderRequestNotificationService $notifications, StripeGateway $gateway, StripeRefundAccounting $refundAccounting): void
    {
        $contactMessage = ContactMessage::with('order')->find($this->contactMessageId);
        if (! $contactMessage || $contactMessage->message_type !== 'order_request') {
            return;
        }

        $order = $contactMessage->order;
        if (! $order || ! $order->stripe_payment_intent_id) {
            return;
        }

        if ($order->payment_status === 'refunded') {
            return;
        }

        try {
            $refund = $gateway->createRefund([
                'payment_intent' => $order->stripe_payment_intent_id,
                'metadata' => [
                    'order_id' => (string) $order->id,
                    'order_number' => (string) $order->order_number,
                    'request_id' => (string) $contactMessage->id,
                ],
            ], 'cancellation-refund-'.$contactMessage->id);

            $order->update(['payment_status' => 'refund_pending', 'refunded_amount' => null]);
            $order = $refundAccounting->sync($order, $refund);
            $completed = $order->payment_status === 'refunded';
            $pending = $order->payment_status === 'refund_pending';
            $notifications->sendForRequest($contactMessage, $completed ? 'refund_completed' : ($pending ? 'refund_processing' : 'refund_failed'));
        } catch (InvalidRequestException $exception) {
            $message = strtolower($exception->getMessage());

            if (str_contains($message, 'already been refunded')) {
                $order = $refundAccounting->sync($order);
                $notifications->sendForRequest($contactMessage, 'refund_completed');

                return;
            }

            $order->update(['payment_status' => 'refund_failed']);
            throw $exception;
        } catch (Throwable $throwable) {
            $order->update(['payment_status' => 'refund_failed']);
            throw $throwable;
        }
    }

    public function failed(Throwable $exception): void
    {
        $contactMessage = ContactMessage::with('order')->find($this->contactMessageId);
        if ($contactMessage?->order) {
            $contactMessage->order->update(['payment_status' => 'refund_failed']);
        }

        if ($contactMessage) {
            app(CustomerOrderRequestNotificationService::class)->sendForRequest($contactMessage, 'refund_failed');
        }

        Log::error('Stripe refund job failed', [
            'contact_message_id' => $this->contactMessageId,
            'error' => $exception->getMessage(),
        ]);
    }
}
