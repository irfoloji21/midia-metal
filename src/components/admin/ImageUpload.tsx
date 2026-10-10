import React, { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import ProductImage from "@/components/ProductImage";

interface ImageUploadProps {
    value: string;
    onChange: (url: string) => void;
    label?: string;
    hidePreview?: boolean;
    adaptiveBackground?: boolean;
}

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_SIZE_LABEL = "2MB";

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, label, hidePreview = false, adaptiveBackground = false }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please choose a valid image file.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            toast.error(`Image is too large. Max size is ${MAX_IMAGE_SIZE_LABEL}.`);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const data = await apiFetch<{ url: string }>("/admin/upload", {
                method: "POST",
                body: formData,
            });
            onChange(data.url);
            toast.success("Image uploaded successfully");
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to upload image");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleRemove = () => {
        onChange("");
    };

    return (
        <div className={hidePreview ? "inline-block" : "space-y-4"}>
            {label && <label className="block text-sm font-semibold text-[#10275c]">{label}</label>}
            <div className={hidePreview ? "flex flex-col" : "flex items-center gap-6"}>
                {!hidePreview && (
                    <div className="relative group w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 bg-[#F9FBFC]">
                        {value ? (
                            <>
                                {adaptiveBackground ? (
                                    <ProductImage src={value} alt="Preview" className="h-full w-full" />
                                ) : (
                                    <img src={value} alt="Preview" className="w-full h-full object-cover" />
                                )}
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center gap-1">
                                <Upload className="w-6 h-6" />
                                <span className="text-[10px] font-medium">No Image</span>
                            </div>
                        )}
                        {isUploading && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 backdrop-blur-sm">
                                <Loader2 className="w-8 h-8 animate-spin text-[#eb5c10]" />
                            </div>
                        )}
                    </div>
                )}
                <div className={hidePreview ? "w-full" : ""}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUpload}
                        className="hidden"
                        accept="image/*"
                    />
                    <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-10 px-6 bg-orange text-white rounded-md text-sm font-bold shadow-md hover:bg-orange-hover disabled:opacity-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {value && !hidePreview ? "Change Image" : hidePreview ? (isUploading ? "Uploading..." : "Upload Image") : "Upload Image"}
                    </button>
                    {!hidePreview && <p className="text-[11px] text-gray-500 mt-2 font-medium">Max size: {MAX_IMAGE_SIZE_LABEL} (JPG, PNG, WebP)</p>}
                </div>
            </div>
        </div>
    );
};

export default ImageUpload;
