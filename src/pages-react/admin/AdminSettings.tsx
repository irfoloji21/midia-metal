import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import RichTextEditor from "@/components/admin/RichTextEditor";
import type { SiteSetting, HeroSlide, SettingsSection } from "@/types/settings";

type SettingRecord = SiteSetting;
type HeroSlideRecord = HeroSlide;

const GROUP_ORDER = ["header", "footer", "general", "shipping-tax", "shipping-freight", "payment", "home", "about", "contact", "services", "portfolio", "blog", "legal", "seo", "hero-slides"];

interface BankTransferAccount {
    id: string;
    bank_name: string;
    account_name: string;
    sort_code: string;
    account_number: string;
    iban: string;
    bic_swift: string;
}

const parseBankTransferAccounts = (value?: string): BankTransferAccount[] => {
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const HOME_SECTIONS: SettingsSection[] = [
    {
        id: "hero-copy",
        title: "Homepage Introduction",
        description: "The main heading, introduction and contact button labels above the slider. Phone and WhatsApp use the contact phone setting.",
        keys: [
            "home_hero_title",
            "home_hero_desc",
            "home_hero_phone_label",
            "home_hero_whatsapp_label",
            "home_hero_quote_label",
        ],
    },
    {
        id: "features",
        title: "Features Bar",
        description: "The four icon highlights under the hero slider.",
        keys: [
            "home_reward_title",
            "home_reward_desc",
            "home_discount_title",
            "home_discount_desc",
            "home_shipping_title",
            "home_shipping_desc",
            "home_prices_title",
            "home_prices_desc",
        ],
    },
    {
        id: "fabrication",
        title: "Fabrication Section",
        description: "The metal welding and bespoke fabrication block before categories.",
        keys: [
            "home_fabrication_section_label",
            "home_fabrication_section_title",
            "home_welding_label",
            "home_welding_title",
            "home_welding_desc",
            "home_welding_primary_cta",
            "home_welding_secondary_cta",
            "home_welding_service_slug",
            "home_welding_image",
            "home_welding_image_alt",
            "home_welding_secondary_image",
            "home_welding_secondary_image_alt",
            "home_welding_card_label",
            "home_welding_card_title",
            "home_welding_card_desc",
        ],
    },
    {
        id: "categories",
        title: "Product Categories",
        description: "The heading above the product category images.",
        keys: [
            "home_categories_section_label",
            "home_categories_section_title",
        ],
    },
    {
        id: "catalog",
        title: "Catalog",
        description: "The heading above the product grid and the ‘View More Products’ button label.",
        keys: [
            "home_catalog_label",
            "home_trending_title",
            "home_view_more_label",
        ],
    },
    {
        id: "cta",
        title: "CTA Banners",
        description: "The two large blocks below the product grid.",
        keys: [
            "home_installation_title",
            "home_installation_desc",
            "home_request_quote_label",
            "home_comfort_title",
            "home_comfort_desc",
            "home_comfort_image",
            "home_learn_more_label",
        ],
    },
];

const SHIPPING_TAX_KEYS = new Set([
    "shipping_rate",
    "shipping_flat_rate",
    "shipping_type",
    "vat_enabled",
    "vat_rate",
    "tax_enabled",
    "tax_rate",
]);

const SHIPPING_FREIGHT_KEYS = new Set([
    "freight_surcharge_highlands",
    "freight_surcharge_ni",
    "freight_surcharge_scotland",
    "freight_surcharge_london",
    "freight_surcharge_default",
]);

const FREIGHT_SURCHARGE_LABELS: Record<string, string> = {
    freight_surcharge_highlands: "Highlands & Remote Scotland (AB, HS, IV, KW, PA, PH, ZE, IM)",
    freight_surcharge_ni: "Northern Ireland (BT)",
    freight_surcharge_scotland: "Lowland Scotland (DD, DG, EH, FK, G, KA, KY, ML, TD)",
    freight_surcharge_london: "London (E, EC, N, NW, SE, SW, W, WC)",
    freight_surcharge_default: "Mainland England & Wales (default)",
};

const LEGACY_DUPLICATE_KEYS: Record<string, string> = {
    shipping_flat_rate: "shipping_rate",
    tax_enabled: "vat_enabled",
    tax_rate: "vat_rate",
};

const HIDDEN_SETTING_KEYS = new Set([
    "shipping_rate",
    "shipping_flat_rate",
    "shipping_type",
    "home_brand_1",
    "home_brand_2",
    "home_brand_3",
    "home_brand_4",
    "home_brands_title",
    "home_gallery_1",
    "home_gallery_2",
    "home_gallery_3",
    "home_gallery_4",
    "home_gallery_5",
    "home_gallery_6",
]);

const LABEL_OVERRIDES: Record<string, string> = {
    about_exp_value: "Highlight 1 Heading",
    about_exp_label: "Highlight 1 Description",
    about_proj_value: "Highlight 2 Heading",
    about_proj_label: "Highlight 2 Description",
    about_satisfaction_value: "Highlight 3 Heading",
    about_satisfaction_label: "Highlight 3 Description",
    about_support_value: "Highlight 4 Heading",
    about_support_label: "Highlight 4 Description",
    social_tiktok: "TikTok URL",
    social_dribbble: "TikTok URL",
    home_reward_title: "1.title",
    home_reward_desc: "1.description",
    home_discount_title: "2.title",
    home_discount_desc: "2.description",
    home_shipping_title: "3.title",
    home_shipping_desc: "3.description",
    home_prices_title: "4.title",
    home_prices_desc: "4.description",
};

const buildSections = (settings: SettingRecord[], sections: SettingsSection[]) => {
    const byKey = new Map(settings.map((setting) => [setting.key, setting]));
    const used = new Set<string>();

    const resolvedSections = sections
        .map((section) => {
            const sectionSettings = section.keys
                .map((key) => byKey.get(key))
                .filter((setting): setting is SettingRecord => Boolean(setting));

            sectionSettings.forEach((setting) => used.add(setting.key));
            return { ...section, settings: sectionSettings };
        })
        .filter((section) => section.settings.length > 0);

    const leftovers = settings
        .filter((setting) => !used.has(setting.key))
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key));

    return { resolvedSections, leftovers };
};

const normalizeSettingsForDisplay = (settings: SettingRecord[]) => {
    const keys = new Set(settings.map((setting) => setting.key));

    return settings
        .filter((setting) => !HIDDEN_SETTING_KEYS.has(setting.key))
        .filter((setting) => {
            const canonicalKey = LEGACY_DUPLICATE_KEYS[setting.key];
            return !(canonicalKey && keys.has(canonicalKey));
        })
        .map((setting) => {
            const nextSetting = { ...setting };

            if (SHIPPING_TAX_KEYS.has(nextSetting.key)) {
                nextSetting.group = "shipping-tax";
            }

            if (SHIPPING_FREIGHT_KEYS.has(nextSetting.key)) {
                nextSetting.group = "shipping-freight";
                nextSetting.type = "number";
            }

            if (nextSetting.key === "vat_enabled" || (nextSetting.key === "tax_enabled" && !keys.has("vat_enabled"))) {
                nextSetting.type = "boolean";
            }

            return nextSetting;
        });
};

export default function AdminSettings() {
    const [settings, setSettings] = useState<SettingRecord[]>([]);
    const [heroSlides, setHeroSlides] = useState<HeroSlideRecord[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankTransferAccount[]>([]);
    const [expandedBankAccountIds, setExpandedBankAccountIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("general");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [settingsRes, slidesRes] = await Promise.all([
                    apiFetch<SiteSetting[]>("/admin/settings"),
                    apiFetch<HeroSlide[]>("/admin/hero-slides"),
                ]);
                setSettings(settingsRes);
                setBankAccounts(parseBankTransferAccounts(
                    settingsRes.find((setting) => setting.key === "bank_transfer_accounts")?.value,
                ));
                setHeroSlides(slidesRes);
            } catch {
                toast.error("Failed to load settings");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const displaySettings = useMemo(() => normalizeSettingsForDisplay(settings), [settings]);

    const tabs = useMemo(() => {
        const seen = new Set(displaySettings.map((setting) => setting.group || "general"));
        seen.delete("faq"); // Explicitly remove faq group
        const dynamicGroups = Array.from(seen);
        const ordered = dynamicGroups.sort((a, b) => {
            const indexA = GROUP_ORDER.indexOf(a);
            const indexB = GROUP_ORDER.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return [...ordered, "hero-slides"];
    }, [displaySettings]);

    useEffect(() => {
        if (!tabs.includes(activeTab)) {
            setActiveTab(tabs[0] ?? "general");
        }
    }, [activeTab, tabs]);

    const filteredSettings = displaySettings.filter((setting) => (setting.group || "general") === activeTab);
    const homeGroups = useMemo(() => buildSections(filteredSettings, HOME_SECTIONS), [filteredSettings]);

    const updateSetting = (key: string, value: string) => {
        setSettings((prev) => prev.map((setting) => (
            setting.key === key ? { ...setting, value } : setting
        )));
    };

    const updateBankAccounts = (nextAccounts: BankTransferAccount[]) => {
        setBankAccounts(nextAccounts);
        setExpandedBankAccountIds((current) => current.filter((id) => nextAccounts.some((account) => account.id === id)));
        updateSetting("bank_transfer_accounts", JSON.stringify(nextAccounts));
    };

    const addBankAccount = () => {
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `bank-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        updateBankAccounts([...bankAccounts, {
            id,
            bank_name: "",
            account_name: "",
            sort_code: "",
            account_number: "",
            iban: "",
            bic_swift: "",
        }]);
        setExpandedBankAccountIds((current) => [...current, id]);
    };

    const toggleBankAccount = (id: string) => {
        setExpandedBankAccountIds((current) => current.includes(id)
            ? current.filter((accountId) => accountId !== id)
            : [...current, id]);
    };

    const updateBankAccount = (id: string, key: keyof Omit<BankTransferAccount, "id">, value: string) => {
        updateBankAccounts(bankAccounts.map((account) => (
            account.id === id ? { ...account, [key]: value } : account
        )));
    };

    const updateSlide = (id: number | string, field: keyof HeroSlideRecord, value: string | number | boolean) => {
        setHeroSlides((prev) => prev.map((slide) => (
            slide.id === id ? { ...slide, [field]: value } : slide
        )));
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const updates = settings.reduce<Record<string, string>>((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});

        try {
            await apiFetch("/admin/settings", {
                method: "PUT",
                body: JSON.stringify({ settings: updates }),
            });
            toast.success("Settings saved successfully");
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleAddSlide = () => {
        setHeroSlides((prev) => [
            ...prev,
            {
                id: `new-${Date.now()}`,
                image: "",
                alt: "",
                order: prev.length + 1,
                active: true,
                isNew: true,
            },
        ]);
    };

    const handleSaveSlide = async (slide: HeroSlideRecord) => {
        if (!slide.image) {
            toast.error("Hero slides need an image.");
            return;
        }

        const payload = {
            image: slide.image,
            alt: slide.alt || "",
            order: Number(slide.order) || 0,
            active: Boolean(slide.active),
        };

        try {
            const response = slide.isNew
                ? await apiFetch<HeroSlide>("/admin/hero-slides", {
                    method: "POST",
                    body: JSON.stringify(payload),
                })
                : await apiFetch<HeroSlide>(`/admin/hero-slides/${slide.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });

            setHeroSlides((prev) => prev.map((item) => (
                item.id === slide.id ? response : item
            )));
            toast.success(slide.isNew ? "Hero slide created" : "Hero slide updated");
        } catch {
            toast.error("Failed to save hero slide");
        }
    };

    const handleDeleteSlide = async (slide: HeroSlideRecord) => {
        if (slide.isNew) {
            setHeroSlides((prev) => prev.filter((item) => item.id !== slide.id));
            return;
        }

        if (!confirm("Delete this hero slide?")) return;

        try {
            await apiFetch(`/admin/hero-slides/${slide.id}`, { method: "DELETE" });
            setHeroSlides((prev) => prev.filter((item) => item.id !== slide.id));
            toast.success("Hero slide deleted");
        } catch {
            toast.error("Failed to delete hero slide");
        }
    };

    if (loading) return <div>Loading...</div>;

    const renderSettingField = (setting: SettingRecord) => (
        <div key={setting.id} className="space-y-2">
            <label className="block text-sm font-bold text-[#10275c] capitalize">
                {FREIGHT_SURCHARGE_LABELS[setting.key]
                    || LABEL_OVERRIDES[setting.key]
                    || setting.key.replace(/_/g, " ").replace(activeTab, "").trim()
                    || setting.key}
            </label>
            {setting.type === "richtext" ? (
                <RichTextEditor
                    label=""
                    value={setting.value || ""}
                    onChange={(value) => updateSetting(setting.key, value)}
                />
            ) : setting.type === "textarea" ? (
                <textarea
                    rows={6}
                    value={setting.value || ""}
                    onChange={(e) => updateSetting(setting.key, e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#eb5c10] focus:ring-[#eb5c10] sm:text-sm p-3 border"
                />
            ) : setting.type === "image" ? (
                <ImageUpload
                    value={setting.value}
                    onChange={(url) => updateSetting(setting.key, url)}
                />
            ) : setting.type === "boolean" ? (
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={["1", "true", "yes", "on"].includes(String(setting.value).toLowerCase())}
                        onChange={(e) => updateSetting(setting.key, e.target.checked ? "1" : "0")}
                        className="w-5 h-5 rounded border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10] cursor-pointer"
                        id={`setting-${setting.key}`}
                    />
                    <label htmlFor={`setting-${setting.key}`} className="text-sm text-gray-600 cursor-pointer">
                        Enabled
                    </label>
                </div>
            ) : setting.type === "number" ? (
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500">£</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={setting.value || "0"}
                        onChange={(e) => updateSetting(setting.key, e.target.value)}
                        className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-[#eb5c10] focus:ring-[#eb5c10] sm:text-sm p-3 border"
                    />
                </div>
            ) : (
                <input
                    type={setting.type === "url" ? "url" : "text"}
                    value={setting.value || ""}
                    onChange={(e) => updateSetting(setting.key, e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#eb5c10] focus:ring-[#eb5c10] sm:text-sm p-3 border"
                />
            )}
        </div>
    );

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Site Management</h1>
                {activeTab === "payment" && (
                    <button
                        type="button"
                        onClick={addBankAccount}
                        className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-hover"
                    >
                        <Plus className="h-4 w-4" /> Add Bank Account
                    </button>
                )}
                {activeTab === "hero-slides" && (
                    <button
                        type="button"
                        onClick={handleAddSlide}
                        className="inline-flex items-center gap-2 rounded-md bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-hover"
                    >
                        <Plus className="h-4 w-4" />
                        Add Hero Slide
                    </button>
                )}
            </div>

            <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-4 px-2 text-sm font-semibold capitalize transition-colors relative whitespace-nowrap ${activeTab === tab ? "text-[#eb5c10]" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        {tab.replace(/-/g, " ")}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange" />
                        )}
                    </button>
                ))}
            </div>

            {activeTab === "hero-slides" ? (
                <div className="space-y-4">
                    {heroSlides.length === 0 ? (
                        <div className="rounded-lg bg-white shadow p-8 text-sm text-gray-500">No hero slides yet.</div>
                    ) : (
                        heroSlides
                            .slice()
                            .sort((a, b) => Number(a.order) - Number(b.order))
                            .map((slide) => (
                                <div key={slide.id} className="rounded-lg bg-white shadow p-6 space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-semibold text-[#10275c]">Hero Slide</h2>
                                            <p className="text-sm text-gray-500">Manage homepage slider content and ordering.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSlide(slide)}
                                            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </button>
                                    </div>

                                    <ImageUpload
                                        label="Slide Image"
                                        value={slide.image}
                                        onChange={(url) => updateSlide(slide.id, "image", url)}
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-[#10275c] mb-2">Alt Text</label>
                                            <input
                                                type="text"
                                                value={slide.alt || ""}
                                                onChange={(e) => updateSlide(slide.id, "alt", e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#eb5c10] focus:ring-[#eb5c10] sm:text-sm p-3 border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-[#10275c] mb-2">Order</label>
                                            <input
                                                type="number"
                                                value={slide.order}
                                                onChange={(e) => updateSlide(slide.id, "order", Number(e.target.value))}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#eb5c10] focus:ring-[#eb5c10] sm:text-sm p-3 border"
                                            />
                                        </div>
                                    </div>

                                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#10275c]">
                                        <input
                                            type="checkbox"
                                            checked={slide.active}
                                            onChange={(e) => updateSlide(slide.id, "active", e.target.checked)}
                                            className="accent-[#eb5c10]"
                                        />
                                        Active
                                    </label>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => handleSaveSlide(slide)}
                                            className="rounded-md bg-orange px-6 py-3 text-sm font-bold text-white hover:bg-orange-hover"
                                        >
                                            {slide.isNew ? "Create Slide" : "Save Slide"}
                                        </button>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            ) : (
                <div className="rounded-lg bg-white shadow p-8">
                    <form onSubmit={handleSaveSettings} className="space-y-8">
                        <div className="grid grid-cols-1 gap-8">
                            {activeTab === "payment" ? (
                                bankAccounts.length === 0 ? (
                                    <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                                        No bank accounts yet. Add an account, enter its details, then save the settings.
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <p className="text-sm text-gray-600">
                                            Add as many transfer accounts as needed. Customers will be able to choose one during checkout.
                                        </p>
                                        {bankAccounts.map((account, index) => (
                                            <section key={account.id} className="rounded-lg border border-gray-200 bg-[#f8fafc] p-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <button
                                                        type="button"
                                                        aria-expanded={expandedBankAccountIds.includes(account.id)}
                                                        aria-controls={`bank-account-fields-${account.id}`}
                                                        onClick={() => toggleBankAccount(account.id)}
                                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                                    >
                                                        {expandedBankAccountIds.includes(account.id)
                                                            ? <ChevronDown className="h-5 w-5 flex-shrink-0 text-[#10275c]" />
                                                            : <ChevronRight className="h-5 w-5 flex-shrink-0 text-[#10275c]" />}
                                                        <span className="truncate text-base font-semibold text-[#10275c]">
                                                            {account.bank_name.trim() || `Bank Account ${index + 1}`}
                                                            {account.bank_name.trim() && account.account_name.trim() ? ` - ${account.account_name}` : ""}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateBankAccounts(bankAccounts.filter((item) => item.id !== account.id))}
                                                        className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" /> Remove
                                                    </button>
                                                </div>
                                                {expandedBankAccountIds.includes(account.id) && (
                                                <div id={`bank-account-fields-${account.id}`} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5">
                                                    {([
                                                        ["bank_name", "Bank Name", true],
                                                        ["account_name", "Account Name", true],
                                                        ["sort_code", "Sort Code", true],
                                                        ["account_number", "Account Number", true],
                                                        ["iban", "IBAN (optional)", false],
                                                        ["bic_swift", "BIC / SWIFT (optional)", false],
                                                    ] as const).map(([key, label, required]) => (
                                                        <label key={key} className="block space-y-2">
                                                            <span className="text-sm font-bold text-[#10275c]">{label}</span>
                                                            <input
                                                                type="text"
                                                                value={account[key]}
                                                                required={required}
                                                                onChange={(event) => updateBankAccount(account.id, key, event.target.value)}
                                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#eb5c10] focus:ring-[#eb5c10] sm:text-sm p-3 border"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                                )}
                                            </section>
                                        ))}
                                    </div>
                                )
                            ) : filteredSettings.length === 0 ? (
                                <div className="text-sm text-gray-500">No settings in this section.</div>
                            ) : (
                                activeTab === "home" ? (
                                    <div className="space-y-6">
                                        {homeGroups.resolvedSections.map((section) => (
                                            <div key={section.id} className="rounded-lg border border-gray-200 bg-[#f8fafc] p-6 space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-semibold text-[#10275c]">{section.title}</h2>
                                                    {section.description && (
                                                        <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 gap-6">
                                                    {section.settings.map(renderSettingField)}
                                                </div>
                                            </div>
                                        ))}

                                        {homeGroups.leftovers.length > 0 && (
                                            <div className="rounded-lg border border-gray-200 bg-[#f8fafc] p-6 space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-semibold text-[#10275c]">Other Home Settings</h2>
                                                    <p className="text-sm text-gray-500 mt-1">Keys not mapped to a specific homepage section yet.</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-6">
                                                    {homeGroups.leftovers.map(renderSettingField)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    filteredSettings.map(renderSettingField)
                                )
                            )}
                        </div>

                        <div className="pt-8 border-t flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-md bg-orange px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-hover disabled:opacity-50"
                            >
                                {saving ? "Saving..." : `Save ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Settings`}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
