import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Package,
    FileText,
    Image,
    Briefcase,
    LogOut,
    Menu,
    Settings,
    Mail,
    ShoppingCart,
    MessageSquare,
    Tag,
    Users,
    Star,
    HelpCircle,
    Loader2,
    X
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { useModalFocus } from "@/hooks/use-modal-focus";

const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Products", href: "/admin/products", icon: Package },
    { name: "Product Categories", href: "/admin/product-categories", icon: FileText },
    { name: "Services", href: "/admin/services", icon: Briefcase },
    { name: "Portfolio", href: "/admin/portfolio", icon: Image },
    { name: "Portfolio Categories", href: "/admin/portfolio-categories", icon: FileText },
    { name: "Blog", href: "/admin/blog", icon: FileText },
    { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
    { name: "Quotes", href: "/admin/quotes", icon: MessageSquare },
    { name: "Coupons", href: "/admin/coupons", icon: Tag },
    { name: "Messages", href: "/admin/messages", icon: Mail },
    { name: "Product Reviews", href: "/admin/product-reviews", icon: Star },
    { name: "Customers", href: "/admin/customers", icon: Users },
    { name: "FAQs", href: "/admin/faq", icon: HelpCircle },
    { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [authError, setAuthError] = useState(false);
    const [authAttempt, setAuthAttempt] = useState(0);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;
    useModalFocus(sidebarOpen, sidebarRef, () => setSidebarOpen(false));

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 1024px)");
        const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
        desktop.addEventListener("change", closeOnDesktop);
        return () => desktop.removeEventListener("change", closeOnDesktop);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setAuthError(false);

        const verifyAdminSession = async () => {
            try {
                await apiFetch("/admin/me", { signal: controller.signal });
                if (!cancelled) setAuthChecked(true);
            } catch (error) {
                if (cancelled) return;
                if (error instanceof ApiError && error.status === 401) {
                    navigateRef.current("/admin/login", { replace: true });
                } else {
                    setAuthError(true);
                }
            }
        };

        void verifyAdminSession();
        return () => { cancelled = true; controller.abort(); };
    }, [authAttempt]);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        setLogoutError(false);
        try {
            await apiFetch("/admin/logout", { method: "POST" });
            navigate("/admin/login", { replace: true });
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                navigate("/admin/login", { replace: true });
            } else {
                setLogoutError(true);
            }
        } finally {
            setLoggingOut(false);
        }
    };

    if (!authChecked) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7]">
                {authError ? (
                    <div role="alert" className="max-w-md space-y-4 p-6 text-center">
                        <h1 className="text-xl font-semibold text-[#10275c]">Unable to check your session</h1>
                        <p className="text-gray-600">The server could not be reached. Please try again.</p>
                        <button type="button" onClick={() => setAuthAttempt(attempt => attempt + 1)} className="rounded-md bg-[#10275c] px-4 py-2 text-white">Try again</button>
                    </div>
                ) : (
                    <div role="status" className="flex items-center gap-3 text-gray-600">
                        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-[#22a3e6]" />
                        Checking your session...
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex bg-[#f4f5f7] min-h-screen">
            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                id="admin-sidebar"
                role={sidebarOpen ? "dialog" : undefined}
                aria-modal={sidebarOpen || undefined}
                aria-labelledby="admin-sidebar-title"
                className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col bg-[#10275c] text-white transition-transform duration-300 ${sidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible lg:translate-x-0"
                    }`}
            >
                <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 font-bold text-xl border-b border-white/10">
                    <span id="admin-sidebar-title">Midia Admin</span>
                    <button type="button" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} className="rounded p-1 hover:bg-white/10 lg:hidden"><X aria-hidden="true" className="h-5 w-5" /></button>
                </div>
                <nav aria-label="Admin navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
                    <ul className="space-y-1">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href || (location.pathname.startsWith(item.href) && item.href !== "/admin");
                            return (
                                <li key={item.name}>
                                    <Link
                                        to={item.href}
                                        aria-current={isActive ? "page" : undefined}
                                        onClick={() => setSidebarOpen(false)}
                                        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                                            }`}
                                    >
                                        <item.icon className={`h-5 w-5 ${isActive ? "text-[#22a3e6]" : "text-white/50 group-hover:text-white/70"}`} />
                                        {item.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
                <div className="shrink-0 p-4 border-t border-white/10 bg-[#10275c]">
                    {logoutError && <p role="alert" className="mb-2 text-sm text-red-200">Could not log out. Please try again.</p>}
                    <button
                        type="button"
                        disabled={loggingOut}
                        onClick={handleLogout}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <LogOut className="h-5 w-5 text-white/50 group-hover:text-white/70" />
                        {loggingOut ? "Logging out..." : "Logout"}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div aria-hidden={sidebarOpen || undefined} className="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
                <header className="flex h-16 items-center border-b border-[#e1e5eb] bg-white px-4 md:px-6">
                    <button
                        type="button"
                        aria-label="Open navigation menu"
                        aria-controls="admin-sidebar"
                        aria-expanded={sidebarOpen}
                        className="text-[#6b7280] focus:outline-none lg:hidden"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <div className="ml-4 lg:ml-0 flex-1 flex justify-end">
                        <span className="text-sm font-medium text-[#4b5563]">Admin Panel</span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 md:p-8">
                    <Outlet />
                </main>
            </div>

            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}
        </div>
    );
}
