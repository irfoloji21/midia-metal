<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\ContactMessage;
use App\Models\Order;
use App\Models\PortfolioProject;
use App\Models\Product;
use App\Models\Service;
use App\Services\OrderRevenue;

class DashboardController extends Controller
{
    public function index(OrderRevenue $revenue)
    {
        $period = $revenue->period();
        $payments = $revenue->totals($revenue->orders($period['start'], $period['end']));
        $stats = [
            'total_orders' => Order::count(),
            'pending_orders' => Order::where('status', 'pending')->count(),
            'total_products' => Product::count(),
            'total_blog_posts' => BlogPost::count(),
            'unread_messages' => ContactMessage::where('read', false)->count(),
            'total_portfolio' => PortfolioProject::count(),
            'total_services' => Service::count(),
            'monthly_revenue' => $payments['net_collected'],
        ];

        $recent_orders = Order::with('items')->latest()->take(5)->get();
        $recent_messages = ContactMessage::latest()->take(5)->get();

        return response()->json([
            'stats' => $stats,
            'payments' => $payments,
            'period' => ['label' => $period['label'], 'start' => $period['start']->toDateString(), 'end' => $period['end']->toDateString(), 'basis' => 'order_created_at'],
            'recent_orders' => $recent_orders,
            'recent_messages' => $recent_messages,
        ]);
    }
}
