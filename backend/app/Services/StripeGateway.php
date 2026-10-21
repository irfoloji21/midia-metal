<?php

namespace App\Services;

use Stripe\PaymentIntent;
use Stripe\Refund;
use Stripe\StripeClient;

class StripeGateway
{
    private function client(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    public function createCustomer(array $data, string $idempotencyKey): string
    {
        return $this->client()->customers->create($data, ['idempotency_key' => $idempotencyKey])->id;
    }

    public function createIntent(array $data, string $idempotencyKey): PaymentIntent
    {
        return $this->client()->paymentIntents->create($data, ['idempotency_key' => $idempotencyKey]);
    }

    public function listRefunds(string $intentId): array
    {
        $refunds = [];
        foreach ($this->client()->refunds->all(['payment_intent' => $intentId, 'limit' => 100])->autoPagingIterator() as $refund) {
            $refunds[] = $refund->toArray();
        }

        return $refunds;
    }

    public function createRefund(array $data, string $idempotencyKey): Refund
    {
        return $this->client()->refunds->create($data, ['idempotency_key' => $idempotencyKey]);
    }

    public function retrieveIntent(string $id): PaymentIntent
    {
        return $this->client()->paymentIntents->retrieve($id, ['expand' => ['latest_charge']]);
    }
}
