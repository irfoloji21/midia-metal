<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

class OrderConfirmationController extends Controller
{
    public function show(Request $request)
    {
        $validated = $request->validate([
            'order' => 'required|string|max:64',
            'token' => 'required|string',
        ]);

        try {
            $payload = json_decode(Crypt::decryptString($validated['token']), true, 512, JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException) {
            return response()->json(['message' => 'Invalid confirmation token.'], 403);
        }

        $tokenOrder = (string) ($payload['order'] ?? '');
        $tokenExpiry = (int) ($payload['exp'] ?? 0);

        if (! hash_equals($tokenOrder, $validated['order']) || $tokenExpiry < now()->timestamp) {
            return response()->json(['message' => 'Invalid or expired confirmation token.'], 403);
        }

        $order = Order::query()
            ->with(['items:id,order_id,product_name,quantity'])
            ->select(['id', 'order_number', 'created_at', 'payment_method', 'total', 'payment_status', 'bank_transfer_details'])
            ->where('order_number', $validated['order'])
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Order confirmation not found.'], 404);
        }

        return response()->json([
            'order_number' => $order->order_number,
            'created_at' => optional($order->created_at)?->toIso8601String(),
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'bank_transfer_details' => $order->payment_status === 'pending' ? $order->bank_transfer_details : null,
            'total' => (float) $order->total,
            'items' => $order->items->map(fn ($item) => [
                'name' => $item->product_name,
                'quantity' => $item->quantity,
            ])->values(),
        ]);
    }
}
