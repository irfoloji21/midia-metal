import { useState } from "react";
import { toast } from "sonner";
import { loginCustomer } from "@/stores/auth";
import { apiFetch } from "@/lib/api";
import type { Customer } from "@/types/customer";

export default function LoginIsland() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await apiFetch<{ customer: Customer }>("/v1/customer/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            loginCustomer(data.customer);
            toast.success("Logged in successfully!");
            window.location.href = "/account";
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <section className="container mx-auto px-4 lg:px-8 pt-16 md:pt-24 pb-20 md:pb-28">
                <div className="max-w-md mx-auto bg-white p-8 border border-[#cad4e4]">
                    <h2 className="font-sans text-[32px] md:text-[42px] leading-none font-semibold text-primary mb-7">Login</h2>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label htmlFor="login-email" className="block text-[13px] font-semibold text-primary mb-2">Email address *</label>
                            <input
                                id="login-email"
                                name="email"
                                autoComplete="username"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="login-password" className="block text-[13px] font-semibold text-primary">Password *</label>
                                <a href="/forgot-password" className="text-[13px] text-orange hover:underline font-medium">Forgot password?</a>
                            </div>
                            <input
                                id="login-password"
                                name="password"
                                autoComplete="current-password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 border border-[#cad4e4] bg-[#eaf0f3] px-4 text-[14px] outline-none focus:border-orange"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-orange text-white text-[14px] font-semibold hover:bg-orange-hover transition-colors disabled:opacity-50"
                        >
                            {loading ? "Logging in..." : "Log in"}
                        </button>
                        <div className="mt-4 text-center text-sm text-[#6e7a92]">
                            Don't have an account? <a href="/register" className="text-orange hover:underline">Register</a>
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}
