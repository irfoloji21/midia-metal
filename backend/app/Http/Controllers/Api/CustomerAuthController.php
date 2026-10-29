<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\QuoteRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;

class CustomerAuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:customers,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string',
        ]);

        $customer = Customer::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
        ]);

        $customer->tokens()->delete();
        $token = $customer->createToken('customer-token', ['customer'], now()->addDays(7))->plainTextToken;

        return response()->json([
            'customer' => $customer,
        ], 201)->cookie($this->customerTokenCookie($request, $token));
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $customer = Customer::where('email', $request->email)->first();

        if (! $customer || ! Hash::check($request->password, $customer->password)) {
            return response()->json(['message' => 'Invalid email or password'], 401);
        }

        $customer->tokens()->delete();
        $token = $customer->createToken('customer-token', ['customer'], now()->addDays(7))->plainTextToken;

        return response()->json([
            'customer' => $customer,
        ])->cookie($this->customerTokenCookie($request, $token));
    }

    public function logout(Request $request)
    {
        if ($request->user()?->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json(['message' => 'Logged out successfully'])
            ->withoutCookie('customer_token', '/');
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $customer = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'postcode' => 'nullable|string',
            'country' => 'nullable|string',
            'billing_address' => 'nullable|string',
            'billing_city' => 'nullable|string',
            'billing_postcode' => 'nullable|string',
            'billing_country' => 'nullable|string',
            'shipping_address' => 'nullable|string',
            'shipping_city' => 'nullable|string',
            'shipping_postcode' => 'nullable|string',
            'shipping_country' => 'nullable|string',
        ]);

        $customer->update($validated);

        return response()->json($customer->fresh());
    }

    public function customerQuotes(Request $request)
    {
        $customer = $request->user();
        $quotes = QuoteRequest::where(function ($q) use ($customer) {
            $q->where('customer_id', $customer->id)
                ->orWhere('email', $customer->email);
        })
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($quotes);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $customer = $request->user();

        if (! Hash::check($request->current_password, $customer->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $customer->update(['password' => Hash::make($request->password)]);

        return response()->json(['message' => 'Password updated successfully']);
    }

    private function customerTokenCookie(Request $request, string $token): Cookie
    {
        return cookie(
            'customer_token',
            $token,
            60 * 24 * 7,
            '/',
            null,
            $request->isSecure(),
            true,
            false,
            'lax'
        );
    }
}
