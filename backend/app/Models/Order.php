<?php

namespace App\Models;

use App\Traits\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use Auditable, HasFactory;

    protected $fillable = [
        'order_number',
        'customer_name',
        'customer_email',
        'customer_phone',
        'shipping_address',
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_city',
        'shipping_postcode',
        'shipping_county',
        'shipping_country',
        'billing_address',
        'billing_address_line1',
        'billing_address_line2',
        'billing_city',
        'billing_postcode',
        'billing_county',
        'billing_country',
        'status',
        'subtotal',
        'shipping',
        'total',
        'payment_method',
        'bank_transfer_details',
        'payment_status',
        'refunded_amount',
        'stripe_payment_intent_id',
        'stripe_receipt_url',
        'notes',
        'tracking_number',
        'shipping_provider',
        'shipping_carrier',
        'shipping_service',
        'shipping_status',
        'shipping_shipment_id',
        'shipping_label_url',
        'shipping_tracking_url',
        'shipping_metadata',
        'coupon_code',
        'discount_amount',
        'tax_amount',
        'is_business',
        'company_name',
        'company_vat_number',
        'customer_id',
    ];

    protected $casts = [
        'refunded_amount' => 'decimal:2',
        'shipping_metadata' => 'array',
        'bank_transfer_details' => 'array',
    ];

    protected static function booted(): void
    {
        static::saving(function (Order $order) {
            if ($order->payment_status === 'refunded') {
                $order->refunded_amount = $order->total;
            } elseif ($order->payment_status === 'partially_refunded'
                && ! $order->isDirty('refunded_amount') && (float) $order->refunded_amount <= 0) {
                // A manual status change alone cannot establish a refund amount.
                $order->refunded_amount = null;
            }
        });
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function customerRequests()
    {
        return $this->hasMany(ContactMessage::class)
            ->where('message_type', 'order_request')
            ->latest();
    }
}
