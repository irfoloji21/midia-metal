import { useState, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "sonner";
import {
    Package, FileText, User, LogOut, Heart,
    MessageSquare, Lock, ChevronRight, ChevronUp, ShoppingCart,
    Trash2, RotateCcw, Clock, Truck, CheckCheck, MapPin, CreditCard
} from "lucide-react";
import { $customer, $isAuthLoading, fetchCurrentCustomer, logoutCustomer, updateCustomer, type Customer } from "@/stores/auth";
import { $wishlist, removeFromWishlist } from "@/stores/wishlist";
import { addToCart } from "@/stores/cart";
import { apiFetch } from "@/lib/api";
import { normalizeMediaUrl } from "@/lib/media";
import withErrorBoundary from "@/lib/withErrorBoundary";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type Tab = "orders" | "wishlist" | "quotes" | "profile" | "addresses" | "payment-methods" | "security";

const STATUS_STEPS = ["pending", "processing", "shipped", "delivered"];
const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
};
const QUOTE_STATUS_LABELS: Record<string, string> = {
    new: "New",
    reviewing: "Reviewing",
    replied: "Replied",
};
const REFUND_REASONS = [
    "Changed my mind",
    "Wrong item received",
    "Item arrived damaged",
    "Item not as described",
    "Order arrived too late",
    "Other",
];

const getOrderRequestLabel = () => "Cancel & Refund";

const getSubmittedOrderRequestLabel = (requestType?: string | null) =>
    requestType === "cancel" ? "Cancellation Requested" : "Cancellation & Refund Requested";

const getCustomerOrderRequestStatusLabel = (requestType?: string | null, requestStatus?: string | null) => {
    if (requestStatus === "approved") {
        return requestType === "cancel" ? "Cancellation Accepted" : "Cancellation & Refund Accepted";
    }

    if (requestStatus === "rejected") {
        return requestType === "cancel" ? "Cancellation Rejected" : "Cancellation & Refund Rejected";
    }

    return getSubmittedOrderRequestLabel(requestType);
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    refund_pending: "Refund in Progress",
    refunded: "Refunded",
    refund_failed: "Refund Failed",
};

const getOrderRequestTitle = () => "Cancel order & request refund";

const getOrderRequestDescription = () => "Tell us why you want to cancel this order and request a refund.";

const getOrderRequestDetailsPlaceholder = () => "Add the issue, affected items, and any refund details we should review.";

const hasOrderRequest = (order: any) => (order?.customer_requests?.length ?? 0) > 0;

const getLatestOrderRequest = (order: any) => order?.customer_requests?.[0] ?? null;

function AccountIsland() {
    const customer = useStore($customer);
    const isLoading = useStore($isAuthLoading);
    const wishlist = useStore($wishlist);
    const [activeTab, setActiveTab] = useState<Tab>("orders");
    const [orders, setOrders] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [loadingQuotes, setLoadingQuotes] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
    const [requestDialogOrder, setRequestDialogOrder] = useState<any | null>(null);
    const [requestForm, setRequestForm] = useState({
        reason: REFUND_REASONS[0],
        details: "",
    });
    const [submittingRequest, setSubmittingRequest] = useState(false);

    // Saved Cards state
    const [savedCards, setSavedCards] = useState<any[]>([]);
    const [loadingCards, setLoadingCards] = useState(true);

    // Profile Form state
    const [form, setForm] = useState({
        name: "",
        phone: "",
        // Billing
        billing_address: "",
        billing_city: "",
        billing_postcode: "",
        billing_country: "United Kingdom",
        // Shipping
        shipping_address: "",
        shipping_city: "",
        shipping_postcode: "",
        shipping_country: "United Kingdom",
        is_business: false,
        company_name: "",
        company_vat_number: "",
    });
    const [savingProfile, setSavingProfile] = useState(false);

    // Security Form state
    const [secForm, setSecForm] = useState({ current_password: "", password: "", password_confirmation: "" });
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        fetchCurrentCustomer();
    }, []);

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!customer) { window.location.href = "/login"; return; }
        // Always re-fetch orders when Orders tab is active so admin status changes are reflected
        if (activeTab === "orders") {
            setLoadingOrders(true);
            fetchOrders();
        }
        if (activeTab === "quotes") {
            setLoadingQuotes(true);
            fetchQuotes();
        }
        if (activeTab === "payment-methods") {
            setLoadingCards(true);
            fetchCards();
        }
        if (customer) {
            setForm({
                name: customer.name || "",
                phone: customer.phone || "",
                billing_address: (customer as any).billing_address || customer.address || "",
                billing_city: (customer as any).billing_city || customer.city || "",
                billing_postcode: (customer as any).billing_postcode || customer.postcode || "",
                billing_country: (customer as any).billing_country || customer.country || "United Kingdom",
                shipping_address: (customer as any).shipping_address || "",
                shipping_city: (customer as any).shipping_city || "",
                shipping_postcode: (customer as any).shipping_postcode || "",
                shipping_country: (customer as any).shipping_country || "United Kingdom",
                is_business: customer.is_business || false,
                company_name: customer.company_name || "",
                company_vat_number: customer.company_vat_number || "",
            });
        }
    }, [customer, isLoading, activeTab]);

    const fetchOrders = async () => {
        try {
            const data = await apiFetch("/v1/customer/orders");
            if (Array.isArray(data)) setOrders(data);
        } catch { toast.error("Failed to load orders"); }
        finally { setLoadingOrders(false); }
    };

    const fetchQuotes = async () => {
        try {
            const data = await apiFetch("/v1/customer/quotes");
            if (Array.isArray(data)) setQuotes(data);
        } catch { /* silently fail */ }
        finally { setLoadingQuotes(false); }
    };

    const fetchCards = async () => {
        try {
            const data = await apiFetch("/v1/customer/payment-methods");
            if (Array.isArray(data)) setSavedCards(data);
        } catch { toast.error("Failed to load saved cards"); }
        finally { setLoadingCards(false); }
    };

    const deleteCard = async (id: number) => {
        if (!confirm("Are you sure you want to remove this card?")) return;
        try {
            const response = await fetch(`/api/v1/customer/payment-methods/${id}`, {
                method: "DELETE",
                credentials: "include",
                headers: { Accept: "application/json" }
            });
            if (response.ok) {
                toast.success("Card removed successfully");
                fetchCards();
            } else {
                toast.error("Failed to remove card");
            }
        } catch { toast.error("Error removing card"); }
    };

    const handleLogout = async () => {
        try {
            await apiFetch("/v1/customer/logout", { method: "POST" });
        } catch { }
        logoutCustomer();
        window.location.href = "/";
    };

    const downloadInvoice = async (id: number, orderNumber: string) => {
        try {
            const response = await fetch(`/api/v1/customer/orders/${id}/invoice`, {
                credentials: "include",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error("Failed to download");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `invoice-${orderNumber}.html`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch { toast.error("Could not download invoice."); }
    };

    const handleBuyAgain = (order: any) => {
        if (!order.items || order.items.length === 0) return;
        order.items.forEach((item: any) => {
            addToCart({
                id: item.product_id || item.id,
                name: item.product_name,
                price: item.product_price,
                image: "",
                qty: item.quantity,
            }, item.quantity);
        });
        toast.success("Items added to cart!");
        window.location.href = "/cart";
    };

    const handleOpenOrderRequestDialog = (order: any) => {
        setRequestDialogOrder(order);
        setRequestForm({
            reason: REFUND_REASONS[0],
            details: "",
        });
    };

    const handleCloseOrderRequestDialog = () => {
        if (submittingRequest) {
            return;
        }

        setRequestDialogOrder(null);
        setRequestForm({
            reason: REFUND_REASONS[0],
            details: "",
        });
    };

    const handleSubmitOrderRequest = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!requestDialogOrder) {
            toast.error("Select an order first");
            return;
        }

        setSubmittingRequest(true);

        try {
            const submittedAt = new Date().toISOString();
            const submittedRequestType = "cancel_refund";
            const response = await apiFetch<{ message: string }>("/v1/customer/refund-requests", {
                method: "POST",
                body: JSON.stringify({
                    order_id: Number(requestDialogOrder.id),
                    reason: requestForm.reason,
                    details: requestForm.details,
                    request_type: submittedRequestType,
                }),
            });

            setOrders((currentOrders) => currentOrders.map((order) => (
                order.id === requestDialogOrder.id
                    ? {
                        ...order,
                        customer_requests: [
                            {
                                id: `local-${order.id}`,
                                request_type: submittedRequestType,
                                request_status: "pending",
                                reason: requestForm.reason,
                                details: requestForm.details,
                                read: false,
                                created_at: submittedAt,
                            },
                            ...(order.customer_requests ?? []),
                        ],
                    }
                    : order
            )));
            toast.success(response.message);
            handleCloseOrderRequestDialog();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to submit request");
        } finally {
            setSubmittingRequest(false);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const updated = await apiFetch<Customer>("/v1/customer/profile", {
                method: "PUT",
                body: JSON.stringify(form)
            });
            updateCustomer(updated);
            toast.success("Profile updated successfully!");
        } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Failed to save profile"); }
        finally { setSavingProfile(false); }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (secForm.password !== secForm.password_confirmation) {
            toast.error("New passwords do not match");
            return;
        }
        setSavingPassword(true);
        try {
            await apiFetch("/v1/customer/password", {
                method: "PUT",
                body: JSON.stringify(secForm)
            });
            toast.success("Password changed successfully!");
            setSecForm({ current_password: "", password: "", password_confirmation: "" });
        } catch (error: any) { toast.error(error.message); }
        finally { setSavingPassword(false); }
    };

    if (isLoading) {
        return (
            <section className="container mx-auto px-4 lg:px-8 py-20 text-center">
                <p className="text-[#6e7a92]">Loading your account...</p>
            </section>
        );
    }

    if (!customer) return null;

    const sidebarItems: { id: Tab; icon: any; label: string }[] = [
        { id: "orders", icon: Package, label: "Orders" },
        { id: "wishlist", icon: Heart, label: "Wishlist" },
        { id: "quotes", icon: MessageSquare, label: "My Quotes" },
        { id: "profile", icon: User, label: "Profile" },
        { id: "addresses", icon: MapPin, label: "Addresses" },
        { id: "payment-methods", icon: CreditCard, label: "Saved Cards" },
        { id: "security", icon: Lock, label: "Security" },
    ];

    const getStatusIndex = (status: string) => STATUS_STEPS.indexOf(status.toLowerCase());

    return (
        <>
            <section className="container mx-auto px-4 lg:px-8 py-12 md:py-20 flex flex-col md:flex-row gap-10">

                {/* Sidebar */}
                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="bg-white border border-[#cad4e4] p-4 flex flex-col gap-1">
                        {sidebarItems.map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`flex items-center gap-3 p-3 text-sm font-semibold transition-colors text-left ${activeTab === id ? 'bg-[#eaf0f3] text-primary' : 'text-[#6e7a92] hover:bg-[#f4f7f9] hover:text-primary'}`}
                            >
                                <Icon className="w-5 h-5" /> {label}
                                {id === "wishlist" && wishlist.length > 0 && (
                                    <span className="ml-auto bg-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{wishlist.length}</span>
                                )}
                            </button>
                        ))}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 p-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors mt-4 border-t border-[#cad4e4]"
                        >
                            <LogOut className="w-5 h-5" /> Logout
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white border border-[#cad4e4] p-6 md:p-10 min-h-[500px]">

                    {/* ──────────── ORDERS TAB ──────────── */}
                    {activeTab === "orders" && (
                        <div>
                            <h2 className="font-sans text-[28px] font-semibold text-primary mb-6">Order History</h2>
                            {loadingOrders ? (
                                <p className="text-[#6e7a92]">Loading orders...</p>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-10 bg-[#f4f7f9] border border-[#cad4e4]">
                                    <Package className="w-12 h-12 mx-auto text-[#8f9bb2] mb-4" />
                                    <p className="text-[#6e7a92] mb-4">You haven't placed any orders yet.</p>
                                    <button onClick={() => window.location.href = "/shop"} className="text-orange font-semibold hover:underline">Start Shopping</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map(order => {
                                        const isExpanded = expandedOrder === order.id;
                                        const statusIdx = getStatusIndex(order.status);
                                        const latestOrderRequest = getLatestOrderRequest(order);
                                        const orderRequestSubmitted = hasOrderRequest(order);
                                        const orderRequestStatusLabel = getCustomerOrderRequestStatusLabel(
                                            latestOrderRequest?.request_type,
                                            latestOrderRequest?.request_status,
                                        );
                                        return (
                                            <div key={order.id} className="border border-[#cad4e4]">
                                                {/* Order header row */}
                                                <div
                                                    className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-5 cursor-pointer hover:bg-[#f9fafb] transition-colors"
                                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6e7a92]" /> : <ChevronRight className="w-4 h-4 text-[#6e7a92]" />}
                                                        <div>
                                                            <h3 className="font-semibold text-primary text-base">{order.order_number}</h3>
                                                            <p className="text-[#6e7a92] text-sm">{new Date(order.created_at).toLocaleDateString("en-GB")}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : order.status === 'shipped' ? 'bg-blue-100 text-blue-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-[#eaf0f3] text-primary'}`}>
                                                            {STATUS_LABELS[order.status?.toLowerCase()] || order.status}
                                                        </span>
                                                        {orderRequestSubmitted && (
                                                            <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${latestOrderRequest?.request_status === "approved" ? "bg-green-100 text-green-700" : latestOrderRequest?.request_status === "rejected" ? "bg-slate-200 text-slate-700" : "bg-orange-100 text-orange"}`}>
                                                                {orderRequestStatusLabel}
                                                            </span>
                                                        )}
                                                        <span className="font-bold text-primary">£{order.total}</span>
                                                    </div>
                                                </div>

                                                {/* Expanded detail panel */}
                                                {isExpanded && (
                                                    <div className="border-t border-[#cad4e4] p-5 bg-[#f9fafb]">

                                                        {/* Status Stepper (only for non-cancelled) */}
                                                        {order.status !== 'cancelled' && (
                                                            <div className="mb-6">
                                                                <div className="flex items-center justify-between relative">
                                                                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#cad4e4] z-0" />
                                                                    <div
                                                                        className="absolute top-4 left-0 h-0.5 bg-orange z-0 transition-all duration-500"
                                                                        style={{ width: `${statusIdx >= 0 ? (statusIdx / (STATUS_STEPS.length - 1)) * 100 : 0}%` }}
                                                                    />
                                                                    {STATUS_STEPS.map((step, idx) => {
                                                                        const isDone = statusIdx >= idx;
                                                                        return (
                                                                            <div key={step} className="flex flex-col items-center gap-1 z-10">
                                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${isDone ? 'bg-orange border-orange' : 'bg-white border-[#cad4e4]'}`}>
                                                                                    {isDone ? <CheckCheck className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-[#cad4e4]" />}
                                                                                </div>
                                                                                <span className={`text-[10px] font-semibold uppercase ${isDone ? 'text-orange' : 'text-[#9ba8bf]'}`}>{step}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                            {/* Items */}
                                                            <div>
                                                                <h4 className="text-xs font-semibold uppercase text-[#6e7a92] mb-3">Items Ordered</h4>
                                                                <div className="space-y-2">
                                                                    {order.items?.map((item: any) => (
                                                                        <div key={item.id} className="flex justify-between gap-3 text-sm">
                                                                            <div className="text-primary">
                                                                                <p>{item.quantity}x {item.product_name}</p>
                                                                                {item.variant_details && Object.entries(item.variant_details).map(([opt, value]: [string, any]) => (
                                                                                    <p key={opt} className="text-[10px] text-orange font-bold uppercase tracking-tight mt-1">
                                                                                        {opt}: {value?.value ?? value}
                                                                                    </p>
                                                                                ))}
                                                                            </div>
                                                                            <span className="text-primary font-semibold">{item.product_price}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {/* Order Info */}
                                                            <div>
                                                                <h4 className="text-xs font-semibold uppercase text-[#6e7a92] mb-3">Order Details</h4>
                                                                <div className="space-y-1 text-sm text-primary">
                                                                    {order.shipping_address && <p><span className="text-[#6e7a92]">Ship to:</span> {order.shipping_address}</p>}
                                                                    {order.billing_address && <p><span className="text-[#6e7a92]">Bill to:</span> {order.billing_address}</p>}
                                                                    {order.customer_phone && <p><span className="text-[#6e7a92]">Phone:</span> {order.customer_phone}</p>}
                                                                    {order.payment_status && <p><span className="text-[#6e7a92]">Payment:</span> {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}</p>}
                                                                    {order.coupon_code && <p><span className="text-[#6e7a92]">Coupon:</span> {order.coupon_code}</p>}
                                                                    {order.discount_amount > 0 && <p><span className="text-[#6e7a92]">Discount:</span> -£{order.discount_amount}</p>}
                                                                    {order.shipping > 0 && <p><span className="text-[#6e7a92]">Shipping:</span> £{order.shipping}</p>}
                                                                    <p className="font-bold border-t border-[#cad4e4] pt-2 mt-2"><span className="text-[#6e7a92] font-normal">Total:</span> £{order.total}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {order.tracking_number && (
                                                            <div className="mb-4 bg-blue-50 border border-blue-200 p-3 text-sm text-primary flex items-center gap-2">
                                                                <Truck className="w-4 h-4 text-blue-600" />
                                                                <span>Tracking: <strong>{order.tracking_number}</strong></span>
                                                            </div>
                                                        )}

                                                        {orderRequestSubmitted && (
                                                            <div className={`mb-4 p-4 text-sm text-primary ${latestOrderRequest?.request_status === "approved" ? "border border-green-200 bg-green-50" : latestOrderRequest?.request_status === "rejected" ? "border border-slate-300 bg-slate-50" : "border border-orange-200 bg-orange-50"}`}>
                                                                <p className={`font-semibold ${latestOrderRequest?.request_status === "approved" ? "text-green-700" : latestOrderRequest?.request_status === "rejected" ? "text-slate-700" : "text-orange"}`}>
                                                                    {orderRequestStatusLabel}
                                                                </p>
                                                                <p className="mt-1 text-[#6e7a92]">
                                                                    Submitted on {new Date(latestOrderRequest.created_at).toLocaleDateString("en-GB")}.
                                                                </p>
                                                                {latestOrderRequest.reason && (
                                                                    <p className="mt-2">
                                                                        <span className="text-[#6e7a92]">Reason:</span> {latestOrderRequest.reason}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex gap-3 flex-wrap">
                                                            <button
                                                                onClick={() => handleBuyAgain(order)}
                                                                className="flex items-center gap-2 px-4 h-10 bg-primary text-white text-sm font-semibold hover:bg-[#0d1f4e] transition-colors"
                                                            >
                                                                <RotateCcw className="w-4 h-4" /> Buy Again
                                                            </button>
                                                            <button
                                                                onClick={() => downloadInvoice(order.id, order.order_number)}
                                                                className="flex items-center gap-2 px-4 h-10 border border-orange text-orange text-sm font-semibold hover:bg-orange hover:text-white transition-colors"
                                                            >
                                                                <FileText className="w-4 h-4" /> {order.status === 'pending' && order.payment_status !== 'paid' ? 'Download Quote/Invoice' : 'Download Receipt'}
                                                            </button>
                                                            {order.status !== "cancelled" && !orderRequestSubmitted && (
                                                                <button
                                                                    onClick={() => handleOpenOrderRequestDialog(order)}
                                                                    className="flex items-center gap-2 px-4 h-10 border border-[#cad4e4] text-primary text-sm font-semibold hover:border-orange hover:text-orange transition-colors"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" /> {getOrderRequestLabel()}
                                                                </button>
                                                            )}
                                                            {order.status !== "cancelled" && orderRequestSubmitted && (
                                                                <button
                                                                    type="button"
                                                                    disabled
                                                                    className={`flex items-center gap-2 px-4 h-10 text-sm font-semibold cursor-not-allowed ${latestOrderRequest?.request_status === "approved" ? "border border-green-200 bg-green-50 text-green-700" : latestOrderRequest?.request_status === "rejected" ? "border border-slate-300 bg-slate-50 text-slate-700" : "border border-orange-200 bg-orange-50 text-orange"}`}
                                                                >
                                                                    <RotateCcw className="w-4 h-4" /> {orderRequestStatusLabel}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ──────────── WISHLIST TAB ──────────── */}
                    {activeTab === "wishlist" && (
                        <div>
                            <h2 className="font-sans text-[28px] font-semibold text-primary mb-6">My Wishlist</h2>
                            {wishlist.length === 0 ? (
                                <div className="text-center py-10 bg-[#f4f7f9] border border-[#cad4e4]">
                                    <Heart className="w-12 h-12 mx-auto text-[#8f9bb2] mb-4" />
                                    <p className="text-[#6e7a92] mb-4">Your wishlist is empty.</p>
                                    <button onClick={() => window.location.href = "/shop"} className="text-orange font-semibold hover:underline">Browse Products</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {wishlist.map(item => (
                                        <div key={item.id} className="border border-[#cad4e4] p-4 flex items-center gap-4">
                                            {item.image ? (
                                                <img src={normalizeMediaUrl(item.image, '/logo.png')} alt={item.name} className="w-16 h-16 object-cover flex-shrink-0 bg-[#f4f7f9]" />
                                            ) : (
                                                <div className="w-16 h-16 bg-[#f4f7f9] flex items-center justify-center flex-shrink-0">
                                                    <Package className="w-6 h-6 text-[#8f9bb2]" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-primary text-sm truncate">{item.name}</p>
                                                <p className="text-orange font-bold text-sm">£{item.price}</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => { addToCart({ id: item.id, name: item.name, price: item.price, image: item.image, qty: 1 }); toast.success("Added to cart!"); }}
                                                    className="p-2 bg-orange text-white hover:bg-orange-hover transition-colors"
                                                    title="Add to Cart"
                                                >
                                                    <ShoppingCart className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => removeFromWishlist(item.id)}
                                                    className="p-2 border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ──────────── QUOTES TAB ──────────── */}
                    {activeTab === "quotes" && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-sans text-[28px] font-semibold text-primary">My Quotes</h2>
                                <button onClick={() => window.location.href = "/get-a-quote"} className="px-4 h-10 bg-orange text-white text-sm font-semibold hover:bg-orange-hover transition-colors">
                                    + New Quote
                                </button>
                            </div>
                            {loadingQuotes ? (
                                <p className="text-[#6e7a92]">Loading quotes...</p>
                            ) : quotes.length === 0 ? (
                                <div className="text-center py-10 bg-[#f4f7f9] border border-[#cad4e4]">
                                    <MessageSquare className="w-12 h-12 mx-auto text-[#8f9bb2] mb-4" />
                                    <p className="text-[#6e7a92] mb-4">You haven't submitted any quotes yet.</p>
                                    <button onClick={() => window.location.href = "/get-a-quote"} className="text-orange font-semibold hover:underline">Request a Quote</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {quotes.map((quote: any) => (
                                        <div key={quote.id} className="border border-[#cad4e4] p-5">
                                            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                                                <div>
                                                    <h3 className="font-semibold text-primary">#{quote.id} — {quote.service || "General Enquiry"}</h3>
                                                    <p className="text-[#6e7a92] text-sm mt-1">{new Date(quote.created_at).toLocaleDateString("en-GB")}</p>
                                                    <p className="text-primary text-sm mt-2 line-clamp-2">{quote.description}</p>
                                                    {quote.quoted_valid_until && (
                                                        <p className="text-[#6e7a92] text-sm mt-1">
                                                            Valid until {new Date(quote.quoted_valid_until).toLocaleDateString("en-GB")}
                                                        </p>
                                                    )}
                                                    {quote.response_message && (
                                                        <p className="text-[#6e7a92] text-sm mt-2">{quote.response_message}</p>
                                                    )}
                                                    {quote.files?.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {quote.files.map((file: string, index: number) => (
                                                                <a
                                                                    key={index}
                                                                    href={file}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-xs font-semibold text-orange hover:underline"
                                                                >
                                                                    Attachment {index + 1}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0">
                                                    <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${quote.status === 'replied' ? 'bg-green-100 text-green-700' : quote.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800' : 'bg-[#eaf0f3] text-primary'}`}>
                                                        {QUOTE_STATUS_LABELS[quote.status] || quote.status || "New"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ──────────── PROFILE TAB ──────────── */}
                    {activeTab === "profile" && (
                        <div>
                            <h2 className="font-sans text-[28px] font-semibold text-primary mb-2">Profile</h2>
                            <p className="text-[#6e7a92] mb-8 text-sm">Update your personal information and account details.</p>

                            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-2xl">
                                <div>
                                    <h3 className="font-semibold text-primary mb-4 text-lg">Personal Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[13px] font-semibold text-primary mb-2">Full Name *</label>
                                            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-semibold text-primary mb-2">Phone</label>
                                            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-[#cad4e4] pt-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <input type="checkbox" id="isBusinessProfile" checked={form.is_business} onChange={(e) => setForm({ ...form, is_business: e.target.checked })} className="w-4 h-4 accent-orange cursor-pointer" />
                                        <label htmlFor="isBusinessProfile" className="text-[13px] font-semibold text-primary cursor-pointer">I am a business</label>
                                    </div>
                                    {form.is_business && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">Company Name</label>
                                                <input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">Company VAT Number</label>
                                                <input type="text" value={form.company_vat_number} onChange={(e) => setForm({ ...form, company_vat_number: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button type="submit" disabled={savingProfile} className="px-8 h-12 bg-orange text-white text-[14px] font-semibold hover:bg-orange-hover transition-colors disabled:opacity-50">
                                    {savingProfile ? "Saving..." : "Save Changes"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ──────────── ADDRESSES TAB ──────────── */}
                    {activeTab === "addresses" && (
                        <div>
                            <h2 className="font-sans text-[28px] font-semibold text-primary mb-2">Addresses</h2>
                            <p className="text-[#6e7a92] mb-8 text-sm">Your saved addresses are pre-filled at checkout.</p>

                            <form onSubmit={handleSaveProfile} className="space-y-8 max-w-2xl">
                                {/* Billing Address */}
                                <div>
                                    <h3 className="font-semibold text-primary mb-4 text-lg">Billing Address</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[13px] font-semibold text-primary mb-2">Street Address</label>
                                            <input type="text" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">City</label>
                                                <input type="text" value={form.billing_city} onChange={(e) => setForm({ ...form, billing_city: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">Postcode</label>
                                                <input type="text" value={form.billing_postcode} onChange={(e) => setForm({ ...form, billing_postcode: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">Country</label>
                                                <input type="text" value={form.billing_country} onChange={(e) => setForm({ ...form, billing_country: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Shipping Address */}
                                <div className="border-t border-[#cad4e4] pt-6">
                                    <h3 className="font-semibold text-primary mb-1 text-lg">Shipping Address</h3>
                                    <p className="text-[#6e7a92] text-xs mb-4">Leave blank to use the same as billing address.</p>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[13px] font-semibold text-primary mb-2">Street Address</label>
                                            <input type="text" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">City</label>
                                                <input type="text" value={form.shipping_city} onChange={(e) => setForm({ ...form, shipping_city: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">Postcode</label>
                                                <input type="text" value={form.shipping_postcode} onChange={(e) => setForm({ ...form, shipping_postcode: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-primary mb-2">Country</label>
                                                <input type="text" value={form.shipping_country} onChange={(e) => setForm({ ...form, shipping_country: e.target.value })} className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={savingProfile} className="px-8 h-12 bg-orange text-white text-[14px] font-semibold hover:bg-orange-hover transition-colors disabled:opacity-50">
                                    {savingProfile ? "Saving..." : "Save Addresses"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ──────────── SAVED CARDS TAB ──────────── */}
                    {activeTab === "payment-methods" && (
                        <div>
                            <h2 className="font-sans text-[28px] font-semibold text-primary mb-2">Saved Cards</h2>
                            <p className="text-[#6e7a92] mb-8 text-sm">Manage your saved credit and debit cards for faster checkout.</p>

                            {loadingCards ? (
                                <div className="text-[#6e7a92] text-sm">Loading cards...</div>
                            ) : savedCards.length === 0 ? (
                                <div className="border border-[#cad4e4] bg-[#f0f3f7] p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto mb-4 border border-[#cad4e4]">
                                        <CreditCard className="w-5 h-5 text-[#6e7a92]" />
                                    </div>
                                    <h3 className="text-primary font-semibold text-[18px] mb-2">No saved cards</h3>
                                    <p className="text-[#6e7a92] text-sm max-w-sm mx-auto">
                                        You haven't saved any payment methods yet. You can save your card securely during your next checkout.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {savedCards.map((card) => (
                                        <div key={card.id} className="border border-[#cad4e4] bg-white p-5 flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-8 bg-[#f4f7f9] border border-[#cad4e4] rounded flex items-center justify-center font-bold text-primary text-xs uppercase">
                                                    {card.brand}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-primary text-[15px] mb-1">
                                                        •••• •••• •••• {card.last4}
                                                    </p>
                                                    <p className="text-[#6e7a92] text-[13px]">
                                                        Expires {card.exp_month}/{card.exp_year}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => deleteCard(card.id)}
                                                className="text-[#6e7a92] hover:text-red-500 transition-colors bg-[#f0f3f7] hover:bg-red-50 p-2 rounded"
                                                title="Remove card"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                    {/* ──────────── SECURITY TAB ──────────── */}
                    {activeTab === "security" && (
                        <div>
                            <h2 className="font-sans text-[28px] font-semibold text-primary mb-2">Security</h2>
                            <p className="text-[#6e7a92] mb-8 text-sm">Change your password to keep your account secure.</p>

                            <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
                                <div>
                                    <label className="block text-[13px] font-semibold text-primary mb-2">Current Password *</label>
                                    <input
                                        type="password"
                                        value={secForm.current_password}
                                        onChange={(e) => setSecForm({ ...secForm, current_password: e.target.value })}
                                        required
                                        className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-semibold text-primary mb-2">New Password *</label>
                                    <input
                                        type="password"
                                        value={secForm.password}
                                        onChange={(e) => setSecForm({ ...secForm, password: e.target.value })}
                                        required
                                        minLength={8}
                                        className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-semibold text-primary mb-2">Confirm New Password *</label>
                                    <input
                                        type="password"
                                        value={secForm.password_confirmation}
                                        onChange={(e) => setSecForm({ ...secForm, password_confirmation: e.target.value })}
                                        required
                                        className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange"
                                    />
                                </div>
                                <button type="submit" disabled={savingPassword} className="px-8 h-12 bg-orange text-white text-[14px] font-semibold hover:bg-orange-hover transition-colors disabled:opacity-50">
                                    {savingPassword ? "Updating..." : "Change Password"}
                                </button>
                            </form>
                        </div>
                    )}

                </div>
            </section>

            <Dialog
                open={Boolean(requestDialogOrder)}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseOrderRequestDialog();
                    }
                }}
            >
                <DialogContent className="border border-[#cad4e4] bg-white p-0 sm:max-w-[560px]">
                    <DialogHeader className="border-b border-[#cad4e4] px-6 py-5">
                        <DialogTitle className="font-sans text-[28px] font-semibold text-primary">
                            {getOrderRequestTitle()}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[#6e7a92]">
                            {requestDialogOrder
                                ? `${requestDialogOrder.order_number} • ${getOrderRequestDescription()}`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitOrderRequest} className="space-y-5 px-6 py-6">
                        <div>
                            <label className="block text-[13px] font-semibold text-primary mb-2">Reason *</label>
                            <select
                                value={requestForm.reason}
                                onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                                required
                                className="w-full h-12 border border-[#cad4e4] bg-[#f4f7f9] px-4 text-[14px] outline-none focus:border-orange"
                            >
                                {REFUND_REASONS.map((reason) => (
                                    <option key={reason} value={reason}>
                                        {reason}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[13px] font-semibold text-primary mb-2">Details *</label>
                            <textarea
                                value={requestForm.details}
                                onChange={(e) => setRequestForm({ ...requestForm, details: e.target.value })}
                                required
                                rows={6}
                                placeholder={getOrderRequestDetailsPlaceholder()}
                                className="w-full border border-[#cad4e4] bg-[#f4f7f9] px-4 py-3 text-[14px] outline-none focus:border-orange resize-y"
                            />
                        </div>

                        <DialogFooter className="gap-3 border-t border-[#cad4e4] pt-5">
                            <button
                                type="button"
                                onClick={handleCloseOrderRequestDialog}
                                disabled={submittingRequest}
                                className="h-11 border border-[#cad4e4] px-5 text-sm font-semibold text-primary transition-colors hover:border-orange hover:text-orange disabled:opacity-50"
                            >
                                Close
                            </button>
                            <button
                                type="submit"
                                disabled={submittingRequest}
                                className="h-11 bg-orange px-5 text-sm font-semibold text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
                            >
                                {submittingRequest ? "Sending..." : getOrderRequestLabel()}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default withErrorBoundary(AccountIsland, "Account");
