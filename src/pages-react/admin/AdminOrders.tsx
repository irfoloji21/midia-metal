import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Download, Eye, MapPin, RefreshCcw, RotateCcw, Truck, X, XCircle } from "lucide-react";
import { API_URL } from "@/lib/api";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MOCK_TRACKING_CODES = [
  "EZ1000000001",
  "EZ2000000002",
  "EZ3000000003",
  "EZ4000000004",
  "EZ5000000005",
  "EZ6000000006",
  "EZ7000000007",
];

const getRequestTypeLabel = (requestType?: string) =>
  requestType === "cancel" ? "Cancel order" : "Cancel & refund";

const getRequestStatusLabel = (requestStatus?: string) => {
  if (requestStatus === "approved") return "Approved";
  if (requestStatus === "rejected") return "Rejected";
  return "Pending Review";
};

const getPaymentStatusBadgeClass = (paymentStatus?: string) => {
  if (paymentStatus === "paid") return "bg-green-100 text-green-800";
  if (paymentStatus === "refunded") return "bg-slate-100 text-slate-700";
  if (paymentStatus === "refund_pending" || paymentStatus === "manual_refund_pending") return "bg-blue-100 text-blue-700";
  if (paymentStatus === "failed" || paymentStatus === "refund_failed") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
};

const getPaymentStatusLabel = (paymentStatus?: string) =>
  paymentStatus === "manual_refund_pending" ? "Manual Refund Pending" : paymentStatus || "pending";

const isBankTransferPayment = (paymentMethod?: string) =>
  ["bank_transfer", "direct bank transfer"].includes(String(paymentMethod || "").trim().toLowerCase());

const getFulfilmentMethod = (order?: any): "delivery" | "click_collect" =>
  (order?.shipping_metadata?.fulfilment_method === "click_collect"
    || order?.shipping_metadata?.fulfillment_method === "click_collect")
    ? "click_collect"
    : "delivery";

export default function AdminOrders() {
  type AdminOrder = Record<string, any>;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { sort, toggleSort } = useTableSort("created_at", "desc");
  const [shippingBusy, setShippingBusy] = useState<"label" | "track" | "void" | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [bankRefundRequest, setBankRefundRequest] = useState<any>(null);
  const [bankRefundAcknowledged, setBankRefundAcknowledged] = useState(false);
  const [reviewingBankRefund, setReviewingBankRefund] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await apiFetch<{ data: any[] }>("/admin/orders");
      setOrders(res.data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const openOrder = async (orderId: number) => {
    try {
      const order = await apiFetch<AdminOrder>(`/admin/orders/${orderId}`);
      setViewingOrder(order);
    } catch {
      toast.error("Failed to load order details");
    }
  };

  const updateOrder = async (id: number, payload: Record<string, any>, successMessage: string, errorMessage: string) => {
    try {
      const updated = await apiFetch<AdminOrder>(`/admin/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setViewingOrder(updated);
      await loadOrders();
      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
    }
  };

  const handleCreateShippingLabel = async () => {
    if (!viewingOrder) return;

    setShippingBusy("label");
    try {
      const updated = await apiFetch<AdminOrder>(`/admin/orders/${viewingOrder.id}/shipping/label`, {
        method: "POST",
        body: JSON.stringify({ tracking_number: (viewingOrder.tracking_number || "").trim() || undefined }),
      });
      setViewingOrder(updated);
      await loadOrders();
      toast.success("Shipping label created");
      // Auto-refresh tracking after label creation
      setShippingBusy("track");
      try {
        const tracked = await apiFetch<AdminOrder>(`/admin/orders/${viewingOrder.id}/shipping/track`, {
          method: "POST",
          body: JSON.stringify({ tracking_number: (updated.tracking_number || "").trim() || undefined }),
        });
        setViewingOrder(tracked);
        await loadOrders();
      } catch {
        // non-fatal: tracking refresh failure after label creation
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create shipping label");
    } finally {
      setShippingBusy(null);
    }
  };

  const handleRefreshTracking = async () => {
    if (!viewingOrder) return;

    setShippingBusy("track");
    try {
      const updated = await apiFetch<AdminOrder>(`/admin/orders/${viewingOrder.id}/shipping/track`, {
        method: "POST",
        body: JSON.stringify({ tracking_number: (viewingOrder.tracking_number || "").trim() || undefined }),
      });
      setViewingOrder(updated);
      await loadOrders();
      toast.success("Tracking updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to refresh tracking");
    } finally {
      setShippingBusy(null);
    }
  };

  const handleVoidShipment = async () => {
    if (!viewingOrder) return;
    if (!window.confirm("Are you sure you want to cancel this label? This will request a refund for the shipping label.")) return;

    setShippingBusy("void");
    try {
      const updated = await apiFetch<AdminOrder>(`/admin/orders/${viewingOrder.id}/shipping/void`, {
        method: "POST",
      });
      setViewingOrder(updated);
      await loadOrders();
      toast.success("Label canceled successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel label");
    } finally {
      setShippingBusy(null);
    }
  };

  const handleSaveTracking = async () => {
    if (!viewingOrder) return;

    try {
      const updated = await apiFetch<AdminOrder>(`/admin/orders/${viewingOrder.id}`, {
        method: "PUT",
        body: JSON.stringify({ tracking_number: (viewingOrder.tracking_number || "").trim() }),
      });
      setViewingOrder(updated);
      await loadOrders();
      toast.success("Tracking number saved");
    } catch {
      toast.error("Failed to save tracking number");
    }
  };

  const handleRefund = async (amount?: number) => {
    if (!viewingOrder) return;
    if (!confirm(`Are you sure you want to process a ${amount ? `partial refund of £${amount}` : "full refund"} for this order via Stripe?`)) return;

    setRefunding(true);
    try {
      const res = await apiFetch<{ order: any; message: string }>(`/admin/orders/${viewingOrder.id}/refund`, {
        method: "POST",
        body: amount ? JSON.stringify({ amount }) : undefined,
      });
      setViewingOrder(res.order);
      await loadOrders();
      toast.success(res.message || "Refund processed successfully");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to process refund");
    } finally {
      setRefunding(false);
    }
  };

  const handleReviewRequest = async (requestId: number, requestStatus: "approved" | "rejected", acknowledgeBankRefund = false) => {
    if (!viewingOrder) return;

    const request = viewingOrder.customer_requests?.find((item: any) => item.id === requestId);
    const requiresManualRefundAcknowledgement = requestStatus === "approved"
      && request?.request_type === "cancel_refund"
      && viewingOrder.payment_status === "paid"
      && isBankTransferPayment(viewingOrder.payment_method);

    if (requiresManualRefundAcknowledgement && !acknowledgeBankRefund) {
      setBankRefundRequest(request);
      setBankRefundAcknowledged(false);
      return;
    }

    try {
      if (requiresManualRefundAcknowledgement) setReviewingBankRefund(true);
      await apiFetch(`/admin/messages/${requestId}/request-status`, {
        method: "PUT",
        body: JSON.stringify({ request_status: requestStatus }),
      });

      const updatedOrder = await apiFetch<AdminOrder>(`/admin/orders/${viewingOrder.id}`);
      setViewingOrder(updatedOrder);
      await loadOrders();
      toast.success(requestStatus === "approved" ? "Cancellation request approved" : "Cancellation request rejected");
      if (requiresManualRefundAcknowledgement) {
        setBankRefundRequest(null);
        setBankRefundAcknowledged(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to review request");
    } finally {
      if (requiresManualRefundAcknowledgement) setReviewingBankRefund(false);
    }
  };

  const filteredOrders = sortRows(orders
    .filter((order) => {
      const matchesSearch =
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    }), sort.key, sort.direction);

  const currentFulfilmentMethod = getFulfilmentMethod(viewingOrder);
  const isClickCollectOrder = currentFulfilmentMethod === "click_collect";

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-sans text-[#10275c]">Orders</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by ID, name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
        />
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white flex-1 sm:flex-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow overflow-x-auto text-sm md:text-base">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableTableHeader label="Order ID" sortKey="order_number" sort={sort} onSort={toggleSort} />
              <SortableTableHeader label="Customer" sortKey="customer_name" sort={sort} onSort={toggleSort} />
              <SortableTableHeader label="Date" sortKey="created_at" sort={sort} onSort={toggleSort} />
              <SortableTableHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} />
              <SortableTableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableTableHeader label="Payment" sortKey="payment_status" sort={sort} onSort={toggleSort} />
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">No orders found.</td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    <div className="mt-1">
                      {getFulfilmentMethod(order) === "click_collect" ? (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                          Click & Collect
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-800">
                          Delivery
                        </span>
                      )}
                    </div>
                    {order.customer_requests_count > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange">
                          {order.customer_requests_count} request{order.customer_requests_count > 1 ? "s" : ""}
                        </span>
                        {order.unread_customer_requests_count > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
                            {order.unread_customer_requests_count} unread
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                    <div className="text-sm text-gray-500">{order.customer_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">£{order.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === "delivered" ? "bg-green-100 text-green-800" : order.status === "shipped" ? "bg-blue-100 text-blue-800" : order.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusBadgeClass(order.payment_status)}`}>
                      {getPaymentStatusLabel(order.payment_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openOrder(order.id)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewingOrder && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mt-20 md:mt-0 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10 flex-shrink-0">
              <h2 className="text-xl font-bold font-sans text-[#10275c]">Order #{viewingOrder.order_number}</h2>
              <button onClick={() => setViewingOrder(null)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Customer Details</h3>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{viewingOrder.customer_name}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900">{viewingOrder.customer_email}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">
                        {isClickCollectOrder ? "Customer Address (Billing/Contact)" : "Shipping Address"}
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">{viewingOrder.shipping_address}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Delivery Option</dt>
                      <dd className="mt-1">
                        {isClickCollectOrder ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
                            <MapPin className="w-3.5 h-3.5" />
                            Click & Collect
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-800">
                            <Truck className="w-3.5 h-3.5" />
                            Delivery
                          </span>
                        )}
                      </dd>
                      {viewingOrder.shipping_metadata?.selected_delivery_option && (
                        <div className="mt-2 text-sm text-[#10275c] space-y-1">
                          <p>
                            Service: <strong>{viewingOrder.shipping_metadata.selected_delivery_option.service || "-"}</strong>
                          </p>
                          {viewingOrder.shipping_metadata.selected_delivery_option.parcel_summary?.parcel_count > 1 && (
                            <p>
                              Parcels: <strong>{viewingOrder.shipping_metadata.selected_delivery_option.parcel_summary.parcel_count}</strong>
                              {typeof viewingOrder.shipping_metadata.selected_delivery_option.parcel_summary.total_weight_kg === "number"
                                ? ` (${Number(viewingOrder.shipping_metadata.selected_delivery_option.parcel_summary.total_weight_kg).toFixed(2)}kg total)`
                                : ""}
                            </p>
                          )}
                          <p>
                            ETA: <strong>{viewingOrder.shipping_metadata.selected_delivery_option.estimated_delivery_date || "-"}</strong>
                            {viewingOrder.shipping_metadata.selected_delivery_option.estimated_delivery_window_start
                              && viewingOrder.shipping_metadata.selected_delivery_option.estimated_delivery_window_end
                              ? ` (${viewingOrder.shipping_metadata.selected_delivery_option.estimated_delivery_window_start} - ${viewingOrder.shipping_metadata.selected_delivery_option.estimated_delivery_window_end})`
                              : ""}
                          </p>
                        </div>
                      )}
                    </div>
                    {viewingOrder.billing_address && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Billing Address</dt>
                        <dd className="mt-1 text-sm text-gray-900">{viewingOrder.billing_address}</dd>
                      </div>
                    )}
                    {viewingOrder.notes && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Notes</dt>
                        <dd className="mt-1 text-sm text-gray-900">{viewingOrder.notes}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Order Update</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                      <select
                        value={viewingOrder.status}
                        onChange={(e) => updateOrder(viewingOrder.id, { status: e.target.value }, "Order status updated", "Failed to update status")}
                        className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm border"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                      <div className="space-y-3">
                        <select
                          value={viewingOrder.payment_status ?? "pending"}
                          onChange={(e) => updateOrder(viewingOrder.id, { payment_status: e.target.value }, "Payment status updated", "Failed to update payment status")}
                          className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm border"
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="refund_pending">Refund Pending</option>
                          <option value="manual_refund_pending">Manual Refund Pending</option>
                          <option value="failed">Failed</option>
                          <option value="refund_failed">Refund Failed</option>
                          <option value="refunded">Refunded</option>
                          <option value="partially_refunded">Partially Refunded</option>
                        </select>

                        {viewingOrder.stripe_payment_intent_id && (viewingOrder.payment_status === "paid" || viewingOrder.payment_status === "partially_refunded") && (
                          <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stripe Actions</p>
                            <button
                              type="button"
                              onClick={() => handleRefund()}
                              disabled={refunding}
                              className="inline-flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {refunding ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                              Full Refund via Stripe
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const amt = prompt("Enter partial refund amount (£):");
                                if (amt) handleRefund(parseFloat(amt));
                              }}
                              disabled={refunding}
                              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Partial Refund...
                            </button>
                          </div>
                        )}

                        {viewingOrder.stripe_receipt_url && (
                          <div className="pt-2">
                            <a
                              href={viewingOrder.stripe_receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              View Stripe Receipt
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {viewingOrder.bank_transfer_details && (
                <section className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-6">
                  <h3 className="text-lg font-semibold text-[#10275c] mb-3">Selected Bank Account</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-gray-500">Bank</dt><dd className="font-medium text-gray-900">{viewingOrder.bank_transfer_details.bank_name}</dd></div>
                    <div><dt className="text-gray-500">Account Name</dt><dd className="font-medium text-gray-900">{viewingOrder.bank_transfer_details.account_name}</dd></div>
                    <div><dt className="text-gray-500">Sort Code</dt><dd className="font-medium text-gray-900">{viewingOrder.bank_transfer_details.sort_code}</dd></div>
                    <div><dt className="text-gray-500">Account Number</dt><dd className="font-medium text-gray-900">{viewingOrder.bank_transfer_details.account_number}</dd></div>
                    {viewingOrder.bank_transfer_details.iban && <div><dt className="text-gray-500">IBAN</dt><dd className="font-medium text-gray-900">{viewingOrder.bank_transfer_details.iban}</dd></div>}
                    {viewingOrder.bank_transfer_details.bic_swift && <div><dt className="text-gray-500">BIC / SWIFT</dt><dd className="font-medium text-gray-900">{viewingOrder.bank_transfer_details.bic_swift}</dd></div>}
                  </dl>
                </section>
              )}

              {viewingOrder.customer_requests?.length > 0 && (
                <section className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-6 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-white p-2 text-[#eb5c10]">
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#10275c]">Cancellation & Refund Requests</h3>
                      <p className="mt-1 text-sm text-[#6e7a92]">
                        Customer requests for this order appear here so admins can review them alongside status and payment updates.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {viewingOrder.customer_requests.map((request: any) => (
                      <article key={request.id} className="rounded-lg border border-[#fdba74] bg-white p-5 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-orange">
                              {getRequestTypeLabel(request.request_type)}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${request.request_status === "approved" ? "bg-green-100 text-green-700" : request.request_status === "rejected" ? "bg-slate-200 text-slate-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {getRequestStatusLabel(request.request_status)}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${request.read ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"}`}>
                              {request.read ? "Read" : "Unread"}
                            </span>
                          </div>
                          <p className="text-xs text-[#6e7a92]">{new Date(request.created_at).toLocaleString()}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e7a92]">Reason</p>
                          <p className="mt-1 text-sm font-semibold text-[#10275c]">{request.reason || "No reason provided"}</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e7a92]">Details</p>
                          <div className="mt-2 rounded-lg bg-[#fffaf5] p-4 text-sm leading-relaxed text-[#4b5563] whitespace-pre-wrap">
                            {request.details || request.message}
                          </div>
                        </div>

                        {request.request_status === "pending" && (
                          <div className="flex flex-wrap gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => handleReviewRequest(request.id, "approved")}
                              className="inline-flex items-center rounded-md bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-hover"
                            >
                              Accept Cancellation
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReviewRequest(request.id, "rejected")}
                              className="inline-flex items-center rounded-md border border-[#cad4e4] bg-white px-4 py-2 text-sm font-semibold text-[#10275c] hover:bg-[#f4f7f9]"
                            >
                              Reject Request
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {isClickCollectOrder ? (
                <section className="rounded-xl border border-[#cad4e4] bg-[#f8fafc] p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-[#10275c] flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#eb5c10]" />
                    Collection Order
                  </h3>
                  <p className="text-sm text-gray-700">
                    This order is marked as <strong>Click &amp; Collect</strong>. Shipping labels and tracking are not applicable.
                  </p>
                  <p className="text-sm text-gray-700">
                    Shipping charge: <strong>£0.00</strong>
                  </p>
                </section>
              ) : (
                <section className="rounded-xl border border-[#cad4e4] bg-[#f8fafc] p-6 space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#10275c] flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[#eb5c10]" />
                        Shipping Integration
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Provider: <strong>{viewingOrder.shipping_provider || "easypost"}</strong>
                        {viewingOrder.shipping_metadata?.mode === "mock" ? " (mock)" : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCreateShippingLabel}
                        disabled={shippingBusy !== null}
                        className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-hover disabled:opacity-60"
                      >
                        <Truck className="w-4 h-4" />
                        {viewingOrder.shipping_label_url ? "Regenerate Label" : "Create Label"}
                      </button>

                      <button
                        type="button"
                        onClick={handleRefreshTracking}
                        disabled={shippingBusy !== null}
                        className="inline-flex items-center gap-1 text-sm text-[#6e7a92] hover:text-[#10275c] disabled:opacity-50 underline-offset-2 hover:underline"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${shippingBusy === "track" ? "animate-spin" : ""}`} />
                        Refresh tracking
                      </button>

                      {viewingOrder.shipping_label_url && (
                        <a
                          href={`${API_URL}/admin/orders/${viewingOrder.id}/shipping/label/download`}
                          download
                          className="inline-flex items-center gap-2 rounded-md border border-[#cad4e4] bg-white px-4 py-2 text-sm font-semibold text-[#10275c] hover:bg-[#f4f7f9]"
                        >
                          <Download className="w-4 h-4" />
                          Download Label
                        </a>
                      )}

                      {viewingOrder.shipping_label_url && viewingOrder.shipping_status !== "voided" && (
                        <button
                          type="button"
                          onClick={handleVoidShipment}
                          disabled={shippingBusy !== null}
                          className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <XCircle className={`w-4 h-4 ${shippingBusy === "void" ? "animate-spin" : ""}`} />
                          Cancel Label
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-white bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6e7a92]">Carrier</p>
                      <p className="mt-2 text-sm font-semibold text-[#10275c]">{viewingOrder.shipping_carrier || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6e7a92]">Service</p>
                      <p className="mt-2 text-sm font-semibold text-[#10275c]">{viewingOrder.shipping_service || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6e7a92]">Shipping Status</p>
                      <p className="mt-2 text-sm font-semibold text-[#10275c]">{viewingOrder.shipping_status || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6e7a92]">Shipment ID</p>
                      <p className="mt-2 text-sm font-semibold text-[#10275c] break-all">{viewingOrder.shipping_shipment_id || "-"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={viewingOrder.tracking_number ?? ""}
                        placeholder="e.g. EZ2000000002 or real carrier tracking"
                        onChange={(e) => setViewingOrder({ ...viewingOrder, tracking_number: e.target.value })}
                        onBlur={handleSaveTracking}
                        className="block w-full rounded-md border-gray-300 py-2 px-3 text-sm border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="mt-2 text-xs text-[#6e7a92]">
                      EasyPost test tracking codes: {MOCK_TRACKING_CODES.join(", ")}.
                    </p>
                    {viewingOrder.shipping_metadata?.tracking_detail && (
                      <p className="mt-2 text-sm text-[#10275c]">
                        Latest carrier detail: {viewingOrder.shipping_metadata.tracking_detail}
                      </p>
                    )}
                  </div>
                </section>
              )}

              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Order Items</h3>
                <div className="rounded-lg bg-gray-50 p-6 border">
                  {viewingOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-4 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.quantity}x {item.product_name}</p>
                        {item.variant_details && (
                          <div className="mt-1 space-y-1">
                            {Object.entries(item.variant_details).map(([opt, value]: [string, any]) => (
                              <p key={opt} className="text-xs text-[#eb5c10] font-bold uppercase tracking-wider">
                                {opt}: {value?.value ?? value}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-900">{item.product_price}</p>
                    </div>
                  ))}
                  <div className="mt-4 flex justify-between items-center pt-4 border-t font-semibold">
                    <p className="text-gray-900">Total</p>
                    <p className="text-gray-900">£{viewingOrder.total}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(bankRefundRequest)}
        onOpenChange={(open) => {
          if (open) return;
          if (bankRefundAcknowledged && !reviewingBankRefund) {
            setBankRefundRequest(null);
            setBankRefundAcknowledged(false);
          }
        }}
      >
        <DialogContent
          hideCloseButton
          overlayClassName="z-[110]"
          className="z-[120] max-w-md p-5"
          onEscapeKeyDown={(event) => {
            if (!bankRefundAcknowledged || reviewingBankRefund) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!bankRefundAcknowledged || reviewingBankRefund) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Manual Bank Transfer Refund</DialogTitle>
            <DialogDescription>
              Order {viewingOrder?.order_number} was paid by bank transfer. The refund cannot be processed automatically. Please send the money back to the customer yourself, then manually change the payment status to “Refunded” in the admin panel.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={bankRefundAcknowledged}
              onChange={(event) => setBankRefundAcknowledged(event.target.checked)}
              disabled={reviewingBankRefund}
              className="mt-0.5 h-4 w-4 accent-orange"
            />
            <span>I have read and understood that I must refund the customer manually and update the payment status afterward.</span>
          </label>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setBankRefundRequest(null);
                setBankRefundAcknowledged(false);
              }}
              disabled={!bankRefundAcknowledged || reviewingBankRefund}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => bankRefundRequest && handleReviewRequest(bankRefundRequest.id, "approved", true)}
              disabled={!bankRefundAcknowledged || reviewingBankRefund}
              className="rounded-md bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reviewingBankRefund ? "Approving..." : "Acknowledge & Approve"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
