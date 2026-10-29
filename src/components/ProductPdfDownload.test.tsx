import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductPdfDownload from "./ProductPdfDownload";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Product PDF download", () => {
  it("requests current data once while busy and downloads the returned PDF", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob(["%PDF-test"], { type: "application/pdf" });
    const createUrl = vi.fn(() => "blob:product-pdf");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ProductPdfDownload productId={59} />);
    fireEvent.click(screen.getByRole("button", { name: "Download product information (PDF)" }));
    expect(screen.getByRole("button", { name: "Preparing PDF…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/products/59/pdf", expect.objectContaining({
      cache: "no-store", headers: { Accept: "application/pdf", "X-Site-Origin": window.location.origin },
    }));
    finish({ ok: true, headers: new Headers({ "content-type": "application/pdf", "content-disposition": 'attachment; filename="fan.pdf"' }), blob: async () => blob } as Response);
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("keeps the page open and allows retry when the server disables or fails the download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<ProductPdfDownload productId={59} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
    expect(screen.getByRole("button")).toBeEnabled();
  });
});
