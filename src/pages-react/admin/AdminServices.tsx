import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import SectionTemplateEditor from "@/components/admin/SectionTemplateEditor";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";
import { usePaginatedAdminList } from "@/hooks/use-paginated-admin-list";
import ListPagination from "@/components/admin/ListPagination";

export default function AdminServices() {

    const [isEditing, setIsEditing] = useState(false);
    const [currentService, setCurrentService] = useState<any>(null);
    const [featuresDraft, setFeaturesDraft] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const params = new URLSearchParams({ search: searchTerm.trim() });
    const { items: services, setItems: _setServices, ...pagination } = usePaginatedAdminList(`/admin/services?${params}`);
    const { reload: loadServices, setPage } = pagination;
    const { sort, toggleSort } = useTableSort("title");

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this service?")) return;
        try {
            await apiFetch(`/admin/services/${id}`, { method: "DELETE" });
            toast.success("Service deleted successfully");
            loadServices();
        } catch (e) {
            toast.error("Failed to delete service");
        }
    };

    const openEdit = (service: any = null) => {
        setFeaturesDraft((service?.features || []).join(", "));
        setCurrentService(
            service || {
                title: "",
                image: "",
                icon: "",
                excerpt: "",
                content: "",
                features: [],
                active: true,
            }
        );
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...currentService, features: featuresDraft.split(",").map(feature => feature.trim()).filter(Boolean) };
        try {
            if (currentService.id) {
                await apiFetch(`/admin/services/${currentService.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                toast.success("Service updated");
            } else {
                await apiFetch("/admin/services", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                toast.success("Service created");
            }
            setIsEditing(false);
            loadServices();
        } catch (err: any) {
            toast.error(err.message || "Failed to save service");
        }
    };

    const filteredServices = sortRows(
        services,
        sort.key,
        sort.direction,
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Services</h1>
                <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { openEdit(); setCurrentService((service: any) => ({ ...service, active: false })); }} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#10275c] hover:border-orange">Create from template</button>
                <button
                    onClick={() => openEdit()}
                    className="flex items-center gap-2 rounded bg-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-hover"
                >
                    <Plus className="h-4 w-4" /> Add Service
                </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Service" sortKey="title" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Status" sortKey="active" sort={sort} onSort={toggleSort} />
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredServices.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">No services found.</td>
                            </tr>
                        ) : (
                            filteredServices.map((service) => (
                                <tr key={service.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0">
                                                {service.image ? <img className="h-10 w-10 rounded object-cover" src={service.image} alt="" /> : <div className="h-10 w-10 bg-gray-200 rounded"></div>}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{service.title}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${service.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {service.active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button aria-label={`Edit ${service.title}`} onClick={() => openEdit(service)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button aria-label={`Delete ${service.title}`} onClick={() => handleDelete(service.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ListPagination label="Services" {...pagination} />

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mt-20 md:mt-0 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold font-sans text-[#10275c]">{currentService.id ? "Edit Service" : "New Service"}</h2>
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
                                        value={currentService.title}
                                        onChange={(e) => setCurrentService({ ...currentService, title: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <ImageUpload
                                        label="Service Image"
                                        value={currentService.image}
                                        onChange={(url) => setCurrentService({ ...currentService, image: url })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Excerpt</label>
                                    <textarea
                                        rows={2}
                                        value={currentService.excerpt || ""}
                                        onChange={(e) => setCurrentService({ ...currentService, excerpt: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <SectionTemplateEditor
                                        templateKind="service"
                                        label="Content"
                                        serviceLayout
                                        value={currentService.content || ""}
                                        onChange={(value) => setCurrentService((service: any) => ({ ...service, content: value }))}
                                        helperText="Edit text directly. Add image + text creates a section; click inside it to swap sides. Select a photo to replace it or edit its description. Sections stack automatically on mobile."
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label htmlFor="service-features" className="block text-sm font-medium text-gray-700">Features (Comma separated)</label>
                                    <input
                                        id="service-features"
                                        type="text"
                                        value={featuresDraft}
                                        onChange={(e) => setFeaturesDraft(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                        placeholder="Feature 1, Feature 2, Feature 3"
                                    />
                                </div>
                                <label className="col-span-2 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={currentService.active}
                                        onChange={(e) => setCurrentService({ ...currentService, active: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-600">Active</span>
                                </label>
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
                                    Save Service
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
