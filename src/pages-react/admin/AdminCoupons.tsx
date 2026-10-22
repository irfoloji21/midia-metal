import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

const EMPTY = { code: "", type: "percentage" as "percentage" | "fixed", value: "", min_order_amount: "", max_uses: "", expires_at: "", active: true };

export default function AdminCoupons() {
    const [coupons, setCoupons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<any>(EMPTY);
    const [editing, setEditing] = useState<any>(null);
    const [showForm, setShowForm] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const { sort, toggleSort } = useTableSort("code");

    useEffect(() => { loadCoupons(); }, []);

    const loadCoupons = async () => {
        try { setCoupons(await apiFetch("/admin/coupons")); }
        catch { toast.error("Failed to load coupons"); }
        finally { setLoading(false); }
    };

    const openCreate = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
    const openEdit = (c: any) => {
        setForm({ ...c, expires_at: c.expires_at ? c.expires_at.split("T")[0] : "", value: String(c.value), min_order_amount: String(c.min_order_amount || ""), max_uses: String(c.max_uses || "") });
        setEditing(c);
        setShowForm(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...form,
            value: parseFloat(form.value),
            min_order_amount: parseFloat(form.min_order_amount) || 0,
            max_uses: form.max_uses ? parseInt(form.max_uses) : null,
            expires_at: form.expires_at || null,
        };
        try {
            if (editing) {
                const updated = await apiFetch(`/admin/coupons/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
                setCoupons((prev) => prev.map((c) => c.id === editing.id ? updated : c));
                toast.success("Coupon updated");
            } else {
                const created = await apiFetch("/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
                setCoupons((prev) => [created, ...prev]);
                toast.success("Coupon created");
            }
            setShowForm(false);
        } catch (err: any) { toast.error(err?.message || "Failed to save coupon"); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this coupon?")) return;
        try {
            await apiFetch(`/admin/coupons/${id}`, { method: "DELETE" });
            setCoupons((prev) => prev.filter((c) => c.id !== id));
            toast.success("Deleted");
        } catch { toast.error("Failed to delete"); }
    };

    const filteredCoupons = sortRows(
        coupons.filter((c) => c.code.toLowerCase().includes(searchTerm.toLowerCase())),
        sort.key,
        sort.direction,
    );

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Coupons</h1>
                <button onClick={openCreate} className="inline-flex items-center gap-2 bg-orange text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-orange-hover">
                    <Plus className="h-4 w-4" /> New Coupon
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search coupons..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Code" sortKey="code" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <SortableTableHeader label="Type" sortKey="type" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <SortableTableHeader label="Value" sortKey="value" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <SortableTableHeader label="Min Order" sortKey="min_order_amount" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <SortableTableHeader label="Uses" sortKey="used_count" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <SortableTableHeader label="Expires" sortKey="expires_at" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <SortableTableHeader label="Active" sortKey="active" sort={sort} onSort={toggleSort} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCoupons.length > 0 ? (
                            filteredCoupons.map((c) => (
                                <tr key={c.id}>
                                    <td className="px-4 py-3 font-mono font-semibold text-sm text-gray-900">{c.code}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{c.type}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">{c.type === "percentage" ? `${c.value}%` : `£${c.value}`}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{c.min_order_amount > 0 ? `£${c.min_order_amount}` : "—"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{c.max_uses ? `${c.used_count}/${c.max_uses}` : `${c.used_count}/∞`}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {c.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {c.active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => openEdit(c)} className="text-indigo-600 hover:text-indigo-900"><Edit2 className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No coupons found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-bold text-[#10275c]">{editing ? "Edit Coupon" : "New Coupon"}</h2>
                            <button onClick={() => setShowForm(false)}><X className="h-6 w-6 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                                    <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                        className="border rounded px-3 py-2 text-sm w-full font-mono" placeholder="SAVE10" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="border rounded px-3 py-2 text-sm w-full">
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (£)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                                    <input required type="number" step="0.01" min="0" max={form.type === "percentage" ? 100 : undefined} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
                                        className="border rounded px-3 py-2 text-sm w-full" placeholder={form.type === "percentage" ? "10" : "15.00"} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Order (£)</label>
                                    <input type="number" step="0.01" min="0" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })}
                                        className="border rounded px-3 py-2 text-sm w-full" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
                                    <input type="number" min="1" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })}
                                        className="border rounded px-3 py-2 text-sm w-full" placeholder="Unlimited" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
                                    <input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                        className="border rounded px-3 py-2 text-sm w-full" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                                Active
                            </label>
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded text-gray-700 hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm bg-orange text-white rounded font-semibold hover:bg-orange-hover">Save Coupon</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
