export const API_URL = import.meta.env.PUBLIC_API_URL || "/api";

export class ApiError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
        this.name = "ApiError";
    }
}

const isLocalApiUrl = (value: string) => value.startsWith("http://127.0.0.1:") || value.startsWith("http://localhost:");

const getResolvedApiUrl = () => {
    if (typeof window === "undefined") {
        return API_URL;
    }

    if (isLocalApiUrl(API_URL)) {
        return "/api";
    }

    return API_URL;
};

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
let csrfBootstrapPromise: Promise<void> | null = null;

// One-time cleanup: remove legacy localStorage tokens from pre-Sanctum auth.
// Sanctum uses httpOnly cookies — no tokens needed.
(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("admin_token");
    localStorage.removeItem("customer_token");
})();

const getApiOrigin = () => {
    if (typeof window === "undefined") {
        return "";
    }

    if (isLocalApiUrl(API_URL)) {
        return window.location.origin;
    }

    if (API_URL.startsWith("http://") || API_URL.startsWith("https://")) {
        try {
            return new URL(API_URL).origin;
        } catch {
            return window.location.origin;
        }
    }

    return window.location.origin;
};

const getCookie = (name: string) => {
    if (typeof document === "undefined") {
        return null;
    }

    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
};

const isMutatingMethod = (method?: string) => {
    const normalized = (method || "GET").toUpperCase();
    return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(normalized);
};

const ensureCsrfCookie = async () => {
    if (typeof window === "undefined") {
        return;
    }

    // If a fetch is already in flight, wait for it rather than firing a second one
    if (csrfBootstrapPromise) {
        return csrfBootstrapPromise;
    }

    const apiOrigin = getApiOrigin();
    csrfBootstrapPromise = fetch(`${apiOrigin}/sanctum/csrf-cookie`, {
        credentials: "include",
        headers: {
            Accept: "application/json",
        },
    })
        .then(() => undefined)
        .finally(() => {
            csrfBootstrapPromise = null;
        });

    return csrfBootstrapPromise;
};

export const apiFetch = async <T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const method = (options.method || "GET").toUpperCase();
    const shouldSendCsrf = isMutatingMethod(method);

    if (shouldSendCsrf) {
        await ensureCsrfCookie();
    }

    const xsrfToken = shouldSendCsrf ? getCookie(CSRF_COOKIE_NAME) : null;
    const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
        ...(options.headers as Record<string, string>),
    };

    // If body is NOT FormData, default to application/json
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const resolvedApiUrl = getResolvedApiUrl();

    let response = await fetch(`${resolvedApiUrl}${endpoint}`, {
        ...options,
        method,
        credentials: "include",
        headers,
    });

    if (response.status === 419 && shouldSendCsrf) {
        await ensureCsrfCookie();
        const retryXsrfToken = getCookie(CSRF_COOKIE_NAME);
        response = await fetch(`${resolvedApiUrl}${endpoint}`, {
            ...options,
            method,
            credentials: "include",
            headers: {
                ...headers,
                ...(retryXsrfToken ? { "X-XSRF-TOKEN": retryXsrfToken } : {}),
            },
        });
    }

    if (!response.ok) {
        if (response.status === 401 && endpoint.startsWith("/admin")) {
            if (!window.location.pathname.startsWith("/admin/login")) {
                window.location.href = "/admin/login";
            }
        }
        
        if (response.status === 429) {
            import("sonner").then(({ toast }) => {
                toast.error("Too many requests. Please wait a moment and try again.");
            });
            throw new ApiError("Too many requests. Please wait a moment and try again.", response.status);
        }

        const errorData = await response.json().catch(() => ({ message: "An error occurred" }));
        
        if (response.status === 422 && errorData.errors) {
            const firstErrorList = Object.values(errorData.errors)[0] as string[];
            if (firstErrorList && firstErrorList.length > 0) {
                throw new ApiError(firstErrorList[0], response.status);
            }
        }
        
        throw new ApiError(errorData.message || "An error occurred", response.status);
    }

    return response.json() as Promise<T>;
};
