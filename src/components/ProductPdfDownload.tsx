import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getResolvedApiUrl } from "@/lib/api";

export default function ProductPdfDownload({ productId }: { productId: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      // Always request a fresh server-generated document, including on an older open page.
      const response = await fetch(`${getResolvedApiUrl()}/v1/products/${productId}/pdf`, {
        headers: { Accept: "application/pdf", "X-Site-Origin": window.location.origin }, cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "PDF download is no longer available for this product." :
          response.status === 429 ? "Please wait a minute before downloading again." : "The PDF could not be created. Please try again.");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error("The PDF could not be created. Please try again.");
      }
      const file = await response.blob();
      const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || `product-${productId}-information.pdf`;
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF could not be created. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-[#dbe1e9] pt-6">
      <button type="button" onClick={download} disabled={loading} aria-busy={loading}
        className="inline-flex items-center justify-center gap-3 bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ac410b] disabled:cursor-wait disabled:opacity-70">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {loading ? "Preparing PDF…" : "Download product information (PDF)"}
      </button>
      <p className="mt-2 text-xs text-[#68758a]">Product images, description and specifications in one document.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
