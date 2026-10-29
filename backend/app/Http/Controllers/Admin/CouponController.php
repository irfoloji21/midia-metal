<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCouponRequest;
use App\Http\Requests\Admin\UpdateCouponRequest;
use App\Models\Coupon;

class CouponController extends Controller
{
    public function index()
    {
        return response()->json(Coupon::latest()->get());
    }

    public function store(StoreCouponRequest $request)
    {
        $validated = $request->validated();
        $coupon = Coupon::create($validated);

        return response()->json($coupon->refresh(), 201);
    }

    public function update(UpdateCouponRequest $request, Coupon $coupon)
    {
        $validated = $request->validated();
        $coupon->update($validated);

        return response()->json($coupon);
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->delete();

        return response()->json(['message' => 'Coupon deleted']);
    }
}
