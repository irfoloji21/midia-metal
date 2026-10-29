import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [emailEditable, setEmailEditable] = useState(false);
    const [passwordEditable, setPasswordEditable] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || !emailEditable || !passwordEditable || !email.trim() || !password) return;
        setLoading(true);
        try {
            await apiFetch("/admin/login", {
                method: "POST",
                body: JSON.stringify({ email: email.trim(), password }),
            });
            toast.success("Welcome back, Admin!");
            navigate("/admin");
        } catch (error: any) {
            toast.error(error.message || "Invalid credentials. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-[#10275c] font-sans">Midia Admin</h1>
                    <p className="mt-2 text-sm text-[#6f7e9a]">Sign in to access your dashboard</p>
                </div>

                <form onSubmit={handleLogin} autoComplete="off" className="space-y-6">
                    <div>
                        <label htmlFor="admin-login-email" className="block text-sm font-medium text-[#10275c]">Email Address</label>
                        <div className="relative mt-2 rounded-md shadow-sm">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="admin-login-email"
                                name="email"
                                type="email"
                                required
                                // Keep saved credentials from filling the form before the user enters a field.
                                readOnly={!emailEditable}
                                onPointerDown={() => setEmailEditable(true)}
                                onFocus={() => setEmailEditable(true)}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-md border-0 py-2.5 pl-10 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#22a3e6] sm:text-sm sm:leading-6"
                                placeholder="Enter your email address"
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="admin-login-password" className="block text-sm font-medium text-[#10275c]">Password</label>
                        <div className="relative mt-2 rounded-md shadow-sm">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="admin-login-password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                readOnly={!passwordEditable}
                                onPointerDown={() => setPasswordEditable(true)}
                                onFocus={() => setPasswordEditable(true)}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-md border-0 py-2.5 pl-10 pr-10 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-[#22a3e6] sm:text-sm sm:leading-6"
                                placeholder="Enter your password"
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute inset-y-0 right-0 flex items-center pr-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5 text-gray-400" />
                                ) : (
                                    <Eye className="h-5 w-5 text-gray-400" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !emailEditable || !passwordEditable || !email.trim() || !password}
                        className="flex w-full justify-center rounded-md bg-[#eb5c10] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#d4500b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eb5c10] disabled:opacity-50"
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}
