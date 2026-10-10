<?php

namespace App\Shipping;

use App\Models\Order;
use App\Services\CustomerOrderStatusNotificationService;

class ShippingManager
{
    public function __construct(
        private ParcelBuilder $parcelBuilder,
        private ShippingGateway $gateway,
        private CustomerOrderStatusNotificationService $orderStatusNotifications,
    ) {}

    public function gateway(): ShippingGateway
    {
        return $this->gateway;
    }

    public function createLabel(Order $order): Order
    {
        $parcelPlan = $this->resolveParcelPlanForOrder($order);
        $payload = $this->gateway()->createLabel($order, $parcelPlan);

        return $this->persist($order, $payload);
    }

    /**
     * @param  array<string, mixed>  $toAddress
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<string, mixed>  $context
     * @return array<int, array<string, mixed>>
     */
    public function quoteOptions(array $toAddress, array $items = [], array $context = []): array
    {
        $parcelPlan = $this->parcelBuilder->buildForCheckoutItems($items);

        return $this->gateway()->quote($toAddress, $items, array_merge($context, $parcelPlan));
    }

    public function refreshTracking(Order $order): Order
    {
        $payload = $this->gateway()->track($order);

        return $this->persist($order, $payload);
    }

    /**
     * Void / refund an unused shipment label.
     */
    public function voidShipment(Order $order): Order
    {
        $payload = $this->gateway()->voidShipment($order);

        return $this->persist($order, $payload);
    }

    /**
     * Validate a shipping address via the courier.
     *
     * @param  array<string, mixed>  $address
     * @return array{valid: bool, messages: array<int, string>, verified_address: array<string, mixed>|null}
     */
    public function validateAddress(array $address): array
    {
        return $this->gateway()->validateAddress($address);
    }

    private function persist(Order $order, array $payload): Order
    {
        $previousOrderStatus = $order->status;
        $trackingStatus = $payload['shipping_status'] ?? $order->shipping_status;
        $nextOrderStatus = $this->mapTrackingStatusToOrderStatus((string) $trackingStatus, (string) $order->status);
        $existingMetadata = is_array($order->shipping_metadata) ? $order->shipping_metadata : [];
        $payloadMetadata = is_array($payload['shipping_metadata'] ?? null) ? $payload['shipping_metadata'] : [];
        $mergedMetadata = array_merge($existingMetadata, $payloadMetadata);

        $order->update(array_filter([
            'tracking_number' => $payload['tracking_number'] ?? $order->tracking_number,
            'shipping_provider' => $payload['shipping_provider'] ?? $order->shipping_provider,
            'shipping_carrier' => $payload['shipping_carrier'] ?? $order->shipping_carrier,
            'shipping_service' => $payload['shipping_service'] ?? $order->shipping_service,
            'shipping_status' => $trackingStatus,
            'shipping_shipment_id' => $payload['shipping_shipment_id'] ?? $order->shipping_shipment_id,
            'shipping_label_url' => $payload['shipping_label_url'] ?? $order->shipping_label_url,
            'shipping_tracking_url' => $payload['shipping_tracking_url'] ?? $order->shipping_tracking_url,
            'shipping_metadata' => $mergedMetadata,
            'status' => $nextOrderStatus,
        ], static fn ($value) => $value !== null));

        $updatedOrder = $order->fresh('items');
        if ($updatedOrder && $updatedOrder->status !== $previousOrderStatus) {
            $this->orderStatusNotifications->send($updatedOrder, $previousOrderStatus);
        }

        return $updatedOrder;
    }

    private function mapTrackingStatusToOrderStatus(string $shippingStatus, string $currentOrderStatus): string
    {
        if ($currentOrderStatus === 'cancelled') {
            return $currentOrderStatus;
        }

        return match ($shippingStatus) {
            'pre_transit' => in_array($currentOrderStatus, ['pending', 'processing'], true) ? 'processing' : $currentOrderStatus,
            'in_transit', 'out_for_delivery' => 'shipped',
            'delivered' => 'delivered',
            'voided' => $currentOrderStatus,
            default => $currentOrderStatus,
        };
    }

    /**
     * @return array{parcels: array<int, array<string, mixed>>, parcel_summary: array<string, mixed>}
     */
    private function resolveParcelPlanForOrder(Order $order): array
    {
        $storedParcels = data_get($order->shipping_metadata, 'selected_delivery_option.parcels');
        $storedSummary = data_get($order->shipping_metadata, 'selected_delivery_option.parcel_summary');

        if (is_array($storedParcels) && count($storedParcels) > 0) {
            return [
                'parcels' => $storedParcels,
                'parcel_summary' => is_array($storedSummary) ? $storedSummary : [
                    'parcel_count' => count($storedParcels),
                ],
            ];
        }

        return $this->parcelBuilder->buildForOrder($order);
    }
}
