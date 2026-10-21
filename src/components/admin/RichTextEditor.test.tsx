import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RichTextEditor from "./RichTextEditor";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const initial = '<div class="service-section"><div class="service-copy"><h2>Made to fit</h2><p>Original text</p></div><div class="service-media"><img src="/old.webp" alt="Original description"></div></div>';
function Editor({ value = initial }: { value?: string }) {
  const [content, setContent] = useState(value);
  return <><RichTextEditor label="Content" serviceLayout value={content} onChange={setContent} /><output data-testid="saved-content">{content}</output></>;
}
function selectInside(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent.mouseUp(screen.getByRole("textbox"));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Service layout editing", () => {
  it("keeps text edits and side changes when the saved HTML is reopened", () => {
    const { unmount } = render(<Editor />);
    const editor = screen.getByRole("textbox");
    editor.querySelector("p")!.textContent = "Updated description";
    fireEvent.input(editor);
    selectInside(editor.querySelector("h2")!);
    fireEvent.click(screen.getByRole("button", { name: "Swap sides" }));
    const saved = screen.getByTestId("saved-content").textContent!;
    expect(saved).toContain("Updated description");
    expect(saved).toContain("service-section--image-left");
    unmount();
    render(<Editor value={saved} />);
    expect(screen.getByRole("textbox").querySelector(".service-section--image-left img")).toHaveAttribute("src", "/old.webp");
  });

  it("adds a complete section and puts the uploaded image in its media column", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: "/uploaded.webp" });
    const { container } = render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Add image + text" }));
    expect(screen.getByRole("textbox").querySelectorAll(".service-section")).toHaveLength(2);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["photo"], "kitchen.webp", { type: "image/webp" })] },
    });
    await waitFor(() => expect(screen.getByRole("textbox").querySelectorAll(".service-media img")).toHaveLength(2));
    expect(screen.getByTestId("saved-content").textContent).toContain('/uploaded.webp');
  });

  it("replaces a selected photo without adding a second image or losing its alt text", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ url: "/replacement.webp" });
    const { container } = render(<Editor />);
    fireEvent.click(screen.getByAltText("Original description"));
    fireEvent.click(screen.getByRole("button", { name: "Replace photo" }));
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["photo"], "new.webp", { type: "image/webp" })] },
    });
    await waitFor(() => expect(screen.getByAltText("Original description")).toHaveAttribute("src", "/replacement.webp"));
    expect(screen.getByRole("textbox").querySelectorAll("img")).toHaveLength(1);
  });
});
