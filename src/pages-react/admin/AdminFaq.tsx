import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

export default function AdminFaq() {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [currentFaq, setCurrentFaq] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const { sort, toggleSort } = useTableSort("order");

    useEffect(() => {
        loadFaqs();
    }, []);

    const loadFaqs = async () => {
        try {
            const res = await apiFetch<any[]>("/admin/faqs");
            setFaqs(res);
        } catch (e) {
            toast.error("Failed to load FAQs");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this FAQ?")) return;
        try {
            await apiFetch(`/admin/faqs/${id}`, { method: "DELETE" });
            toast.success("FAQ deleted successfully");
            loadFaqs();
        } catch (e) {
            toast.error("Failed to delete FAQ");
        }
    };

    const openEdit = (faq: any = null) => {
        setCurrentFaq(
            faq || {
                question: "",
                answer: "",
                order: 0,
                active: true,
            }
        );
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentFaq.id) {
                await apiFetch(`/admin/faqs/${currentFaq.id}`, {
                    method: "PUT",
                    body: JSON.stringify(currentFaq),
                });
                toast.success("FAQ updated");
            } else {
                await apiFetch("/admin/faqs", {
                    method: "POST",
                    body: JSON.stringify(currentFaq),
                });
                toast.success("FAQ created");
            }
            setIsEditing(false);
            loadFaqs();
        } catch (err: any) {
            toast.error(err.message || "Failed to save FAQ");
        }
    };

    const filteredFaqs = sortRows(
        faqs.filter((f) => f.question.toLowerCase().includes(searchTerm.toLowerCase())),
        sort.key,
        sort.direction,
    );

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">FAQs</h1>
                <button
                    onClick={() => openEdit()}
                    className="flex items-center gap-2 rounded bg-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-hover"
                >
                    <Plus className="h-4 w-4" /> Add FAQ
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search FAQs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Order" sortKey="order" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Question" sortKey="question" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Status" sortKey="active" sort={sort} onSort={toggleSort} />
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredFaqs.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">No FAQs found.</td>
                            </tr>
                        ) : (
                            filteredFaqs.map((faq) => (
                                <tr key={faq.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {faq.order}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 truncate max-w-md">{faq.question}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${faq.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {faq.active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openEdit(faq)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(faq.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mt-20 md:mt-0 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold font-sans text-[#10275c]">{currentFaq.id ? "Edit FAQ" : "New FAQ"}</h2>
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Question</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentFaq.question}
                                        onChange={(e) => setCurrentFaq({ ...currentFaq, question: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        placeholder="Enter the question"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Answer</label>
                                    <textarea
                                        rows={4}
                                        required
                                        value={currentFaq.answer}
                                        onChange={(e) => setCurrentFaq({ ...currentFaq, answer: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        placeholder="Enter the answer"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Display Order</label>
                                        <input
                                            type="number"
                                            value={currentFaq.order}
                                            onChange={(e) => setCurrentFaq({ ...currentFaq, order: parseInt(e.target.value) || 0 })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        />
                                    </div>
                                    <div className="flex items-center mt-6">
                                        <input
                                            type="checkbox"
                                            id="faq-active"
                                            checked={currentFaq.active}
                                            onChange={(e) => setCurrentFaq({ ...currentFaq, active: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="faq-active" className="ml-2 text-sm text-gray-600">Active (Visible on site)</label>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-md bg-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:focus:outline-none"
                                >
                                    Save FAQ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
