import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";
import { usePaginatedAdminList } from "@/hooks/use-paginated-admin-list";
import ListPagination from "@/components/admin/ListPagination";

export default function AdminPortfolio() {
    const [categories, setCategories] = useState<any[]>([]);

    const [isEditing, setIsEditing] = useState(false);
    const [currentProject, setCurrentProject] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const params = new URLSearchParams({ search: searchTerm.trim() });
    if (categoryFilter !== "all") params.set("category_id", categoryFilter);
    const { items: projects, setItems: _setProjects, ...pagination } = usePaginatedAdminList(`/admin/portfolio?${params}`);
    const { reload: loadProjects, setPage } = pagination;
    const { sort, toggleSort } = useTableSort("title");

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const res = await apiFetch<any[]>("/admin/portfolio-categories");
            setCategories(res);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this project?")) return;
        try {
            await apiFetch(`/admin/portfolio/${id}`, { method: "DELETE" });
            toast.success("Project deleted");
            loadProjects();
        } catch (e) {
            toast.error("Failed to delete project");
        }
    };

    const openEdit = (project: any = null) => {
        setCurrentProject(
            project || {
                title: "",
                image: "",
                description: "",
                location: "",
                client: "",
                customer_number: "",
                year: "",
                portfolio_category_id: "",
                services_list: [],
                gallery: [],
                active: true,
                order: 0,
            }
        );
        if (project) {
            setCurrentProject({
                ...project,
                gallery: project.gallery || [],
                services_list: project.services_list || [],
            });
        }
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dataToSave = {
                ...currentProject,
                portfolio_category_id: currentProject.portfolio_category_id || null,
            };
            if (currentProject.id) {
                await apiFetch(`/admin/portfolio/${currentProject.id}`, {
                    method: "PUT",
                    body: JSON.stringify(dataToSave),
                });
                toast.success("Project updated");
            } else {
                await apiFetch("/admin/portfolio", {
                    method: "POST",
                    body: JSON.stringify(dataToSave),
                });
                toast.success("Project created");
            }
            setIsEditing(false);
            loadProjects();
        } catch (err: any) {
            toast.error(err.message || "Failed to save project");
        }
    };

    const handleAddGalleryImage = (url: string) => {
        setCurrentProject((prev: any) => ({
            ...prev,
            gallery: [...(prev.gallery || []), url]
        }));
    };

    const handleRemoveGalleryImage = (index: number) => {
        setCurrentProject((prev: any) => ({
            ...prev,
            gallery: (prev.gallery || []).filter((_: any, i: number) => i !== index)
        }));
    };

    const filteredProjects = sortRows(projects, sort.key, sort.direction);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Portfolio Projects</h1>
                <button
                    onClick={() => openEdit()}
                    className="flex items-center gap-2 rounded bg-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-hover"
                >
                    <Plus className="h-4 w-4" /> Add Project
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                        className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white flex-1 sm:flex-none"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id.toString()}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Project" sortKey="title" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Customer No." sortKey="customer_number" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Category" sortKey="portfolio_category.name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Status" sortKey="active" sort={sort} onSort={toggleSort} />
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProjects.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">No projects found.</td>
                            </tr>
                        ) : (
                            filteredProjects.map((project) => (
                                <tr key={project.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0">
                                                {project.image ? <img className="h-10 w-10 rounded object-cover" src={project.image} alt="" /> : <div className="h-10 w-10 bg-gray-200 rounded"></div>}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{project.title}</div>
                                                <div className="text-xs text-gray-500">{project.client}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {project.customer_number || "N/A"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {project.portfolio_category?.name || "N/A"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${project.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {project.active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openEdit(project)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(project.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ListPagination label="Portfolio" {...pagination} />

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mt-20 md:mt-0 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold font-sans text-[#10275c]">{currentProject.id ? "Edit Project" : "New Project"}</h2>
                            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentProject.title}
                                        onChange={(e) => setCurrentProject({ ...currentProject, title: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Category</label>
                                    <select
                                        value={currentProject.portfolio_category_id || ""}
                                        onChange={(e) => setCurrentProject({ ...currentProject, portfolio_category_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white"
                                    >
                                        <option value="">Select a category</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Client</label>
                                    <input
                                        type="text"
                                        value={currentProject.client || ""}
                                        onChange={(e) => setCurrentProject({ ...currentProject, client: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Client Phone</label>
                                    <input
                                        type="tel"
                                        value={currentProject.customer_number || ""}
                                        onChange={(e) => setCurrentProject({ ...currentProject, customer_number: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Location</label>
                                    <input
                                        type="text"
                                        value={currentProject.location || ""}
                                        onChange={(e) => setCurrentProject({ ...currentProject, location: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Year</label>
                                    <input
                                        type="text"
                                        value={currentProject.year || ""}
                                        onChange={(e) => setCurrentProject({ ...currentProject, year: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <ImageUpload
                                        label="Main Project Image"
                                        value={currentProject.image}
                                        onChange={(url) => setCurrentProject({ ...currentProject, image: url })}
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <label className="block text-sm font-semibold text-[#10275c]">Gallery Images</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {(currentProject.gallery || []).map((imgUrl: string, idx: number) => (
                                            <div key={idx} className="relative group aspect-square border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                                                <img src={imgUrl} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveGalleryImage(idx)}
                                                    className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {(currentProject.gallery || []).length < 8 && (
                                            <div className="aspect-square">
                                                <ImageUpload
                                                    hidePreview={true}
                                                    value=""
                                                    onChange={handleAddGalleryImage}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-2 font-medium">Add up to 8 additional images for the project gallery.</p>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        rows={4}
                                        value={currentProject.description || ""}
                                        onChange={(e) => setCurrentProject({ ...currentProject, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-2 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={currentProject.active}
                                        onChange={(e) => setCurrentProject({ ...currentProject, active: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-600">Active</span>
                                </div>
                            </div>
                            <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] pb-4">
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
                                    Save Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
