<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPaymentMethod;
use App\Services\StripeCheckoutContext;
use App\Services\StripeGateway;
use App\Services\PaymentVerificationException;
use App\Support\CheckoutCalculator;
use Illuminate\Http\Request;
use Stripe\PaymentMethod as StripePaymentMethod;
use Stripe\Stripe;

class PaymentController extends Controller
{
    public function __construct(
        private CheckoutCalculator $checkoutCalculator,
        private StripeGateway $gateway,
        private StripeCheckoutContext $context,
    ) {}

    /**
     * Create a Stripe PaymentIntent for the given amount.
     */
    public function createIntent(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_variants' => 'nullable|array',
            'coupon_code' => 'nullable|string',
            'fulfilment_method' => 'nullable|in:delivery,click_collect',
            'shipping_option_token' => 'nullable|string',
            'payment_method' => 'required|in:card,bank_transfer',
            'payment_attempt_id' => 'required|uuid',
            'customer_email' => 'required|email|max:255',
            'customer_name' => 'required|string|max:255',
            'shipping_address' => 'required|string|max:2000',
            'billing_address' => 'required|string|max:2000',
            'save_card' => 'nullable|boolean',
        ]);

        $totals = $this->checkoutCalculator->calculate(
            $validated['items'],
            $validated['coupon_code'] ?? null,
            $validated['fulfilment_method'] ?? 'delivery',
            $validated['shipping_option_token'] ?? null,
        );

        $amountInPence = (int) round($totals['total'] * 100);
        if ($amountInPence <= 0) {
            return response()->json(['message' => 'The order total must be greater than zero.'], 422);
        }
        $customer = auth('sanctum')->user();
        $customer = $customer instanceof Customer ? $customer : null;
        $fingerprint = $this->context->fingerprint($validated, $customer);
        $attemptKey = hash('sha256', $validated['payment_attempt_id'].$fingerprint);
        $bankTransfer = $validated['payment_method'] === 'bank_transfer';

        if ($bankTransfer && ! config('services.stripe.webhook_secret')) {
            return response()->json(['message' => 'Bank transfer is currently unavailable. Please choose card payment.'], 503);
        }

        $intentData = [
            'amount' => $amountInPence,
            'currency' => 'gbp',
            'payment_method_types' => [$bankTransfer ? 'customer_balance' : 'card'],
            'metadata' => ['checkout_source' => 'midia-metal', 'checkout_fingerprint' => $fingerprint],
        ];

        try {
            if ($customer || $bankTransfer) {
                $stripeCustomerId = $customer?->stripe_customer_id;
                if (! $stripeCustomerId) {
                    $stripeCustomerId = $this->gateway->createCustomer([
                        'email' => $customer?->email ?? $validated['customer_email'],
                        'name' => $customer?->name ?? $validated['customer_name'],
                    ], 'customer-'.($customer ? $customer->id : $attemptKey));
                    $customer?->update(['stripe_customer_id' => $stripeCustomerId]);
                }
                $intentData['customer'] = $stripeCustomerId;
            }
            if ($bankTransfer) {
                $intentData['payment_method_options'] = [
                    'customer_balance' => [
                        'funding_type' => 'bank_transfer',
                        'bank_transfer' => ['type' => 'gb_bank_transfer'],
                    ],
                ];
                $intentData['payment_method_data'] = ['type' => 'customer_balance'];
                $intentData['confirm'] = true;
            } elseif ($customer && ! empty($validated['save_card'])) {
                $intentData['setup_future_usage'] = 'off_session';
            }
            $intent = $this->gateway->createIntent($intentData, 'payment-'.$attemptKey.'-'.(! empty($validated['save_card']) ? 'save' : 'once'));
        } catch (\Exception $e) {
            report($e);

            return response()->json(['message' => $bankTransfer
                ? 'Bank transfer is currently unavailable. Please choose card payment or try again later.'
                : 'Card payment is currently unavailable. Please try again later.'], 503);
        }

        return response()->json([
            'client_secret' => $intent->client_secret,
            'payment_intent_id' => $intent->id,
            'payment_token' => $this->context->issue($intent->id, $fingerprint),
            'amount' => $totals['total'],
        ]);
    }

    public function status(Request $request)
    {
        $data = $request->validate([
            'stripe_payment_intent_id' => 'required|string|starts_with:pi_',
            'payment_token' => 'required|string',
            'customer_email' => 'required|email', 'customer_name' => 'required|string',
            'shipping_address' => 'required|string', 'billing_address' => 'required|string',
            'payment_method' => 'required|in:card,bank_transfer',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer', 'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_variants' => 'nullable|array',
            'coupon_code' => 'nullable|string', 'fulfilment_method' => 'nullable|in:delivery,click_collect',
            'shipping_option_token' => 'nullable|string',
        ]);
        $customer = auth('sanctum')->user();
        try {
            $fingerprint = $this->context->validate($data, $customer instanceof Customer ? $customer : null);
            $intent = $this->gateway->retrieveIntent($data['stripe_payment_intent_id']);
            if (! hash_equals($fingerprint, $intent->metadata->checkout_fingerprint ?? '')) {
                return response()->json(['message' => 'Payment does not belong to this checkout.'], 403);
            }
            return response()->json(['status' => $intent->status]);
        } catch (PaymentVerificationException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Unable to check payment status. Please try again.'], 503);
        }
    }

    /**
     * Sync and List Saved Cards
     */
    public function listSavedCards(Request $request)
    {
        $customer = auth('sanctum')->user();
        if (! $customer instanceof Customer) {
            return response()->json([]);
        }

        if (! $customer || ! $customer->stripe_customer_id) {
            return response()->json([]);
        }

        Stripe::setApiKey(config('services.stripe.secret'));

        // Fetch from Stripe
        $stripeMethods = StripePaymentMethod::all([
            'customer' => $customer->stripe_customer_id,
            'type' => 'card',
        ]);

        $activeIds = [];
        foreach ($stripeMethods->data as $pm) {
            $activeIds[] = $pm->id;
            CustomerPaymentMethod::updateOrCreate(
                ['stripe_payment_method_id' => $pm->id],
                [
                    'customer_id' => $customer->id,
                    'brand' => $pm->card->brand,
                    'last4' => $pm->card->last4,
                    'exp_month' => str_pad($pm->card->exp_month, 2, '0', STR_PAD_LEFT),
                    'exp_year' => $pm->card->exp_year,
                ]
            );
        }

        // Clean up detached methods locally
        CustomerPaymentMethod::where('customer_id', $customer->id)
            ->whereNotIn('stripe_payment_method_id', $activeIds)
            ->delete();

        return response()->json($customer->paymentMethods()->latest()->get());
    }

    /**
     * Delete a saved card
     */
    public function deleteSavedCard(Request $request, $id)
    {
        $customer = auth('sanctum')->user();
        if (! $customer instanceof Customer) {
            abort(403);
        }

        $method = CustomerPaymentMethod::where('customer_id', $customer->id)
            ->where('id', $id)
            ->firstOrFail();

        Stripe::setApiKey(config('services.stripe.secret'));
        try {
            $stripeMethod = StripePaymentMethod::retrieve($method->stripe_payment_method_id);
            $stripeMethod->detach();
        } catch (\Exception $e) {
            // Might already be detached
        }

        $method->delete();

        return response()->json(['message' => 'Card removed successfully']);
    }
}
