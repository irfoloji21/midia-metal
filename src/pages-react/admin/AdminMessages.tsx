import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, Trash2, RotateCcw } from "lucide-react";

const getMessageTypeLabel = (messageType?: string) =>
    messageType === "order_request" ? "Cancellation / Refund" : "Contact";

const getRequestTypeLabel = (requestType?: string) =>
    requestType === "cancel" ? "Cancel order" : "Cancel & refund";

const getRequestStatusLabel = (requestStatus?: string) => {
    if (requestStatus === "approved") return "Approved";
    if (requestStatus === "rejected") return "Rejected";
    return "Under Review";
};

const MESSAGE_STATUS_LABELS: Record<string, string> = {
    pending: "Under Review",
    in_progress: "In Progress",
    resolved: "Resolved",
};

export default function AdminMessages() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // all, read, unread
    const [filterType, setFilterType] = useState("all");

    useEffect(() => {
        loadMessages();
    }, []);

    const loadMessages = async () => {
        try {
            const res = await apiFetch<{ data?: any[] }>("/admin/messages");
            // API returns paginated object with .data array
            const data = res.data || (res as unknown as any[]);
            setMessages(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error("Failed to load messages");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: number) => {
        try {
            await apiFetch(`/admin/messages/${id}/read`, { method: "PUT" });
            toast.success("Message marked as read");
            loadMessages();
            setMessages(current => current.map(message => message.id === id ? { ...message, read: true } : message));
            setSelectedMessage((current: any) => current?.id === id ? { ...current, read: true } : current);
        } catch (e) {
            toast.error("Failed to update message status");
        }
    };

    const handleMessageStatusChange = async (id: number, status: string) => {
        try {
            const updated = await apiFetch<any>(`/admin/messages/${id}/status`, {
                method: "PUT",
                body: JSON.stringify({ status }),
            });
            const updatedMessage = { ...updated, request_status: updated.request_status || status };
            setMessages((current) => current.map((message) => message.id === id ? { ...message, ...updatedMessage } : message));
            setSelectedMessage((current: any) => current?.id === id ? { ...current, ...updatedMessage } : current);
            toast.success("Message status updated");
        } catch (e: any) {
            toast.error(e?.message || "Failed to update message status");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this message?")) return;
        try {
            await apiFetch(`/admin/messages/${id}`, { method: "DELETE" });
            toast.success("Message deleted");
            loadMessages();
            setSelectedMessage(null);
        } catch (e) {
            toast.error("Failed to delete message");
        }
    };

    const filteredMessages = messages
        .filter((msg) => {
            const matchesSearch =
                msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                msg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (msg.subject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (msg.order?.order_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (msg.reason || "").toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                filterStatus === "all" ? true :
                    filterStatus === "read" ? msg.read : !msg.read;

            const matchesType =
                filterType === "all" ? true : (msg.message_type || "contact") === filterType;

            return matchesSearch && matchesStatus && matchesType;
        })
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold font-sans text-[#10275c]">Messages</h1>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by customer, order or subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white w-full lg:w-52"
                    >
                        <option value="all">All Types</option>
                        <option value="order_request">Cancellation / Refund</option>
                        <option value="contact">Contact</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white w-full lg:w-48"
                    >
                        <option value="all">All Messages</option>
                        <option value="unread">Unread</option>
                        <option value="read">Read</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow overflow-hidden border border-[#e1e5eb]">
                    <ul className="divide-y divide-[#e1e5eb]">
                        {filteredMessages.length === 0 ? (
                            <li className="p-8 text-center text-gray-500">No messages found.</li>
                        ) : (
                            filteredMessages.map((msg) => (
                                <li
                                    key={msg.id}
                                    onClick={() => {
                                        setSelectedMessage(msg);
                                        if (!msg.read) handleMarkAsRead(msg.id);
                                    }}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between group ${selectedMessage?.id === msg.id ? "bg-blue-50/50" : ""
                                        }`}
                                >
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            {!msg.read && <span className="w-2 h-2 rounded-full bg-orange"></span>}
                                            <p className={`text-sm ${!msg.read ? "font-bold text-[#10275c]" : "text-gray-600"}`}>
                                                {msg.name}
                                            </p>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${msg.message_type === "order_request" ? "bg-orange-100 text-orange" : "bg-slate-100 text-slate-600"}`}>
                                                {getMessageTypeLabel(msg.message_type)}
                                            </span>
                                            {msg.message_type === "order_request" && msg.request_status ? (
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${msg.request_status === "approved" ? "bg-green-100 text-green-700" : msg.request_status === "rejected" ? "bg-slate-200 text-slate-700" : "bg-yellow-100 text-yellow-700"}`}>
                                                    {getRequestStatusLabel(msg.request_status)}
                                                </span>
                                            ) : msg.message_type !== "order_request" ? (
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${msg.status === "resolved" ? "bg-green-100 text-green-700" : msg.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                                                    {MESSAGE_STATUS_LABELS[msg.request_status] || "Under Review"}
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{msg.subject || msg.email}</p>
                                        {msg.order?.order_number && (
                                            <p className="text-[11px] text-[#6e7a92] mt-1">Order {msg.order.order_number}</p>
                                        )}
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {new Date(msg.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); }}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden border border-[#e1e5eb] min-h-[400px]">
                    {selectedMessage ? (
                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold font-sans text-[#10275c]">{selectedMessage.name}</h2>
                                    <p className="text-sm text-gray-500">{selectedMessage.email}</p>
                                    {selectedMessage.phone && <p className="text-sm text-gray-500">{selectedMessage.phone}</p>}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400">{new Date(selectedMessage.created_at).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-[#f0f2f5]">
                                <div className="flex flex-wrap gap-2">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${selectedMessage.message_type === "order_request" ? "bg-orange-100 text-orange" : "bg-slate-100 text-slate-600"}`}>
                                        {getMessageTypeLabel(selectedMessage.message_type)}
                                    </span>
                                    {selectedMessage.order?.order_number && (
                                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                                            Order {selectedMessage.order.order_number}
                                        </span>
                                    )}
                                    {selectedMessage.request_type && (
                                        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                            {getRequestTypeLabel(selectedMessage.request_type)}
                                        </span>
                                    )}
                                    {selectedMessage.message_type === "order_request" && selectedMessage.request_status ? (
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${selectedMessage.request_status === "approved" ? "bg-green-100 text-green-700" : selectedMessage.request_status === "rejected" ? "bg-slate-200 text-slate-700" : "bg-yellow-100 text-yellow-700"}`}>
                                            {getRequestStatusLabel(selectedMessage.request_status)}
                                        </span>
                                    ) : selectedMessage.message_type !== "order_request" ? (
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${selectedMessage.status === "resolved" ? "bg-green-100 text-green-700" : selectedMessage.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                                            {MESSAGE_STATUS_LABELS[selectedMessage.request_status] || "Under Review"}
                                        </span>
                                    ) : null}
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Subject</label>
                                    <p className="text-sm font-semibold text-[#10275c]">{selectedMessage.subject || "No Subject"}</p>
                                </div>
                                {selectedMessage.reason && (
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Reason</label>
                                        <p className="text-sm font-semibold text-[#10275c]">{selectedMessage.reason}</p>
                                    </div>
                                )}
                                {selectedMessage.details && (
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Details</label>
                                        <div className="mt-2 rounded-lg bg-orange-50 p-4 text-sm text-[#4b5563] leading-relaxed whitespace-pre-wrap">
                                            {selectedMessage.details}
                                        </div>
                                    </div>
                                )}
                                {selectedMessage.message_type !== "order_request" && (
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Message Status</label>
                                        <select
                                            value={selectedMessage.request_status || "pending"}
                                            onChange={(event) => handleMessageStatusChange(selectedMessage.id, event.target.value)}
                                            className="mt-2 block w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#10275c] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="pending">Under Review</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="resolved">Resolved</option>
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Message</label>
                                    <div className="mt-2 p-4 bg-gray-50 rounded-lg text-sm text-[#4b5563] leading-relaxed whitespace-pre-wrap min-h-[150px]">
                                        {selectedMessage.message}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-[#f0f2f5] flex gap-3">
                                <button
                                    onClick={() => handleDelete(selectedMessage.id)}
                                    className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded hover:bg-red-50 flex items-center gap-2"
                                >
                                    <Trash2 className="h-4 w-4" /> Delete Message
                                </button>
                                {!selectedMessage.read && (
                                    <button
                                        onClick={() => handleMarkAsRead(selectedMessage.id)}
                                        className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 flex items-center gap-2"
                                    >
                                        <CheckCircle className="h-4 w-4" /> Mark Read
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <RotateCcw className="h-12 w-12 mb-4 opacity-10" />
                            <p className="font-semibold">Select a message or cancellation request</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
