<?php

namespace App\Jobs;

use App\Models\ContactMessage;
use App\Services\CustomerOrderRequestNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\InvalidRequestException;
use Stripe\Refund;
use Stripe\Stripe;
use Throwable;

class RefundStripePayment implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public int $contactMessageId,
    ) {}

    public function handle(CustomerOrderRequestNotificationService $notifications): void
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

        Stripe::setApiKey(config('services.stripe.secret'));

        try {
            Refund::create([
                'payment_intent' => $order->stripe_payment_intent_id,
                'metadata' => [
                    'order_id' => (string) $order->id,
                    'order_number' => (string) $order->order_number,
                    'request_id' => (string) $contactMessage->id,
                ],
            ]);

            $order->update(['payment_status' => 'refunded']);
            $notifications->sendForRequest($contactMessage, 'refund_completed');
        } catch (InvalidRequestException $exception) {
            $message = strtolower($exception->getMessage());

            if (str_contains($message, 'already been refunded')) {
                $order->update(['payment_status' => 'refunded']);
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
