import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Copy, Users, ShoppingCart, DollarSign, Activity, Package } from "lucide-react";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

export default function AdminDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [topProducts, setTopProducts] = useState<any[]>([]);
    const { sort, toggleSort } = useTableSort("total_revenue", "desc");

    useEffect(() => {
        async function loadStats() {
            try {
                const [dashRes, topRes] = await Promise.all([
                    apiFetch<Record<string, any>>("/admin/dashboard"),
                    apiFetch<any[]>("/admin/stats/top-products")
                ]);
                setData(dashRes);
                setTopProducts(topRes);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    if (loading) return <div className="text-center py-20">Loading dashboard...</div>;
    if (!data) return <div className="text-center py-20 text-red-500">Failed to load data</div>;

    const stats = [
        { name: "Total Revenue", value: `£${data.stats.monthly_revenue || 0}`, icon: DollarSign },
        { name: "Total Products", value: data.stats.total_products, icon: Package },
        { name: "Pending Orders", value: data.stats.pending_orders, icon: ShoppingCart },
        { name: "Unread Messages", value: data.stats.unread_messages, icon: Activity },
    ];
    const sortedTopProducts = sortRows(topProducts, sort.key, sort.direction);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-[#10275c] font-sans">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon || Users;
                    return (
                        <div key={idx} className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 flex items-center gap-4">
                            <div className="rounded-md bg-[#22a3e6]/10 p-3">
                                <Icon className="h-6 w-6 text-[#22a3e6]" />
                            </div>
                            <div>
                                <dt className="truncate text-sm font-medium text-gray-500">{stat.name}</dt>
                                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{stat.value}</dd>
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
                <div className="border-b border-gray-200 px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">Top Selling Products</h3>
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Historical Performance</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableTableHeader label="Product Name" sortKey="product_name" sort={sort} onSort={toggleSort} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" />
                                <SortableTableHeader label="Units Sold" sortKey="total_sold" sort={sort} onSort={toggleSort} className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" buttonClassName="justify-center w-full" />
                                <SortableTableHeader label="Revenue" sortKey="total_revenue" sort={sort} onSort={toggleSort} className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider" buttonClassName="justify-end w-full" />
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">£{parseFloat(p.total_revenue).toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
