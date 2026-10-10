import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

export default function AdminPortfolioCategories() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const { sort, toggleSort } = useTableSort("name");

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const res = await apiFetch<any[]>("/admin/portfolio-categories");
            setCategories(res);
        } catch (e) {
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this category?")) return;
        try {
            await apiFetch(`/admin/portfolio-categories/${id}`, { method: "DELETE" });
            toast.success("Category deleted");
            loadCategories();
        } catch (e) {
            toast.error("Failed to delete category");
        }
    };

    const openEdit = (category: any = null) => {
        setCurrentCategory(
            category || {
                name: "",
            }
        );
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentCategory.id) {
                await apiFetch(`/admin/portfolio-categories/${currentCategory.id}`, {
                    method: "PUT",
                    body: JSON.stringify(currentCategory),
                });
                toast.success("Category updated");
            } else {
                await apiFetch("/admin/portfolio-categories", {
                    method: "POST",
                    body: JSON.stringify(currentCategory),
                });
                toast.success("Category created");
            }
            setIsEditing(false);
            loadCategories();
        } catch (err: any) {
            toast.error(err.message || "Failed to save category");
        }
    };

    const filteredCategories = sortRows(
        categories.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        sort.key,
        sort.direction,
    );

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Portfolio Categories</h1>
                <button
                    onClick={() => openEdit()}
                    className="flex items-center gap-2 rounded bg-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-hover"
                >
                    <Plus className="h-4 w-4" /> Add Category
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Slug" sortKey="slug" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Projects #" sortKey="projects_count" sort={sort} onSort={toggleSort} />
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCategories.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">No categories found.</td>
                            </tr>
                        ) : (
                            filteredCategories.map((category) => (
                                <tr key={category.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {category.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {category.slug}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {category.projects_count || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openEdit(category)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(category.id)} className="text-red-600 hover:text-red-900">
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
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold font-sans text-[#10275c]">{currentCategory.id ? "Edit Category" : "New Category"}</h2>
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={currentCategory.name}
                                    onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border sm:text-sm"
                                />
                            </div>
                            <div className="pt-4 border-t flex justify-end gap-3">
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
                                    Save Category
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
