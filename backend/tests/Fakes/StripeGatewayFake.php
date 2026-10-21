<?php

namespace Tests\Fakes;

use App\Services\StripeGateway;
use Stripe\PaymentIntent;
use Stripe\Refund;

class StripeGatewayFake extends StripeGateway
{
    public array $intents = [];

    public array $requests = [];

    public array $customers = [];

    public array $refunds = [];

    public array $refundRequests = [];

    public string $nextRefundStatus = 'succeeded';

    public function createRefund(array $data, string $idempotencyKey): Refund
    {
        $this->refundRequests[] = $data;
        $id = 're_'.substr(hash('sha256', $idempotencyKey), 0, 24);
        foreach ($this->refunds as $refund) {
            if (($refund['id'] ?? null) === $id) {
                return Refund::constructFrom($refund);
            }
        }
        $completed = collect($this->refunds)->where('status', 'succeeded')->sum('amount');
        $refund = $data + [
            'id' => $id, 'object' => 'refund', 'currency' => 'gbp', 'status' => $this->nextRefundStatus,
            'amount' => ($this->intents[$data['payment_intent']]['amount'] ?? 10000) - $completed,
        ];
        $this->refunds[] = $refund;

        return Refund::constructFrom($refund);
    }

    public function listRefunds(string $intentId): array
    {
        return $this->refunds;
    }

    public function createCustomer(array $data, string $idempotencyKey): string
    {
        $this->customers[] = $data;

        return 'cus_checkout_test';
    }

    public function createIntent(array $data, string $idempotencyKey): PaymentIntent
    {
        $this->requests[] = $data;
        $id = 'pi_'.substr(hash('sha256', $idempotencyKey), 0, 24);
        if (! isset($this->intents[$id])) {
            $bank = $data['payment_method_types'] === ['customer_balance'];
            $this->intents[$id] = array_merge($data, [
                'id' => $id, 'object' => 'payment_intent', 'client_secret' => $id.'_secret_test',
                'status' => $bank ? 'requires_action' : 'requires_payment_method',
                'amount_received' => 0, 'latest_charge' => null,
                'next_action' => $bank ? [
                    'type' => 'display_bank_transfer_instructions',
                    'display_bank_transfer_instructions' => [
                        'amount_remaining' => $data['amount'], 'currency' => 'gbp',
                        'reference' => 'STRIPE-TEST-REFERENCE',
                        'hosted_instructions_url' => 'https://payments.stripe.com/test/instructions',
                        'financial_addresses' => [[
                            'type' => 'sort_code',
                            'sort_code' => ['account_holder_name' => 'Test Business', 'account_number' => '00012345', 'sort_code' => '108800'],
                        ]],
                    ],
                ] : null,
            ]);
        }

        return $this->retrieveIntent($id);
    }

    public function retrieveIntent(string $id): PaymentIntent
    {
        return PaymentIntent::constructFrom($this->intents[$id]);
    }
}
