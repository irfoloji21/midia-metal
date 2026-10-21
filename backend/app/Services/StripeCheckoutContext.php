<?php

namespace App\Services;

use App\Models\Customer;
use Illuminate\Support\Facades\Crypt;

/** Binds a Stripe payment to the basket, addresses and customer that initiated it. */
class StripeCheckoutContext
{
    public function fingerprint(array $data, ?Customer $customer): string
    {
        $context = [
            'customer_id' => $customer?->id,
            'email' => strtolower(trim($data['customer_email'] ?? '')),
            'name' => trim($data['customer_name'] ?? ''),
            'shipping_address' => trim($data['shipping_address'] ?? ''),
            'billing_address' => trim($data['billing_address'] ?? ''),
            'method' => $data['payment_method'],
            'items' => $data['items'],
            'coupon' => $data['coupon_code'] ?? null,
            'fulfilment' => $data['fulfilment_method'] ?? 'delivery',
            'shipping_quote' => $data['shipping_option_token'] ?? null,
        ];
        $sort = function (array &$value) use (&$sort): void {
            foreach ($value as &$item) {
                if (is_array($item)) {
                    $sort($item);
                }
            }
            if (! array_is_list($value)) {
                ksort($value);
            }
        };
        $sort($context);

        return hash('sha256', json_encode($context, JSON_THROW_ON_ERROR));
    }

    public function issue(string $intentId, string $fingerprint): string
    {
        return Crypt::encryptString(json_encode([
            'intent' => $intentId,
            'fingerprint' => $fingerprint,
            'expires' => now()->addDays(7)->timestamp,
        ], JSON_THROW_ON_ERROR));
    }

    public function validate(array $data, ?Customer $customer): string
    {
        try {
            $context = json_decode(Crypt::decryptString($data['payment_token']), true, 512, JSON_THROW_ON_ERROR);
            $fingerprint = $this->fingerprint($data, $customer);
            if (($context['expires'] ?? 0) < now()->timestamp
                || ! hash_equals($context['intent'] ?? '', $data['stripe_payment_intent_id'])
                || ! hash_equals($context['fingerprint'] ?? '', $fingerprint)) {
                throw new \RuntimeException('Mismatched checkout context.');
            }

            return $fingerprint;
        } catch (\Throwable $e) {
            throw new PaymentVerificationException('Your payment session has changed or expired. Please return to checkout.', 'invalid_checkout_context', $e);
        }
    }
}
