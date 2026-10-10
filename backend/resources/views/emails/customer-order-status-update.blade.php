<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Order status update</title>
</head>
<body style="margin:0;padding:24px;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#18263a;">
    @php
        $statusLabels = [
            'pending' => 'Pending',
            'processing' => 'Processing',
            'shipped' => 'Shipped',
            'delivered' => 'Delivered',
            'ready_for_collection' => 'Ready for Collection',
            'collected' => 'Collected',
            'cancelled' => 'Cancelled',
        ];
        $statusLabel = $statusLabels[$order->status] ?? ucfirst(str_replace('_', ' ', $order->status));
        $message = match ($order->status) {
            'pending' => 'We have received your order and it is awaiting processing.',
            'processing' => 'Your order is now being prepared.',
            'shipped' => 'Your order has been dispatched. Use the tracking details provided by the store to follow its progress.',
            'delivered' => 'Your order has been marked as delivered.',
            'ready_for_collection' => 'Your order is ready for collection. Please contact or visit the store to arrange collection.',
            'collected' => 'Your order has been collected. Thank you for shopping with us.',
            'cancelled' => 'Your order has been cancelled.',
            default => 'There has been an update to your order.',
        };
    @endphp
    <table role="presentation" style="width:100%;max-width:620px;margin:0 auto;background:#ffffff;border-collapse:collapse;">
        <tr>
            <td style="padding:28px 32px;background:#10275c;color:#ffffff;font-size:20px;font-weight:bold;">Midia M Metal</td>
        </tr>
        <tr>
            <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#10275c;">Your order status has changed</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">Hello {{ $order->customer_name }},</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">{{ $message }}</p>
                <p style="margin:0 0 8px;font-size:14px;"><strong>Order:</strong> {{ $order->order_number }}</p>
                <p style="margin:0;font-size:14px;"><strong>Status:</strong> {{ $statusLabels[$previousStatus] ?? ucfirst(str_replace('_', ' ', $previousStatus)) }} &rarr; {{ $statusLabel }}</p>
                @if ($order->status === 'shipped' && $order->tracking_number)
                    <p style="margin:20px 0 0;font-size:14px;"><strong>Tracking number:</strong> {{ $order->tracking_number }}</p>
                    @if ($order->shipping_tracking_url)
                        <p style="margin:12px 0 0;font-size:14px;"><a href="{{ $order->shipping_tracking_url }}" style="color:#eb5c10;">Track your order</a></p>
                    @endif
                @endif
            </td>
        </tr>
    </table>
</body>
</html>
