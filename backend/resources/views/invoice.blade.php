<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>Invoice - {{ $order->order_number }}</title>
    <style>
        body {
            font-family: sans-serif;
            margin: 0;
            padding: 40px;
            color: #333;
        }

        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }

        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #eb5c10;
        }

        .invoice-details {
            text-align: right;
        }

        .invoice-details h2 {
            margin: 0 0 10px 0;
            color: #10275c;
        }

        .addresses {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }

        .address-block {
            width: 45%;
        }

        .address-block h3 {
            margin-bottom: 10px;
            color: #10275c;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
        }

        th {
            text-align: left;
            background: #f4f5f7;
            padding: 12px;
            color: #10275c;
        }

        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }

        .totals {
            width: 50%;
            float: right;
            border-top: 2px solid #10275c;
            padding-top: 10px;
        }

        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }

        .totals-row.bold {
            font-weight: bold;
            font-size: 1.1em;
            color: #10275c;
        }

        .footer {
            clear: both;
            margin-top: 60px;
            text-align: center;
            color: #888;
            font-size: 0.9em;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
    </style>
</head>

<body>
    @php
        $vatRate = 20;
        $vatMultiplier = 1 + ($vatRate / 100);
        $netTotal = round($order->total / $vatMultiplier, 2);
        $vatIncluded = round($order->total - $netTotal, 2);
    @endphp
    <div class="header">
        <div class="logo">Midia M Metal</div>
        <div class="invoice-details">
            <h2>INVOICE</h2>
            <div><strong>Order #:</strong> {{ $order->order_number }}</div>
            <div><strong>Date:</strong> {{ $order->created_at->format('M d, Y') }}</div>
            <div><strong>Status:</strong> {{ ucfirst($order->status) }}</div>
            <div><strong>Payment:</strong> {{ ucfirst($order->payment_status) }}</div>
        </div>
    </div>

    <div class="addresses">
        <div class="address-block">
            <h3>Billed To</h3>
            <div><strong>{{ $order->customer_name }}</strong></div>
            @if($order->is_business && $order->company_name)
                <div>{{ $order->company_name }}</div>
                @if($order->company_vat_number)
                    <div>VAT: {{ $order->company_vat_number }}</div>
                @endif
            @endif
            <div>{{ $order->customer_email }}</div>
            <div>{{ $order->customer_phone }}</div>
            <div style="margin-top:5px; white-space:pre-wrap;">{{ $order->billing_address ?: $order->shipping_address }}</div>
        </div>
        <div class="address-block">
            <h3>From</h3>
            <div><strong>Midia M Metal Ltd</strong></div>
            <div>123 Metal Street</div>
            <div>Industrial Zone, London, UK</div>
            <div>softwaredevelopment2181@gmail.com</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Product</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Price</th>
            </tr>
        </thead>
        <tbody>
            @foreach($order->items as $item)
                <tr>
                    <td>
                        {{ $item->product_name }}
                        @if($item->variant_details)
                            <div style="margin-top:6px; font-size:12px; color:#eb5c10;">
                                @foreach($item->variant_details as $option => $value)
                                    <div>{{ strtoupper($option) }}: {{ is_array($value) ? ($value['value'] ?? '') : $value }}</div>
                                @endforeach
                            </div>
                        @endif
                    </td>
                    <td style="text-align:center;">{{ $item->quantity }}</td>
                    <td style="text-align:right;">
                        £{{ number_format(floatval(str_replace(['£', ','], '', $item->product_price)) * $item->quantity, 2) }}
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <div class="totals-row">
            <span>Subtotal:</span>
            <span>£{{ number_format($order->subtotal, 2) }}</span>
        </div>
        @if($order->discount_amount > 0)
            <div class="totals-row" style="color: green;">
                <span>Discount ({{ $order->coupon_code }}):</span>
                <span>-£{{ number_format($order->discount_amount, 2) }}</span>
            </div>
        @endif
        <div class="totals-row">
            <span>Shipping:</span>
            <span>£{{ number_format($order->shipping, 2) }}</span>
        </div>
        <div class="totals-row">
            <span>Net amount:</span>
            <span>£{{ number_format($netTotal, 2) }}</span>
        </div>
        <div class="totals-row">
            <span>VAT included ({{ $vatRate }}%):</span>
            <span>£{{ number_format($vatIncluded, 2) }}</span>
        </div>
        <div class="totals-row bold" style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
            <span>Total:</span>
            <span>£{{ number_format($order->total, 2) }}</span>
        </div>
    </div>

    <div class="footer">
        Thank you for your business! If you have any questions, please contact softwaredevelopment2181@gmail.com
    </div>
</body>

</html>
