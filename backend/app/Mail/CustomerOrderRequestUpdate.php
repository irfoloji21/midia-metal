<?php

namespace App\Mail;

use App\Models\ContactMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerOrderRequestUpdate extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactMessage $orderRequest,
        public string $event,
    ) {}

    public function envelope(): Envelope
    {
        $title = match ($this->event) {
            'request_received' => 'Request received',
            'request_approved' => 'Request approved',
            'request_rejected' => 'Request update',
            'refund_processing' => 'Refund processing',
            'manual_refund_pending' => 'Manual refund pending',
            'refund_completed' => 'Refund completed',
            'partial_refund_completed' => 'Partial refund completed',
            'refund_failed' => 'Refund update',
            default => 'Order request update',
        };

        return new Envelope(subject: $title.' - '.($this->orderRequest->order?->order_number ?? 'your order'));
    }

    public function content(): Content
    {
        return new Content(view: 'emails.customer-order-request-update');
    }
}
