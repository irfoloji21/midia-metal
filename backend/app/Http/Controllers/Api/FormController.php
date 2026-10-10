<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AdminNotification;
use App\Models\ContactMessage;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\QuoteRequest;
use App\Services\OrderService;
use App\Services\PaymentVerificationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class FormController extends Controller
{
    public function __construct(private OrderService $orderService) {}

    protected function getAdminNotificationEmail(): string
    {
        return (string) config('services.business_notification_email', 'softwaredevelopment2181@gmail.com');
    }

    public function contact(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'phone' => 'nullable|string',
            'subject' => 'nullable|string',
            'message' => 'required|string',
        ]);

        ContactMessage::create($validated);

        Mail::to($this->getAdminNotificationEmail())->send(new AdminNotification(
            'New Contact Message',
            "You have received a new message from {$validated['name']} ({$validated['email']}).\n\nSubject: ".($validated['subject'] ?? 'No Subject')."\n\nMessage:\n{$validated['message']}"
        ));

        return response()->json(['message' => 'Message sent successfully'], 201);
    }

    public function quote(Request $request)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'phone' => 'nullable|string',
            'service' => 'nullable|string',
            'description' => 'required|string',
        ];

        if ($request->hasFile('files')) {
            $rules['files'] = 'nullable|array';
            $rules['files.*'] = 'file|mimes:jpeg,png,jpg,gif,svg,webp,pdf,dwg,dxf|max:10240';
        } else {
            $rules['files'] = 'nullable|array';
            $rules['files.*'] = 'nullable|string';
        }

        $validated = $request->validate($rules);

        $storedFiles = $validated['files'] ?? [];
        if ($request->hasFile('files')) {
            $storedFiles = collect($request->file('files'))
                ->map(function ($file) {
                    $filename = time().'_'.Str::random(10).'.'.$file->getClientOriginalExtension();
                    $path = $file->storeAs('quote-attachments', $filename, 'public');

                    return asset('storage/'.$path);
                })
                ->values()
                ->all();
        }

        $authenticatedCustomer = auth('sanctum')->user();
        if (! $authenticatedCustomer instanceof Customer) {
            $authenticatedCustomer = null;
        }
        $customerId = $authenticatedCustomer?->id ?? null;
        QuoteRequest::create(array_merge($validated, [
            'customer_id' => $customerId,
            'files' => $storedFiles,
        ]));

        Mail::to($this->getAdminNotificationEmail())->send(new AdminNotification(
            'New Quote Request',
            "You have received a new quote request from {$validated['name']} ({$validated['email']}).\n\nService: ".($validated['service'] ?? 'N/A')."\n\nDescription:\n{$validated['description']}"
        ));

        return response()->json(['message' => 'Quote request submitted successfully'], 201);
    }

    public function refundRequest(Request $request)
    {
        $authenticatedCustomer = auth('sanctum')->user();
        if (! $authenticatedCustomer instanceof Customer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'order_id' => 'required|integer',
            'reason' => 'required|string|max:255',
            'details' => 'required|string|max:5000',
            'request_type' => 'nullable|in:cancel,cancel_refund',
        ]);

        $order = Order::query()
            ->whereKey($validated['order_id'])
            ->where('customer_id', $authenticatedCustomer->id)
            ->first();

        if (! $order) {
            return response()->json([
                'message' => 'We could not find that order on your account.',
            ], 404);
        }

        $requestType = $validated['request_type'] ?? 'cancel_refund';
        $subject = ($requestType === 'cancel' ? 'Order Cancellation Request - ' : 'Cancellation & Refund Request - ').$order->order_number;
        $message = implode("\n\n", [
            "Order Number: {$order->order_number}",
            "Customer: {$authenticatedCustomer->name} ({$authenticatedCustomer->email})",
            "Payment Method: {$order->payment_method}",
            'Request Type: '.($requestType === 'cancel' ? 'Cancel Order' : 'Cancel and Refund'),
            "Reason: {$validated['reason']}",
            "Details:\n{$validated['details']}",
        ]);

        ContactMessage::create([
            'name' => $authenticatedCustomer->name,
            'email' => $authenticatedCustomer->email,
            'phone' => $authenticatedCustomer->phone,
            'order_id' => $order->id,
            'subject' => $subject,
            'message_type' => 'order_request',
            'request_type' => $requestType,
            'request_status' => 'pending',
            'reason' => $validated['reason'],
            'details' => $validated['details'],
            'message' => $message,
        ]);

        Mail::to($this->getAdminNotificationEmail())->send(new AdminNotification(
            $subject,
            $message
        ));

        return response()->json([
            'message' => $requestType === 'cancel'
                ? 'Your cancellation request has been sent. We will review it and contact you shortly.'
                : 'Your cancellation and refund request has been sent. We will review it and contact you shortly.',
        ], 201);
    }

    public function applyCoupon(Request $request)
    {
        $request->validate([
            'code' => 'required|string',
            'order_amount' => 'required|numeric|min:0',
        ]);

        $coupon = Coupon::where('code', strtoupper($request->code))->first();

        if (! $coupon) {
            return response()->json(['message' => 'Coupon code not found'], 404);
        }

        if (! $coupon->isValid($request->order_amount)) {
            return response()->json(['message' => 'This coupon is expired, inactive, or your order does not meet the minimum amount'], 422);
        }

        $discount = $coupon->calculateDiscount($request->order_amount);

        return response()->json([
            'valid' => true,
            'code' => $coupon->code,
            'type' => $coupon->type,
            'value' => $coupon->value,
            'discount' => $discount,
            'message' => $coupon->type === 'percentage'
                ? "{$coupon->value}% discount applied!"
                : "£{$coupon->value} discount applied!",
        ]);
    }

    public function order(Request $request)
    {
        $authenticatedCustomer = auth('sanctum')->user();
        if (! $authenticatedCustomer instanceof Customer) {
            $authenticatedCustomer = null;
        }

        $validated = $request->validate([
            'customer_name' => 'required|string',
            'customer_email' => 'required|email',
            'customer_phone' => 'nullable|string',
            'shipping_address' => 'required|string',
            'shipping_address_line1' => 'nullable|string|max:255',
            'shipping_address_line2' => 'nullable|string|max:255',
            'shipping_city' => 'nullable|string|max:255',
            'shipping_postcode' => 'nullable|string|max:255',
            'shipping_county' => 'nullable|string|max:255',
            'shipping_country' => 'nullable|string|max:255',
            'billing_address' => 'required|string',
            'billing_address_line1' => 'nullable|string|max:255',
            'billing_address_line2' => 'nullable|string|max:255',
            'billing_city' => 'nullable|string|max:255',
            'billing_postcode' => 'nullable|string|max:255',
            'billing_county' => 'nullable|string|max:255',
            'billing_country' => 'nullable|string|max:255',
            'payment_method' => [
                'nullable',
                'string',
                function ($attribute, $value, $fail) {
                    $normalized = preg_replace('/[^a-z0-9]+/', '', strtolower((string) $value));
                    if (in_array($normalized, ['cashondelivery', 'cod'], true)) {
                        $fail('This payment method is no longer available.');
                    }
                },
            ],
            'bank_account_id' => 'nullable|string|max:64',
            'fulfilment_method' => 'nullable|in:delivery,click_collect',
            'shipping_option_token' => 'nullable|string',
            'notes' => 'nullable|string',
            'coupon_code' => 'nullable|string',
            'is_business' => 'nullable|boolean',
            'company_name' => 'nullable|string',
            'company_vat_number' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.selected_variants' => 'nullable|array',
            'stripe_payment_intent_id' => 'nullable|string',
            'save_card' => 'nullable|boolean',
        ]);

        try {
            $order = $this->orderService->place($validated, $authenticatedCustomer);
        } catch (PaymentVerificationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Order placed successfully',
            'order_number' => $order->order_number,
            'confirmation' => [
                'order' => $order->order_number,
                'token' => Crypt::encryptString(json_encode([
                    'order' => $order->order_number,
                    'exp' => now()->addDays(7)->timestamp,
                ], JSON_THROW_ON_ERROR)),
            ],
        ], 201);
    }
}
