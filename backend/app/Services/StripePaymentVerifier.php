<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerPaymentMethod;
use Illuminate\Support\Facades\Log;
use Stripe\PaymentIntent;
use Stripe\PaymentMethod as StripePaymentMethod;
use Stripe\Stripe;

/**
 * Verifies Stripe PaymentIntents and manages card save/detach after checkout.
 *
 * Extracted from FormController::order() to keep the controller thin
 * and share verification with webhook reconciliation.
 */
class StripePaymentVerifier
{
    public function __construct(private StripeGateway $gateway) {}

    public function verify(string $paymentIntentId, float $expectedTotal, string $method = 'card', ?string $fingerprint = null): array
    {
        try {
            return $this->inspect($this->gateway->retrieveIntent($paymentIntentId), $expectedTotal, $method, $fingerprint);
        } catch (PaymentVerificationException $e) {
            throw $e;
        } catch (\Exception $e) {
            report($e);
            throw PaymentVerificationException::verificationFailed($e);
        }
    }

    public function inspect(PaymentIntent $intent, float $expectedTotal, string $method, ?string $fingerprint = null): array
    {
        $data = $intent->toArray();
        $expectedAmount = (int) round($expectedTotal * 100);
        if (($data['currency'] ?? '') !== 'gbp' || (int) $data['amount'] !== $expectedAmount
            || ($data['status'] === 'succeeded' && (int) ($data['amount_received'] ?? 0) !== $expectedAmount)) {
            throw PaymentVerificationException::amountMismatch((int) $data['amount'], $expectedAmount);
        }
        if ($fingerprint !== null && ! hash_equals($fingerprint, $data['metadata']['checkout_fingerprint'] ?? '')) {
            throw new PaymentVerificationException('Payment does not belong to this checkout.', 'checkout_mismatch');
        }
        $bank = $method === 'bank_transfer';
        if (($data['payment_method_types'] ?? []) !== [$bank ? 'customer_balance' : 'card']) {
            throw new PaymentVerificationException('The payment method does not match this order.', 'method_mismatch');
        }
        if ($bank && empty($data['customer'])) {
            throw new PaymentVerificationException('The bank transfer has no customer.', 'missing_customer');
        }
        $instructions = $data['next_action']['display_bank_transfer_instructions'] ?? null;
        $validPendingBank = $bank && ($data['status'] === 'processing'
            || ($data['status'] === 'requires_action' && $instructions));
        if ($data['status'] !== 'succeeded' && ! $validPendingBank) {
            throw PaymentVerificationException::notSucceeded($data['status']);
        }
        $details = null;
        if ($bank && $instructions) {
            $address = collect($instructions['financial_addresses'] ?? [])->firstWhere('type', 'sort_code');
            $gb = $address['sort_code'] ?? [];
            $details = [
                'provider' => 'stripe',
                'bank_name' => $gb['bank_name'] ?? '',
                'account_name' => $gb['account_holder_name'] ?? '',
                'sort_code' => $gb['sort_code'] ?? '',
                'account_number' => $gb['account_number'] ?? '',
                'reference' => $instructions['reference'] ?? '',
                'amount_remaining' => (int) ($instructions['amount_remaining'] ?? $expectedAmount),
                'currency' => 'gbp',
                'hosted_instructions_url' => $instructions['hosted_instructions_url'] ?? null,
            ];
        }

        return [
            'status' => $data['status'] === 'succeeded' ? 'paid' : 'pending',
            'receipt_url' => is_array($data['latest_charge'] ?? null) ? ($data['latest_charge']['receipt_url'] ?? null) : null,
            'bank_transfer_details' => $details,
        ];
    }

    /**
     * After checkout, either save or detach the payment method depending on the user's choice.
     *
     * @param  bool  $saveCard  Whether the customer opted to save the card
     */
    public function handlePostCheckoutCard(
        Customer $customer,
        string $paymentIntentId,
        bool $saveCard
    ): void {
        if (! $customer->stripe_customer_id) {
            return;
        }

        try {
            Stripe::setApiKey(config('services.stripe.secret'));
            $intent = PaymentIntent::retrieve($paymentIntentId);

            if (! $intent->payment_method) {
                return;
            }

            if (! $saveCard) {
                // Detach the card unless it's already saved locally
                $isAlreadySaved = CustomerPaymentMethod::where('stripe_payment_method_id', $intent->payment_method)
                    ->where('customer_id', $customer->id)
                    ->exists();

                if (! $isAlreadySaved) {
                    $pm = StripePaymentMethod::retrieve($intent->payment_method);
                    if ($pm->customer) {
                        $pm->detach();
                    }
                }
            } else {
                // Save the card locally so it shows immediately in the dashboard
                $pm = StripePaymentMethod::retrieve($intent->payment_method);
                CustomerPaymentMethod::updateOrCreate(
                    ['stripe_payment_method_id' => $pm->id],
                    [
                        'customer_id' => $customer->id,
                        'brand' => $pm->card->brand ?? 'card',
                        'last4' => $pm->card->last4 ?? '****',
                        'exp_month' => str_pad($pm->card->exp_month ?? '01', 2, '0', STR_PAD_LEFT),
                        'exp_year' => $pm->card->exp_year ?? '2099',
                    ]
                );
            }
        } catch (\Exception $e) {
            Log::error('Failed to save or detach card: '.$e->getMessage());
        }
    }
}
