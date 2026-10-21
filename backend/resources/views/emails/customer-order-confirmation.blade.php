<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="background-color:#10275c;padding:30px 40px;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">Order Confirmation</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:40px;">
                            <p style="color:#333333;font-size:16px;margin:0 0 20px;">
                                Hi {{ $order->customer_name }},
                            </p>
                            <p style="color:#555555;font-size:14px;margin:0 0 30px;">
                                {{ $order->payment_status === 'paid' ? 'Thank you for your order. Your payment has been received.' : 'Thank you for your order. We will begin processing it once payment has been received in full.' }}
                            </p>

                            <!-- Order Details Box -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;border-radius:6px;margin-bottom:30px;">
                                <tr>
                                    <td style="padding:20px;">
                                        <h2 style="color:#10275c;font-size:16px;margin:0 0 15px;">Order Details</h2>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color:#6f7e9a;font-size:13px;padding:4px 0;">Order Number:</td>
                                                <td style="color:#10275c;font-size:13px;font-weight:bold;text-align:right;padding:4px 0;">{{ $order->order_number }}</td>
                                            </tr>
                                            <tr>
                                                <td style="color:#6f7e9a;font-size:13px;padding:4px 0;">Payment Method:</td>
                                                <td style="color:#10275c;font-size:13px;text-align:right;padding:4px 0;">{{ ucfirst(str_replace('_', ' ', $order->payment_method ?? 'N/A')) }}</td>
                                            </tr>
                                            <tr>
                                                <td style="color:#6f7e9a;font-size:13px;padding:4px 0;">Payment Status:</td>
                                                <td style="color:#10275c;font-size:13px;text-align:right;padding:4px 0;">{{ ucfirst($order->payment_status ?? 'Pending') }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            @if($order->bank_transfer_details && $order->payment_status === 'pending')
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:6px;margin-bottom:30px;">
                                <tr>
                                    <td style="padding:20px;">
                                        <h2 style="color:#10275c;font-size:16px;margin:0 0 12px;">Bank Transfer Details</h2>
                                        @if(!empty($order->bank_transfer_details['bank_name']))
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>Bank:</strong> {{ $order->bank_transfer_details['bank_name'] }}</p>
                                        @endif
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>Account Name:</strong> {{ $order->bank_transfer_details['account_name'] }}</p>
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>Sort Code:</strong> {{ $order->bank_transfer_details['sort_code'] }}</p>
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>Account Number:</strong> {{ $order->bank_transfer_details['account_number'] }}</p>
                                        @if(isset($order->bank_transfer_details['amount_remaining']))
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>Amount to transfer:</strong> £{{ number_format($order->bank_transfer_details['amount_remaining'] / 100, 2) }}</p>
                                        @endif
                                        @if(!empty($order->bank_transfer_details['hosted_instructions_url']))
                                        <p><a href="{{ $order->bank_transfer_details['hosted_instructions_url'] }}">View transfer instructions on Stripe</a></p>
                                        @endif
                                        @if(!empty($order->bank_transfer_details['iban']))
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>IBAN:</strong> {{ $order->bank_transfer_details['iban'] }}</p>
                                        @endif
                                        @if(!empty($order->bank_transfer_details['bic_swift']))
                                        <p style="color:#333333;font-size:14px;margin:5px 0;"><strong>BIC / SWIFT:</strong> {{ $order->bank_transfer_details['bic_swift'] }}</p>
                                        @endif
                                        <p style="color:#555555;font-size:13px;margin:14px 0 0;">Please use {{ $order->bank_transfer_details['reference'] ?? $order->order_number }} as your payment reference.</p>
                                    </td>
                                </tr>
                            </table>
                            @endif

                            <!-- Order Items -->
                            <h2 style="color:#10275c;font-size:16px;margin:0 0 15px;">Items Ordered</h2>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                                <tr style="border-bottom:1px solid #e5e7eb;">
                                    <td style="color:#6f7e9a;font-size:12px;font-weight:bold;padding:8px 0;text-transform:uppercase;">Product</td>
                                    <td style="color:#6f7e9a;font-size:12px;font-weight:bold;padding:8px 0;text-align:center;text-transform:uppercase;">Qty</td>
                                    <td style="color:#6f7e9a;font-size:12px;font-weight:bold;padding:8px 0;text-align:right;text-transform:uppercase;">Price</td>
                                </tr>
                                @foreach($order->items as $item)
                                <tr style="border-bottom:1px solid #f0f0f0;">
                                    <td style="color:#333333;font-size:14px;padding:12px 0;">
                                        {{ $item->product_name }}
                                        @if($item->variant_details)
                                            <br><span style="color:#6f7e9a;font-size:12px;">
                                                @foreach((array)$item->variant_details as $option => $detail)
                                                    {{ is_array($detail) ? ($detail['option'] ?? $option) . ': ' . ($detail['value'] ?? '') : $detail }}@if(!$loop->last), @endif
                                                @endforeach
                                            </span>
                                        @endif
                                    </td>
                                    <td style="color:#333333;font-size:14px;padding:12px 0;text-align:center;">{{ $item->quantity }}</td>
                                    <td style="color:#333333;font-size:14px;padding:12px 0;text-align:right;">{{ $item->product_price }}</td>
                                </tr>
                                @endforeach
                            </table>

                            <!-- Totals -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:15px;">
                                <tr>
                                    <td style="color:#6f7e9a;font-size:14px;padding:4px 0;">Subtotal</td>
                                    <td style="color:#333333;font-size:14px;text-align:right;padding:4px 0;">£{{ number_format($order->subtotal, 2) }}</td>
                                </tr>
                                @if($order->shipping > 0)
                                <tr>
                                    <td style="color:#6f7e9a;font-size:14px;padding:4px 0;">Shipping</td>
                                    <td style="color:#333333;font-size:14px;text-align:right;padding:4px 0;">£{{ number_format($order->shipping, 2) }}</td>
                                </tr>
                                @endif
                                @if($order->discount_amount > 0)
                                <tr>
                                    <td style="color:#6f7e9a;font-size:14px;padding:4px 0;">Discount{{ $order->coupon_code ? ' (' . $order->coupon_code . ')' : '' }}</td>
                                    <td style="color:#22a3e6;font-size:14px;text-align:right;padding:4px 0;">-£{{ number_format($order->discount_amount, 2) }}</td>
                                </tr>
                                @endif
                                <tr>
                                    <td style="color:#10275c;font-size:18px;font-weight:bold;padding:12px 0 0;">Total</td>
                                    <td style="color:#10275c;font-size:18px;font-weight:bold;text-align:right;padding:12px 0 0;">£{{ number_format($order->total, 2) }}</td>
                                </tr>
                            </table>

                            @php
                                $fulfilmentMethod = data_get($order->shipping_metadata, 'fulfilment_method', data_get($order->shipping_metadata, 'fulfillment_method', 'delivery'));
                                $isClickCollect = $fulfilmentMethod === 'click_collect';
                                $addressHeading = $isClickCollect ? 'Billing Address' : 'Shipping Address';
                                $displayAddress = $isClickCollect ? $order->billing_address : $order->shipping_address;
                            @endphp
                            <!-- Order Address -->
                            <div style="margin-top:30px;padding:20px;background-color:#f8f9fa;border-radius:6px;">
                                <h3 style="color:#10275c;font-size:14px;margin:0 0 10px;">{{ $addressHeading }}</h3>
                                <p style="color:#555555;font-size:13px;margin:0;line-height:1.6;">{{ $displayAddress }}</p>
                            </div>

                            <p style="color:#555555;font-size:14px;margin:30px 0 0;">
                                If you have any questions about your order, please don't hesitate to contact us.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                            <p style="color:#9ca3af;font-size:12px;margin:0;">
                                &copy; {{ date('Y') }} Midia M Metal. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
