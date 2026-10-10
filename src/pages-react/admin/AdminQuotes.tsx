import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Eye, Trash2, X, MessageSquare, Clock, Reply, Send } from "lucide-react";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    new: { label: "New", color: "bg-blue-100 text-blue-800", icon: MessageSquare },
    reviewing: { label: "Reviewing", color: "bg-yellow-100 text-yellow-800", icon: Clock },
    replied: { label: "Replied", color: "bg-green-100 text-green-800", icon: Reply },
};

export default function AdminQuotes() {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const { sort, toggleSort } = useTableSort("created_at", "desc");

    useEffect(() => { loadQuotes(); }, []);

    const loadQuotes = async () => {
        try {
            const res = await apiFetch<any[]>("/admin/quotes");
            setQuotes(res);
        } catch { toast.error("Failed to load quote requests"); }
        finally { setLoading(false); }
    };

    const handleUpdate = async (id: number, data: any) => {
        try {
            const updated = await apiFetch(`/admin/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) });
            setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
            if (viewing?.id === id) setViewing(updated);
            toast.success("Quote updated");
        } catch { toast.error("Failed to update"); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this quote request?")) return;
        try {
            await apiFetch(`/admin/quotes/${id}`, { method: "DELETE" });
            setQuotes((prev) => prev.filter((q) => q.id !== id));
            setViewing(null);
            toast.success("Deleted");
        } catch { toast.error("Failed to delete"); }
    };

    const sendResponse = async (id: number) => {
        if (!viewing || viewing.id !== id) return;
        try {
            await apiFetch(`/admin/quotes/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    status: viewing.status,
                    response_message: viewing.response_message ?? "",
                    quoted_valid_until: viewing.quoted_valid_until || null,
                }),
            });
            const updated = await apiFetch(`/admin/quotes/${id}/send-response`, { method: "POST" });
            setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)));
            setViewing(updated);
            toast.success("Quote response email sent");
        } catch (error: any) {
            toast.error(error.message || "Failed to send quote response");
        }
    };

    const filteredQuotes = sortRows(quotes
        .filter((q) => {
            const matchesSearch =
                q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                q.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.service || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === "all" || q.status === statusFilter;
            return matchesSearch && matchesStatus;
        }), sort.key, sort.direction);

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Quote Requests</h1>
                <span className="text-sm text-gray-500">{quotes.filter(q => q.status === "new").length} new</span>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search quotes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white w-full lg:w-48"
                >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="replied">Replied</option>
                </select>
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Service" sortKey="service" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Date" sortKey="created_at" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredQuotes.map((q) => {
                            const sc = statusConfig[q.status] ?? statusConfig.new;
                            return (
                                <tr key={q.id} className={q.status === "new" ? "bg-blue-50" : ""}>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{q.name}</div>
                                        <div className="text-sm text-gray-500">{q.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{q.service || "—"}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sc.color}`}>{sc.label}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium flex gap-2 justify-end">
                                        <button onClick={() => setViewing(q)} className="text-indigo-600 hover:text-indigo-900"><Eye className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredQuotes.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No quote requests found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {viewing && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-[#10275c]">Quote from {viewing.name}</h2>
                            <button onClick={() => setViewing(null)}><X className="h-6 w-6 text-gray-400" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div><span className="font-medium text-gray-500">Email:</span><p>{viewing.email}</p></div>
                                <div><span className="font-medium text-gray-500">Phone:</span><p>{viewing.phone || "—"}</p></div>
                                <div><span className="font-medium text-gray-500">Service:</span><p>{viewing.service || "—"}</p></div>
                                <div><span className="font-medium text-gray-500">Submitted:</span><p>{new Date(viewing.created_at).toLocaleString()}</p></div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-500 text-sm">Description:</span>
                                <p className="mt-1 text-sm bg-gray-50 p-4 rounded border">{viewing.description}</p>
                            </div>
                            {viewing.files?.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-500 text-sm">Attached Files:</span>
                                    <div className="mt-2 space-y-1">
                                        {viewing.files.map((f: string, i: number) => (
                                            <a key={i} href={f} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:underline">{f}</a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label>
                                <select
                                    value={viewing.status}
                                    onChange={(e) => {
                                        setViewing({ ...viewing, status: e.target.value });
                                        handleUpdate(viewing.id, { status: e.target.value });
                                    }}
                                    className="border rounded px-3 py-2 text-sm w-full"
                                >
                                    <option value="new">New</option>
                                    <option value="reviewing">Reviewing</option>
                                    <option value="replied">Replied</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                                <input
                                    type="date"
                                    value={viewing.quoted_valid_until ? String(viewing.quoted_valid_until).slice(0, 10) : ""}
                                    onChange={(e) => setViewing({ ...viewing, quoted_valid_until: e.target.value })}
                                    onBlur={(e) => handleUpdate(viewing.id, { quoted_valid_until: e.target.value || null })}
                                    className="border rounded px-3 py-2 text-sm w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Response</label>
                                <textarea
                                    rows={4}
                                    value={viewing.response_message ?? ""}
                                    onChange={(e) => setViewing({ ...viewing, response_message: e.target.value })}
                                    onBlur={(e) => handleUpdate(viewing.id, { response_message: e.target.value })}
                                    className="border rounded px-3 py-2 text-sm w-full resize-none"
                                    placeholder="Visible to the customer in their account portal."
                                />
                            </div>
                            <div className="flex flex-wrap justify-end gap-3 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => sendResponse(viewing.id)}
                                    className="inline-flex items-center gap-2 rounded bg-[#10275c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d1f4e]"
                                >
                                    <Send className="h-4 w-4" />
                                    Send Response Email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
