# Stripe card and GBP bank transfer payments

Both checkout methods use Stripe PaymentIntents. Bank transfer uses `customer_balance`
with `gb_bank_transfer`; it is not Bacs Direct Debit. Stripe supplies the account details
and reference. Do not enter payout or customer-facing bank details in site settings.

## Configuration

1. Use a Stripe account eligible for GBP bank transfers and enable bank transfer in its
   payment method settings. Manage the business's payout bank account in Stripe.
2. Set `STRIPE_KEY` and `STRIPE_SECRET` on the backend, and the matching
   `PUBLIC_STRIPE_KEY` on the frontend. Keep test and live credentials separate.
3. Create a Stripe webhook destination at
   `https://<your-api-domain>/api/v1/webhooks/stripe` and subscribe to:
   - `payment_intent.succeeded`
   - `payment_intent.processing`
   - `payment_intent.requires_action`
   - `payment_intent.partially_funded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
4. Put that destination's signing secret in backend `STRIPE_WEBHOOK_SECRET`.
   This is a separate secret beginning with `whsec_`, not the API secret key.
   Refresh Laravel's configuration cache after deployment.
5. Run the migration `2026_10_16_020000_make_order_stripe_intent_unique.php` after
   checking historical non-null payment IDs for duplicates. Do not delete orders to
   resolve duplicates automatically.
6. Rebuild/redeploy the frontend when changing its publishable key.

For local testing with an authenticated Stripe CLI, forward the above events to
`http://127.0.0.1:8000/api/v1/webhooks/stripe`; use the listener's signing secret locally.
Do not put secrets in source control or chat. Bank transfer creation is unavailable
until its webhook secret is configured.

## Behaviour and verification

- Card orders require a successful payment with matching GBP amount and checkout data.
- Bank orders remain pending until Stripe confirms the full amount. Partial transfers
  update the amount remaining. Instructions appear on the confirmation page and email.
- Retries reuse the payment attempt; a unique database index prevents duplicate orders.
- Webhooks verify the raw payload signature and retrieve current Stripe state so delayed
  or duplicate events cannot mark a partially funded order paid or reverse a refund.
- Bank transfer refunds attached to Stripe follow the Stripe refund flow. Pending or
  action-required refunds remain pending until a refund webhook confirms the result.
- Legacy manual bank details are excluded from public/admin settings and cannot be
  edited. Historical order snapshots are retained for reference.

Run backend `StripeCheckoutTest`, `OrderPlacementTest`, `OrderConfirmationTest`,
`AdminSettingsTest` and `AdminOrderTest`. They use a fake Stripe gateway and an in-memory
database; they do not charge cards or transfer funds. Before going live, additionally
verify test card payment, partial/full bank funding, delayed/duplicate webhooks and
refunds in the actual Stripe test account.

References: [Stripe bank transfer integration](https://docs.stripe.com/payments/bank-transfers/accept-a-payment?payment-ui=direct-api),
[webhook signatures](https://docs.stripe.com/webhooks),
[refund states](https://docs.stripe.com/refunds).

## Dashboard payment reporting (F01)

- Apply `2026_10_18_190000_add_refunded_amount_to_orders.php` before deploying the new
  dashboard. Back up the database first. The migration records existing full refunds
  at the order total; historical partial/pending/failed refunds retain a NULL amount
  until verified. It does not contact Stripe or issue refunds.
- Run `php artisan orders:reconcile-refunds` for these unverified historical orders.
  This command only reads Stripe refunds and updates local accounting. Orders without
  a verifiable amount remain excluded with a visible dashboard warning.
- Dashboard and top products use orders **placed in the current calendar month**,
  including the year, at their current payment/refund state. This is an order-date
  report, not a cash-flow report based on the dates money moved. The sales overview
  uses the same rules for each of the last 12 calendar months, on SQLite and MySQL.
- Net Collected is successful order payments less completed refunds. Awaiting Payment
  is unpaid order value (remaining balance for partially funded bank transfers).
  Pending or failed refunds do not subtract money that has not been returned.
  Order totals include VAT and delivery, before payment processing fees.
- Completed Stripe refunds are summed in pence and persisted to `orders.refunded_amount`
  by admin refunds, cancellation refunds and verified webhooks. Repeated notifications
  replace the aggregate instead of adding it again.
- Top products exclude unpaid, fully refunded and unreconciled orders. Coupons reduce
  product revenue; delivery is excluded. Because refunds are order-level, partial
  refunds are allocated proportionally across discounted products and delivery, with
  penny-preserving rounding. The UI labels revenue as estimated. Partial-refund unit
  counts remain the original paid units; no returned item quantities are invented.
- Verify `RevenueReportingTest`, `RefundAccountingTest`, `StripeCheckoutTest`,
  `AdminOrderTest`, `OrderPlacementTest` and `OrderConfirmationTest`.
