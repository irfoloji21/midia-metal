import { useState } from "react";
import { toast } from "sonner";
import { loginCustomer } from "@/stores/auth";
import { apiFetch } from "@/lib/api";
import type { Customer } from "@/types/customer";

export default function RegisterIsland() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        phone: "",
    });
    const [loading, setLoading] = useState(false);

    const update = (field: string, value: string) => setForm({ ...form, [field]: value });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password !== form.password_confirmation) {
            toast.error("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            const data = await apiFetch<{ customer: Customer }>("/v1/customer/register", {
                method: "POST",
                body: JSON.stringify(form)
            });

            loginCustomer(data.customer);
            toast.success("Account created successfully!");
            window.location.href = "/account";
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-24 pb-20 md:pb-28">
                <div className="max-w-md mx-auto bg-white p-8 border border-[#cad4e4]">
                    <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">Create Account</h2>
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div>
                            <label htmlFor="register-name" className="block text-[13px] font-semibold text-primary mb-2">Full Name *</label>
                            <input
                                id="register-name"
                                name="name"
                                autoComplete="name"
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => update("name", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                            />
                        </div>
                        <div>
                            <label htmlFor="register-email" className="block text-[13px] font-semibold text-primary mb-2">Email address *</label>
                            <input
                                id="register-email"
                                name="email"
                                autoComplete="email"
                                type="email"
                                required
                                value={form.email}
                                onChange={(e) => update("email", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                            />
                        </div>
                        <div>
                            <label htmlFor="register-phone" className="block text-[13px] font-semibold text-primary mb-2">Phone</label>
                            <input
                                id="register-phone"
                                name="phone"
                                autoComplete="tel"
                                type="tel"
                                value={form.phone}
                                onChange={(e) => update("phone", e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="register-password" className="block text-[13px] font-semibold text-primary mb-2">Password *</label>
                                <input
                                    id="register-password"
                                    name="password"
                                    autoComplete="new-password"
                                    type="password"
                                    required
                                    value={form.password}
                                    onChange={(e) => update("password", e.target.value)}
                                    className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                                />
                            </div>
                            <div>
                                <label htmlFor="register-password-confirmation" className="block text-[13px] font-semibold text-primary mb-2">Confirm *</label>
                                <input
                                    id="register-password-confirmation"
                                    name="password_confirmation"
                                    autoComplete="new-password"
                                    type="password"
                                    required
                                    value={form.password_confirmation}
                                    onChange={(e) => update("password_confirmation", e.target.value)}
                                    className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-orange text-white text-[14px] font-semibold hover:bg-orange-hover transition-colors mt-6 disabled:opacity-50"
                        >
                            {loading ? "Registering..." : "Register"}
                        </button>
                        <div className="mt-4 text-center text-sm text-[#6e7a92]">
                            Already have an account? <a href="/login" className="text-orange hover:underline">Log in</a>
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}
