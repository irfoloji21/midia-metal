<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\OrderRevenue;

class StatController extends Controller
{
    public function salesOverview(OrderRevenue $revenue)
    {
        $sales = [];
        $month = now()->startOfMonth();
        for ($i = 0; $i < 12; $i++) {
            $query = $revenue->orders($month, $month->copy()->addMonth());
            $totals = $revenue->totals(clone $query);
            $sales[] = $totals + ['month' => $month->format('Y-m'), 'revenue' => $totals['net_collected'], 'orders' => $query->count()];
            $month->subMonth();
        }

        return response()->json($sales);
    }

    public function topProducts(OrderRevenue $revenue)
    {
        $period = $revenue->period();
        $products = $revenue->topProducts($revenue->orders($period['start'], $period['end']));

        return response()->json($products);
    }
}
