<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Order request update</title>
</head>
<body style="margin:0;padding:24px;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#18263a;">
    @php
        $order = $orderRequest->order;
        $isCancellation = $orderRequest->request_type === 'cancel';
        $title = match ($event) {
            'request_received' => 'We received your request',
            'request_approved' => 'Your request has been approved',
            'request_rejected' => 'Update on your request',
            'refund_processing' => 'Your refund is being processed',
            'manual_refund_pending' => 'Your refund is awaiting manual processing',
            'refund_completed' => 'Your refund has been marked as complete',
            'partial_refund_completed' => 'Your partial refund has been processed',
            'refund_failed' => 'There is an update about your refund',
            default => 'Order request update',
        };
        $message = match ($event) {
            'request_received' => 'We have received your '.($isCancellation ? 'cancellation' : 'cancellation and refund').' request. We will review it and email you when there is an update.',
            'request_approved' => $isCancellation
                ? 'Your cancellation request has been approved and your order has been cancelled.'
                : ($order?->payment_status === 'refund_pending'
                    ? 'Your cancellation and refund request has been approved. Your refund is being processed, and we will email you when its status changes.'
                    : 'Your cancellation and refund request has been approved and your order has been cancelled.'),
            'request_rejected' => 'Your request was not approved. Please contact us if you need more information.',
            'refund_processing' => 'The refund for your order is being processed. We will email you again when its status changes.',
            'manual_refund_pending' => 'Your cancellation and refund request has been approved and your order has been cancelled. Because the order was paid by bank transfer, the seller must send the refund manually. We will email you again when the refund is marked as complete.',
            'refund_completed' => 'The refund for your order has been marked as complete. Please allow time for it to appear in your account.',
            'partial_refund_completed' => 'A partial refund for your order has been processed. Please allow time for it to appear in your account.',
            'refund_failed' => 'The refund could not be marked as complete. Our team is reviewing the issue and will contact you with an update.',
            default => 'There has been an update to your order request.',
        };
    @endphp
    <table role="presentation" style="width:100%;max-width:620px;margin:0 auto;background:#ffffff;border-collapse:collapse;">
        <tr>
            <td style="padding:28px 32px;background:#10275c;color:#ffffff;font-size:20px;font-weight:bold;">Midia M Metal</td>
        </tr>
        <tr>
            <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#10275c;">{{ $title }}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">Hello {{ $orderRequest->name }},</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">{{ $message }}</p>
                <p style="margin:0 0 8px;font-size:14px;"><strong>Order:</strong> {{ $order?->order_number ?? 'N/A' }}</p>
                <p style="margin:0;font-size:14px;"><strong>Request:</strong> {{ $isCancellation ? 'Cancellation' : 'Cancellation and refund' }}</p>
                <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#58657f;">If you have questions, reply to this email or contact our team.</p>
            </td>
        </tr>
    </table>
</body>
</html>
