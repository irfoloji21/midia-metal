<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\StripeGateway;
use App\Services\StripePaymentVerifier;
use App\Services\StripeRefundAccounting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function handle(Request $request, StripeGateway $gateway, StripePaymentVerifier $verifier, StripeRefundAccounting $refundAccounting)
    {
        $secret = config('services.stripe.webhook_secret');
        if (! $secret) {
            return response()->json(['message' => 'Webhook is not configured.'], 503);
        }
        try {
            $event = Webhook::constructEvent($request->getContent(), $request->header('Stripe-Signature', ''), $secret);
        } catch (\UnexpectedValueException|SignatureVerificationException $e) {
            return response()->json(['message' => 'Invalid webhook signature or payload.'], 400);
        }

        if (in_array($event->type, ['refund.created', 'refund.updated', 'refund.failed'], true)) {
            $refundIntent = $event->data->object->payment_intent;
            if (! is_string($refundIntent) || ! str_starts_with($refundIntent, 'pi_')) {
                return response()->json(['received' => true]);
            }
            $order = Order::where('stripe_payment_intent_id', $refundIntent)->first();
            if (! $order) {
                return response()->json(['received' => true]);
            }
            try {
                $refundAccounting->sync($order);
            } catch (\Exception $e) {
                report($e);

                return response()->json(['message' => 'Refund reconciliation will be retried.'], 503);
            }

            return response()->json(['received' => true]);
        }

        if (! in_array($event->type, [
            'payment_intent.succeeded', 'payment_intent.processing', 'payment_intent.requires_action',
            'payment_intent.partially_funded', 'payment_intent.payment_failed', 'payment_intent.canceled',
        ], true)) {
            return response()->json(['received' => true]);
        }

        $id = $event->data->object->id;
        $order = Order::where('stripe_payment_intent_id', $id)->first();
        if (! $order) {
            // Confirmation can reach Stripe before the browser has saved its order.
            $ours = ($event->data->object->metadata->checkout_source ?? null) === 'midia-metal';

            return response()->json(['received' => ! $ours], $ours ? 503 : 200);
        }

        try {
            // Fetch current state so delayed/duplicate events cannot reverse a newer payment.
            $intent = $gateway->retrieveIntent($id);
            $method = $order->payment_method === 'bank_transfer' ? 'bank_transfer' : 'card';
            if (in_array($intent->status, ['canceled', 'requires_payment_method'], true)) {
                DB::transaction(function () use ($order) {
                    $locked = Order::lockForUpdate()->findOrFail($order->id);
                    if ($locked->payment_status === 'pending') {
                        $locked->update(['payment_status' => 'failed']);
                    }
                });
            } else {
                $result = $verifier->inspect($intent, (float) $order->total, $method);
                DB::transaction(function () use ($order, $result) {
                    $locked = Order::lockForUpdate()->findOrFail($order->id);
                    if (! in_array($locked->payment_status, ['pending', 'failed'], true)) {
                        return;
                    }
                    $details = $result['bank_transfer_details'] ?? $locked->bank_transfer_details;
                    if ($details && $result['status'] === 'paid') {
                        $details['amount_remaining'] = 0;
                    }
                    $locked->update([
                        'payment_status' => $result['status'],
                        'stripe_receipt_url' => $result['receipt_url'] ?? $locked->stripe_receipt_url,
                        'bank_transfer_details' => $details,
                    ]);
                });
            }
        } catch (\Exception $e) {
            report($e);

            return response()->json(['message' => 'Payment reconciliation will be retried.'], 503);
        }

        return response()->json(['received' => true]);
    }
}
