import { useState, useEffect } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useStore } from "@nanostores/react";
import { $customer } from "@/stores/auth";

const SERVICES = [
    "Kitchen Canopy Systems",
    "Extraction / Ventilation Systems",
    "Custom Fabrication",
    "Stainless Steel Catering Equipment",
    "Maintenance & Servicing",
    "Other",
];

const QuoteForm = () => {
    const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", description: "" });
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const customer = useStore($customer);

    const update = (field: string, val: string) => setForm({ ...form, [field]: val });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const productName = params.get("product")?.slice(0, 255);
        if (!productName) return;
        const productId = params.get("product_id")?.slice(0, 30);
        const options = params.get("options")?.slice(0, 1500);
        const description = [
            `I'd like a quote for ${productName}${productId ? ` (SKU: ${productId})` : ""}.`,
            options ? `Selected options: ${options}` : "",
            "", "My requirements: ",
        ].filter((line, index) => line || index > 1).join("\n");
        setForm((prev) => ({ ...prev, description: prev.description || description }));
    }, []);

    useEffect(() => {
        if (!customer) return;

        setForm((prev) => ({
            ...prev,
            name: prev.name || customer.name || "",
            email: prev.email || customer.email || "",
            phone: prev.phone || customer.phone || "",
        }));
    }, [customer]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const chosen = Array.from(e.target.files || []);
        const allowed = chosen.filter(f => f.size <= 10 * 1024 * 1024);
        if (allowed.length !== chosen.length) toast.error("Some files exceed the 10MB limit and were skipped.");
        setFiles(prev => [...prev, ...allowed]);
    };

    const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.description) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setSubmitting(true);

        try {
            const fd = new FormData();
            fd.append("name", form.name);
            fd.append("email", form.email);
            fd.append("phone", form.phone);
            fd.append("service", form.service);
            fd.append("description", form.description);
            files.forEach((file) => fd.append("files[]", file));

            await apiFetch("/v1/quote", {
                method: "POST",
                body: fd,
            });

            setDone(true);
            setFiles([]);
            toast.success("Quote request submitted! We'll be in touch soon.");
        } catch (error: any) {
            toast.error(error.message || "Submission failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {done ? (
                <div className="bg-white border border-[#cad4e4] p-12 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="font-sans text-[28px] font-semibold text-primary mb-3">Request Submitted!</h2>
                    <p className="text-[#6e7a92]">Thank you, <strong>{form.name}</strong>. We've received your enquiry and will contact you at <strong>{form.email}</strong> within 1–2 business days.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white border border-[#cad4e4] p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[13px] font-semibold text-primary mb-2">Your Name *</label>
                            <input required value={form.name} onChange={e => update("name", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-sm outline-none focus:border-orange" placeholder="John Smith" />
                        </div>
                        <div>
                            <label className="block text-[13px] font-semibold text-primary mb-2">Email Address *</label>
                            <input required type="email" value={form.email} onChange={e => update("email", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-sm outline-none focus:border-orange" placeholder="john@example.com" />
                        </div>
                        <div>
                            <label className="block text-[13px] font-semibold text-primary mb-2">Phone Number</label>
                            <input value={form.phone} onChange={e => update("phone", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-sm outline-none focus:border-orange" placeholder="+44 7700 900000" />
                        </div>
                        <div>
                            <label className="block text-[13px] font-semibold text-primary mb-2">Service Required</label>
                            <select value={form.service} onChange={e => update("service", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-sm outline-none focus:border-orange">
                                <option value="">Select a service...</option>
                                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[13px] font-semibold text-primary mb-2">Project Description *</label>
                        <textarea required value={form.description} onChange={e => update("description", e.target.value)}
                            rows={6} className="w-full border border-[#cad4e4] bg-[#eaf0f3] px-4 py-3 text-sm outline-none focus:border-orange resize-none"
                            placeholder="Describe your project, dimensions, materials, and any specific requirements..." />
                    </div>

                    <div>
                        <label className="block text-[13px] font-semibold text-primary mb-2">Reference Files (optional)</label>
                        <div className="border-2 border-dashed border-[#cad4e4] p-6 text-center bg-[#f8f9fb] hover:border-orange/60 transition-colors">
                            <Upload className="w-8 h-8 mx-auto text-[#8f9ab1] mb-3" />
                            <p className="text-sm text-[#6e7a92]">Upload images, PDFs, or drawings (max 10MB each)</p>
                            <label className="mt-3 inline-block cursor-pointer px-4 py-2 border border-[#cad4e4] bg-white text-sm text-primary hover:bg-gray-50">
                                Choose Files
                                <input type="file" className="hidden" multiple accept="image/*,.pdf,.dwg,.dxf" onChange={handleFileChange} />
                            </label>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between bg-[#f0f3f7] px-3 py-2 border border-[#cad4e4]">
                                        <span className="text-sm text-primary truncate">{f.name}</span>
                                        <button type="button" onClick={() => removeFile(i)} className="text-[#8f9ab1] hover:text-destructive ml-2"><X className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button type="submit" disabled={submitting}
                        className="w-full h-14 bg-orange text-white font-semibold text-sm hover:bg-orange-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {submitting ? "Submitting..." : "Submit Quote Request"}
                    </button>
                </form>
            )}
        </>
    );
};

export default QuoteForm;
