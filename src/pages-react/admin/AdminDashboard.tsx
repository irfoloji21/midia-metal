import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Users, ShoppingCart, DollarSign, Activity, Package, Clock3, RotateCcw } from "lucide-react";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

export default function AdminDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(false);
    const [dashboardAttempt, setDashboardAttempt] = useState(0);

    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [topProductsLoading, setTopProductsLoading] = useState(true);
    const [topProductsError, setTopProductsError] = useState(false);
    const [topProductsAttempt, setTopProductsAttempt] = useState(0);
    const { sort, toggleSort } = useTableSort("total_revenue", "desc");

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setLoading(true);
        setDashboardError(false);
        async function loadStats() {
            try {
                const dashRes = await apiFetch<Record<string, any>>("/admin/dashboard", { signal: controller.signal });
                if (!cancelled) setData(dashRes);
            } catch {
                if (!cancelled) setDashboardError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void loadStats();
        return () => { cancelled = true; controller.abort(); };
    }, [dashboardAttempt]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setTopProductsLoading(true);
        setTopProductsError(false);
        async function loadTopProducts() {
            try {
                const topRes = await apiFetch<any[]>("/admin/stats/top-products", { signal: controller.signal });
                if (!cancelled) setTopProducts(topRes);
            } catch {
                if (!cancelled) setTopProductsError(true);
            } finally {
                if (!cancelled) setTopProductsLoading(false);
            }
        }
        void loadTopProducts();
        return () => { cancelled = true; controller.abort(); };
    }, [topProductsAttempt]);

    if (loading) return <div role="status" className="text-center py-20">Loading dashboard...</div>;
    if (dashboardError || !data) return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-[#10275c] font-sans">Dashboard</h1>
            <div role="alert" className="rounded-lg border border-red-200 bg-white p-6 text-center">
                <p className="text-red-700">Unable to load the dashboard. Please try again.</p>
                <button type="button" onClick={() => setDashboardAttempt(attempt => attempt + 1)} className="mt-4 rounded-md bg-[#10275c] px-4 py-2 text-white">Retry dashboard</button>
            </div>
        </div>
    );

    const money = (value: number | string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value || 0));
    const paymentStats = [
        { name: "Net Collected", value: money(data.payments.net_collected), icon: DollarSign, description: "Successful payments less completed refunds" },
        { name: "Awaiting Payment", value: money(data.payments.pending_payments), icon: Clock3, description: "Outstanding amounts on unpaid orders" },
        { name: "Completed Refunds", value: money(data.payments.completed_refunds), icon: RotateCcw, description: "Returned to customers; excluded from net collected" },
    ];
    const stats = [
        { name: "Total Products", value: data.stats.total_products, icon: Package },
        { name: "Pending Orders", value: data.stats.pending_orders, icon: ShoppingCart },
        { name: "Unread Messages", value: data.stats.unread_messages, icon: Activity },
    ];
    const sortedTopProducts = sortRows(topProducts, sort.key, sort.direction);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-[#10275c] font-sans">Dashboard</h1>

            <section aria-labelledby="payment-summary-title" className="space-y-4">
                <div>
                    <h2 id="payment-summary-title" className="text-lg font-semibold text-gray-900">Payments · {data.period.label}</h2>
                    <p className="text-sm text-gray-500">Orders placed during this month, using their current payment status. Amounts include VAT and delivery, before payment processing fees.</p>
                </div>
                {data.payments.unreconciled_orders > 0 && (
                    <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        {data.payments.unreconciled_orders} order(s) have an unverified refund amount and are excluded from the payment totals and product revenue until reconciled.
                    </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {paymentStats.map((stat) => (
                        <div key={stat.name} className="min-w-0 rounded-lg bg-white p-5 shadow">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-500"><stat.icon className="h-5 w-5 shrink-0 text-[#22a3e6]" />{stat.name}</div>
                            <div className="mt-3 break-words text-2xl font-semibold tabular-nums text-gray-900">{stat.value}</div>
                            <p className="mt-2 text-xs text-gray-500">{stat.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon || Users;
                    return (
                        <div key={idx} className="min-w-0 rounded-lg bg-white px-4 py-5 shadow sm:p-6 flex items-center gap-4">
                            <div className="shrink-0 rounded-md bg-[#22a3e6]/10 p-3">
                                <Icon className="h-6 w-6 text-[#22a3e6]" />
                            </div>
                            <div className="min-w-0">
                                <dt className="text-sm font-medium text-gray-500">{stat.name}</dt>
                                <dd className="mt-1 break-words text-2xl font-semibold tracking-tight text-gray-900">{stat.value}</dd>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Recent Orders */}
                <div className="rounded-lg bg-white shadow">
                    <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Orders</h3>
                    </div>
                    <ul role="list" className="divide-y divide-gray-100 px-4 sm:px-6">
                        {data.recent_orders?.length === 0 ? (
                            <li className="py-4 text-sm text-gray-500">No recent orders found.</li>
                        ) : (
                            data.recent_orders?.map((order: any) => (
                                <li key={order.id} className="flex justify-between gap-x-6 py-5">
                                    <div className="flex min-w-0 gap-x-4">
                                        <div className="min-w-0 flex-auto">
                                            <p className="text-sm font-semibold leading-6 text-gray-900">
                                                {order.order_number} <span className="text-gray-400 font-normal ml-2">{order.customer_name}</span>
                                            </p>
                                            <p className="mt-1 truncate text-xs leading-5 text-gray-500">£{order.total}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <p className="text-sm leading-6 text-gray-900 capitalize">{order.status}</p>
                                        <p className="mt-1 text-xs leading-5 text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Recent Messages */}
                <div className="rounded-lg bg-white shadow">
                    <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">Recent Messages</h3>
                    </div>
                    <ul role="list" className="divide-y divide-gray-100 px-4 sm:px-6">
                        {data.recent_messages?.length === 0 ? (
                            <li className="py-4 text-sm text-gray-500">No recent messages found.</li>
                        ) : (
                            data.recent_messages?.map((msg: any) => (
                                <li key={msg.id} className="flex justify-between gap-x-6 py-5">
                                    <div className="min-w-0 flex-auto">
                                        <p className="text-sm font-semibold leading-6 text-gray-900">
                                            {msg.name} {!msg.read && <span className="inline-block w-2 h-2 ml-1 bg-[#eb5c10] rounded-full"></span>}
                                        </p>
                                        <p className="mt-1 truncate text-xs leading-5 text-gray-500">{msg.subject || msg.email}</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <p className="mt-1 text-xs leading-5 text-gray-500">
                                            {new Date(msg.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>

            {/* Top Products */}
            <div className="rounded-lg bg-white shadow overflow-hidden">
                <div className="border-b border-gray-200 px-4 py-5 sm:px-6 flex flex-wrap justify-between items-center gap-2">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">Top Selling Products</h3>
                    <span className="text-xs text-gray-500 font-medium">{data.period.label}</span>
                </div>
                <p className="px-4 py-3 text-xs text-gray-500 sm:px-6">Paid orders only; fully refunded orders are excluded. Revenue excludes delivery and includes discounts. Partial refunds are allocated proportionally; unit counts are not adjusted for partial refunds.</p>
                {topProductsLoading ? (
                    <p role="status" className="px-6 py-10 text-center text-sm text-gray-500">Loading top selling products...</p>
                ) : topProductsError ? (
                    <div role="alert" className="px-6 py-8 text-center">
                        <p className="text-sm text-red-700">Unable to load top selling products.</p>
                        <button type="button" onClick={() => setTopProductsAttempt(attempt => attempt + 1)} className="mt-3 rounded-md bg-[#10275c] px-4 py-2 text-sm text-white">Retry top selling products</button>
                    </div>
                ) : <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableTableHeader label="Product Name" sortKey="product_name" sort={sort} onSort={toggleSort} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" />
                                <SortableTableHeader label="Paid Units" sortKey="total_sold" sort={sort} onSort={toggleSort} className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" buttonClassName="justify-center w-full" />
                                <SortableTableHeader label="Estimated Net Revenue" sortKey="total_revenue" sort={sort} onSort={toggleSort} className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider" buttonClassName="justify-end w-full" />
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {topProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500 italic">No sales data available yet.</td>
                                </tr>
                            ) : (
                                sortedTopProducts.map((p: any, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#10275c]">{p.product_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-[#22a3e6] font-medium">{p.total_sold}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{money(p.total_revenue)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>}
            </div>
        </div>
    );
}
