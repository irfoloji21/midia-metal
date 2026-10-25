import { useEffect, useRef, useState } from "react";
import {
  Bold,
  ImagePlus,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Eraser,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  LayoutGrid,
  Columns2,
  Columns3,
  ArrowLeftRight,
  ImageUp,
  TextCursorInput,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { isWordHtml, normalizeWordHtml } from "@/lib/word-paste";
import { sanitizeLayoutText } from "@/lib/layout-blocks";
import { plainTextContent } from "@/lib/content-sections";
import { toast } from "sonner";
import "@/service-content.css";
import "@/product-editorial.css";
import "@/content-sections.css";

type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  serviceLayout?: boolean;
  wordPaste?: boolean;
  documentLayout?: boolean;
  textOnly?: boolean;
};

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_SIZE_LABEL = "2MB";

export default function RichTextEditor({ label, value, onChange, helperText = "Saved as formatted HTML.", serviceLayout = false, wordPaste = false, documentLayout = false, textOnly = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const draggingImageRef = useRef<HTMLImageElement | null>(null);
  const activeImgRowRef = useRef<HTMLElement | null>(null);
  const replacementImageRef = useRef<HTMLImageElement | null>(null);
  const contentRevisionRef = useRef(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [selectedCell, setSelectedCell] = useState<HTMLTableCellElement | null>(null);
  const [imageRect, setImageRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const updateImageRect = () => {
    if (!selectedImage || !wrapperRef.current) return;
    if (!document.body.contains(selectedImage)) {
      setSelectedImage(null);
      return;
    }
    const wrapperBounds = wrapperRef.current.getBoundingClientRect();
    const imgBounds = selectedImage.getBoundingClientRect();

    setImageRect({
      top: imgBounds.top - wrapperBounds.top,
      left: imgBounds.left - wrapperBounds.left,
      width: imgBounds.width,
      height: imgBounds.height,
    });
  };

  useEffect(() => {
    if (!selectedImage) {
      setImageRect(null);
      return undefined;
    }
    updateImageRect();
    const observer = new ResizeObserver(updateImageRect);
    observer.observe(selectedImage);
    
    const handleScroll = () => updateImageRect();
    editorRef.current?.addEventListener("scroll", handleScroll);
    window.addEventListener("scroll", handleScroll, true);
    
    return () => {
      observer.disconnect();
      editorRef.current?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [selectedImage]);

  useEffect(() => {
    const content = textOnly ? sanitizeLayoutText(value || "") : value || "";
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      contentRevisionRef.current += 1;
      editorRef.current.innerHTML = content;
      setSelectedCell(null);
      setSelectedImage(null);
      selectionRef.current = null;
      replacementImageRef.current = null;
      activeImgRowRef.current = null;
      draggingImageRef.current = null;
      setIsUploading(false);
    }
  }, [value, textOnly]);

  const emitChange = () => {
    const content = editorRef.current?.innerHTML || "";
    if (textOnly) {
      const clean = sanitizeLayoutText(content);
      // Merely focusing a legacy text slot must not rewrite its stored formatting.
      if (clean !== sanitizeLayoutText(value || "")) onChange(clean);
      return;
    }
    onChange(content);
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    if (textOnly) return;
    const target = e.target as HTMLElement;
    setSelectedCell(target.closest("td,th") as HTMLTableCellElement | null);
    if (target.tagName === "IMG") {
      setSelectedImage(target as HTMLImageElement);
    } else {
      setSelectedImage(null);
    }

    // Track if clicking inside an img-row
    let node: HTMLElement | null = target;
    let foundRow: HTMLElement | null = null;
    while (node && node !== editorRef.current) {
      if (node.classList?.contains("img-row")) {
        foundRow = node;
        break;
      }
      node = node.parentElement;
    }
    activeImgRowRef.current = foundRow;
  };

  const selectedTable = selectedCell?.closest('table');
  const tableRows = selectedTable ? Array.from(selectedTable.rows) : [];
  const simpleTable = tableRows.length > 0 && tableRows.every(row => row.cells.length === tableRows[0].cells.length && Array.from(row.cells).every(cell => cell.colSpan === 1 && cell.rowSpan === 1));
  const cellAtCaret = (): HTMLTableCellElement | null | undefined => {
    const selection = window.getSelection();
    const node = selection?.focusNode;
    // A toolbar can own focus while the editor still owns the saved selection.
    if (!selection?.rangeCount || !node || !editorRef.current?.contains(node)) return undefined;
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest<HTMLTableCellElement>('td,th') || null;
  };
  const changeTable = (action: 'add-row' | 'remove-row' | 'add-column' | 'remove-column') => {
    if (textOnly) return;
    const caretCell = cellAtCaret();
    const cell = caretCell === undefined ? selectedCell : caretCell;
    if (!cell || !editorRef.current?.contains(cell)) return;
    const table = cell.closest('table');
    const rows = table ? Array.from(table.rows) : [];
    if (!table || !rows.length || !rows.every(row => row.cells.length === rows[0].cells.length && Array.from(row.cells).every(item => item.colSpan === 1 && item.rowSpan === 1))) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const column = cell.cellIndex;
    let focusCell: HTMLTableCellElement | null = cell;
    if (action === 'add-row') {
      const nextRow = document.createElement('tr');
      Array.from(row.cells).forEach(() => { const cell = document.createElement('td'); cell.innerHTML = '<br>'; nextRow.append(cell); });
      if (row.parentElement?.tagName === 'THEAD') {
        const body = table.tBodies[0] || table.createTBody();
        body.insertBefore(nextRow, body.firstChild);
      } else row.after(nextRow);
      focusCell = nextRow.cells[0];
    } else if (action === 'remove-row' && rows.length > 1) {
      const index = rows.indexOf(row);
      focusCell = (rows[index + 1] || rows[index - 1]).cells[Math.min(column, row.cells.length - 1)];
      row.remove();
    } else if (action === 'add-column') {
      rows.forEach(item => {
        const cell = document.createElement(item.cells[column].tagName.toLowerCase());
        cell.innerHTML = '<br>';
        item.cells[column].after(cell);
      });
      focusCell = row.cells[column + 1];
    } else if (action === 'remove-column' && row.cells.length > 1) {
      rows.forEach(item => item.cells[column].remove());
      focusCell = row.cells[Math.min(column, row.cells.length - 1)];
    }
    setSelectedCell(focusCell);
    emitChange();
    editorRef.current.focus();
    if (focusCell) {
      const range = document.createRange();
      range.selectNodeContents(focusCell);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      selectionRef.current = range.cloneRange();
    }
  };

  const applyImageWidth = (width: string) => {
    if (!selectedImage) return;
    selectedImage.style.width = width;
    emitChange();
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = selectedImage.getBoundingClientRect().width;
    const startHeight = selectedImage.getBoundingClientRect().height;

    selectedImage.style.maxWidth = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (direction.includes("e")) newWidth += deltaX;
      if (direction.includes("w")) newWidth -= deltaX;
      if (direction.includes("s")) newHeight += deltaY;
      if (direction.includes("n")) newHeight -= deltaY;

      selectedImage.style.width = `${Math.max(20, newWidth)}px`;
      selectedImage.style.height = `${Math.max(20, newHeight)}px`;
      updateImageRect();
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      emitChange();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;
    selectionRef.current = range.cloneRange();
    setSelectedCell(cellAtCaret() || null);
  };

  const restoreSelection = () => {
    if (!selectionRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };

  const getSafeInsertionRange = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor) return null;

    if (selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)) {
      return selectionRef.current.cloneRange();
    }

    if (selection.rangeCount > 0) {
      const liveRange = selection.getRangeAt(0);
      if (editor.contains(liveRange.commonAncestorContainer)) {
        return liveRange.cloneRange();
      }
    }

    const fallback = document.createRange();
    fallback.selectNodeContents(editor);
    fallback.collapse(false);
    return fallback;
  };

  const insertHtmlAtSelection = (html: string) => {
    editorRef.current?.focus();
    restoreSelection();

    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor) return;

    const range = getSafeInsertionRange();
    if (!range) return;

    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);

    if (lastNode) {
      const newRange = document.createRange();
      if (lastNode.nodeType === Node.ELEMENT_NODE) {
        newRange.selectNodeContents(lastNode);
      } else {
        newRange.setStartAfter(lastNode);
      }
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
      selectionRef.current = newRange.cloneRange();
    }

    emitChange();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (textOnly) {
      event.preventDefault();
      const clipboardHtml = event.clipboardData.getData("text/html");
      const clipboardText = event.clipboardData.getData("text/plain");
      if (!clipboardHtml && !clipboardText) return;
      const source = clipboardHtml
        ? (isWordHtml(clipboardHtml) ? normalizeWordHtml(clipboardHtml).html : clipboardHtml)
        : plainTextContent(clipboardText);
      const html = sanitizeLayoutText(source);
      if (!html.trim() || !new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim()) return;
      saveSelection();
      if (document.execCommand?.("insertHTML", false, html)) {
        saveSelection();
        emitChange();
      } else insertHtmlAtSelection(html);
      return;
    }
    if (!wordPaste) return;
    const html = event.clipboardData.getData("text/html");
    if (!isWordHtml(html)) return;
    event.preventDefault();
    const normalized = normalizeWordHtml(html);
    if (normalized.missingImages) {
      toast.error("Word did not include a usable copy of every image. Copy from Word Online, or add the images using the image button.");
      return;
    }
    saveSelection();
    setSelectedImage(null);
    // Native insertion keeps the entire paste in the browser's undo history.
    if (document.execCommand?.("insertHTML", false, normalized.html)) {
      saveSelection();
      emitChange();
    } else {
      insertHtmlAtSelection(normalized.html);
    }
  };

  const setSelectionFromPoint = (x: number, y: number) => {
    const docWithCaret = document as Document & {
      caretRangeFromPoint?: (px: number, py: number) => Range | null;
      caretPositionFromPoint?: (px: number, py: number) => { offsetNode: Node; offset: number } | null;
    };

    if (docWithCaret.caretRangeFromPoint) {
      const range = docWithCaret.caretRangeFromPoint(x, y);
      if (range) {
        selectionRef.current = range.cloneRange();
        return;
      }
    }

    if (docWithCaret.caretPositionFromPoint) {
      const caret = docWithCaret.caretPositionFromPoint(x, y);
      if (caret) {
        const range = document.createRange();
        range.setStart(caret.offsetNode, caret.offset);
        range.collapse(true);
        selectionRef.current = range.cloneRange();
      }
    }
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await apiFetch<{ url: string }>("/admin/upload", {
      method: "POST",
      body: formData,
    });
    return response.url;
  };

  const insertUploadedImages = async (files: File[]) => {
    if (textOnly || !files.length) return;
    const uploadEditor = editorRef.current;
    if (!uploadEditor) return;
    const uploadRevision = contentRevisionRef.current;
    const isCurrentEditor = () => editorRef.current === uploadEditor && uploadEditor.isConnected && contentRevisionRef.current === uploadRevision;

    const oversized = files.find((file) => file.size > MAX_IMAGE_SIZE_BYTES);
    if (oversized) {
      toast.error(`"${oversized.name}" is too large. Max size is ${MAX_IMAGE_SIZE_LABEL}.`);
      return;
    }

    const replacement = replacementImageRef.current;
    replacementImageRef.current = null;
    const insertionRange = getSafeInsertionRange();
    const insertionNode = insertionRange?.startContainer;
    const insertionElement = insertionNode instanceof HTMLElement ? insertionNode : insertionNode?.parentElement;
    const mediaTarget = serviceLayout ? insertionElement?.closest(".service-media") : null;

    if (selectedImage && !replacement && !mediaTarget) {
      const newRange = document.createRange();
      newRange.setStartAfter(selectedImage);
      newRange.collapse(true);
      selectionRef.current = newRange;
      setSelectedImage(null);
    }

    // Check if we have an active img-row container
    const imgRowTarget = activeImgRowRef.current;

    setIsUploading(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        // A section can close, or another record can load, while the request runs.
        if (!isCurrentEditor()) return;
        if (replacement && !uploadEditor.contains(replacement)) return;
        const alt = file.name.replace(/\.[^/.]+$/, "");

        if (replacement && editorRef.current?.contains(replacement)) {
          const linkedImage = replacement.closest<HTMLAnchorElement>('a[href]');
          if (linkedImage && linkedImage.href === replacement.src) linkedImage.setAttribute('href', url);
          replacement.src = url;
          // Keep the image's sizing, alignment and descriptive alt text.
          emitChange();
          break;
        } else if (mediaTarget && editorRef.current?.contains(mediaTarget)) {
          const img = document.createElement("img");
          img.src = url;
          img.alt = alt;
          img.loading = "lazy";
          mediaTarget.replaceChildren(img);
          setSelectedImage(img);
          emitChange();
          break;
        } else if (imgRowTarget && editorRef.current?.contains(imgRowTarget)) {
          // Remove the placeholder hint if present
          const hint = imgRowTarget.querySelector<HTMLSpanElement>("span[contenteditable='false']");
          if (hint) {
            imgRowTarget.removeChild(hint);
          }
          // Remove <br> placeholders
          imgRowTarget.querySelectorAll<HTMLBRElement>("br").forEach(br => br.remove());

          // Create the img element and append directly into the flex row
          const img = document.createElement("img");
          img.src = url;
          img.alt = alt;
          img.style.cssText = "height:auto;display:inline-block;margin:4px;max-width:48%;";
          img.loading = "lazy";
          imgRowTarget.appendChild(img);
          emitChange();
        } else {
          const escapedSrc = String(url).replace(/"/g, "&quot;");
          const escapedAlt = alt.replace(/"/g, "&quot;");
          const defaultImageStyle = files.length === 1
            ? "max-width:40%;height:auto;display:block;float:left;margin:0 16px 12px 0;"
            : "max-width:100%;height:auto;display:inline-block;margin:5px;";
          insertHtmlAtSelection(
            `<img src="${escapedSrc}" alt="${escapedAlt}" style="${defaultImageStyle}" />&nbsp;`
          );
        }
      }
      if (isCurrentEditor()) toast.success(files.length > 1 ? "Images uploaded" : "Image uploaded");
    } catch (error: any) {
      if (isCurrentEditor()) toast.error(error?.message || "Failed to upload image");
    } finally {
      if (isCurrentEditor()) setIsUploading(false);
    }
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    if (command === "foreColor") {
      document.execCommand("styleWithCSS", false, "true");
    }
    document.execCommand(command, false, commandValue);
    saveSelection();
    emitChange();
  };

  const openImagePicker = () => {
    replacementImageRef.current = null;
    editorRef.current?.focus();
    saveSelection();
    imageInputRef.current?.click();
  };

  const handleImagePickerChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      toast.error("Please choose image files only.");
      event.target.value = "";
      return;
    }

    await insertUploadedImages(files);
    event.target.value = "";
  };

  const addLink = () => {
    const input = window.prompt("Enter URL (https://...)");
    if (!input) return;
    const href = input.startsWith("http://") || input.startsWith("https://") ? input : `https://${input}`;
    runCommand("createLink", href);
  };

  const openColorPicker = () => {
    saveSelection();
    colorInputRef.current?.click();
  };

  const applyColor = (color: string) => {
    if (!color) return;
    runCommand("foreColor", color);
  };

  const insertListFallback = (type: "ul" | "ol") => {
    editorRef.current?.focus();
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const text = selection.toString().trim();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      runCommand(type === "ul" ? "insertUnorderedList" : "insertOrderedList");
      return;
    }

    const listItems = lines.map((line) => `<li>${line.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char))}</li>`).join("");
    insertHtmlAtSelection(`<${type}>${listItems}</${type}><p><br></p>`);
  };

  const insertImageRow = (columns?: 2 | 3) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();

    // Create the flex row container with a visual hint 
    const row = document.createElement("div");
    row.className = columns ? `img-row img-row--${columns}` : "img-row";
    if (!columns) row.setAttribute("style", "display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin:8px 0;min-height:60px;padding:6px;border:2px dashed #eb5c10;border-radius:6px;position:relative;");

    // Create a placeholder hint span (cleared when images drop in)
    const hint = document.createElement("span");
    hint.style.cssText = "color:#eb5c10;font-size:12px;opacity:0.7;pointer-events:none;align-self:center;";
    hint.setAttribute("contenteditable", "false");
    hint.textContent = "← Drop or upload images here to place side-by-side";
    if (!columns) row.appendChild(hint);

    // Find current block-level ancestor in the editor
    const sel = window.getSelection();
    let blockAncestor: Node | null = null;
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node.parentNode !== editor) {
        node = node.parentNode;
      }
      if (node && node.parentNode === editor) {
        blockAncestor = node;
      }
    }

    // Insert the row AFTER the block-level ancestor (or at the end)
    if (blockAncestor) {
      editor.insertBefore(row, blockAncestor.nextSibling);
    } else {
      editor.appendChild(row);
    }

    // Add a trailing paragraph so user can type below
    const after = document.createElement("p");
    after.innerHTML = "<br>";
    row.parentNode?.insertBefore(after, row.nextSibling);

    // Move cursor inside the row (after the hint span)
    const newRange = document.createRange();
    newRange.setStart(row, row.childNodes.length);
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);
    selectionRef.current = newRange.cloneRange();

    // Track this as the active image row
    activeImgRowRef.current = row;

    emitChange();
    toast.info("Image row created! Now click Upload Image to add images side by side.", { duration: 4000 });
  };

  const currentServiceSection = () => {
    const node = getSafeInsertionRange()?.startContainer;
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    const section = element?.closest<HTMLElement>(".service-section");
    return section && editorRef.current?.contains(section) ? section : null;
  };

  const insertServiceSection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const previous = currentServiceSection();
    const section = document.createElement("div");
    const count = editor.querySelectorAll(".service-section").length;
    section.className = `service-section${count % 2 ? " service-section--image-left" : ""}`;
    section.innerHTML = '<div class="service-copy"><div class="service-eyebrow">Service detail</div><h2>Section heading</h2><p>Describe the work and the requirements for this service.</p></div><div class="service-media"></div>';
    if (previous) previous.after(section);
    else editor.appendChild(section);
    const range = document.createRange();
    range.selectNodeContents(section.querySelector(".service-media")!);
    range.collapse(false);
    editor.focus();
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    selectionRef.current = range.cloneRange();
    activeImgRowRef.current = null;
    setSelectedImage(null);
    emitChange();
  };

  const swapServiceSection = () => {
    const section = currentServiceSection();
    if (!section) {
      toast.info("Click inside a section first.");
      return;
    }
    section.classList.toggle("service-section--image-left");
    emitChange();
  };

  const buttons = [
    { title: "Bold", icon: Bold, action: () => runCommand("bold") },
    { title: "Italic", icon: Italic, action: () => runCommand("italic") },
    { title: "Underline", icon: Underline, action: () => runCommand("underline") },
    { title: "Heading 2", icon: Heading2, action: () => runCommand("formatBlock", "<h2>") },
    { title: "Heading 3", icon: Heading3, action: () => runCommand("formatBlock", "<h3>") },
    { title: "Bullet List", icon: List, action: () => insertListFallback("ul") },
    { title: "Numbered List", icon: ListOrdered, action: () => insertListFallback("ol") },
    { title: "Quote", icon: Quote, action: () => runCommand("formatBlock", "<blockquote>") },
    { title: "Link", icon: Link2, action: addLink },
    { title: "Upload Image", icon: ImagePlus, action: openImagePicker },
    { title: "Image Row (Side-by-Side)", icon: LayoutGrid, action: () => insertImageRow() },
    { title: "2 images side by side", icon: Columns2, action: () => insertImageRow(2) },
    { title: "3 images side by side", icon: Columns3, action: () => insertImageRow(3) },
    { title: "Text Color", icon: Palette, action: openColorPicker },
    { title: "Clear Format", icon: Eraser, action: () => runCommand("removeFormat") },
  ];

  return (
    <div>
      {label ? <label className="block text-sm font-medium text-gray-700">{label}</label> : null}
      <div ref={wrapperRef} className="mt-1 border border-gray-300 rounded-md overflow-hidden bg-white relative">
        <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
          {buttons.filter(({ title }) => !textOnly || !['Upload Image', 'Image Row (Side-by-Side)', '2 images side by side', '3 images side by side', 'Text Color'].includes(title)).map(({ title, icon: Icon, action }) => (
            <button
              key={title}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
              }}
              onClick={action}
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-200 bg-white text-gray-600 hover:text-[#eb5c10] hover:border-[#eb5c10] transition-colors"
              title={title}
              aria-label={title}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
          {!textOnly && <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImagePickerChange}
          />}
          {!textOnly && <input
            ref={colorInputRef}
            type="color"
            defaultValue="#10275c"
            className="hidden"
            onChange={(e) => applyColor(e.target.value)}
          />}
        </div>

        {!textOnly && (serviceLayout || selectedImage) && (
          <div className="flex flex-wrap gap-2 border-b border-gray-200 p-2 bg-[#f4f6f8]">
            {[
              ...(serviceLayout ? [
                { label: "Add image + text", icon: Columns2, action: insertServiceSection, disabled: false },
                { label: "Swap sides", icon: ArrowLeftRight, action: swapServiceSection, disabled: false },
              ] : []),
              { label: "Replace photo", icon: ImageUp, disabled: !selectedImage, action: () => {
                replacementImageRef.current = selectedImage;
                imageInputRef.current?.click();
              } },
              { label: "Image description", icon: TextCursorInput, disabled: !selectedImage, action: () => {
                if (!selectedImage) return;
                const alt = window.prompt("Describe what is shown in the photograph", selectedImage.alt);
                if (alt !== null) { selectedImage.alt = alt.trim(); emitChange(); }
              } },
            ].map(({ label: buttonLabel, icon: Icon, action, disabled }) => (
              <button key={buttonLabel} type="button" disabled={disabled}
                onMouseDown={(event) => { event.preventDefault(); saveSelection(); }}
                onClick={action}
                className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-primary disabled:opacity-40 hover:border-orange">
                <Icon className="w-4 h-4" />{buttonLabel}
              </button>
            ))}
          </div>
        )}

        {!textOnly && selectedCell && editorRef.current?.contains(selectedCell) && <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-slate-50 p-2" role="toolbar" aria-label="Table editing">
          {[
            { label: 'Add row below', action: 'add-row', disabled: !simpleTable },
            { label: 'Remove row', action: 'remove-row', disabled: !simpleTable || tableRows.length <= 1 },
            { label: 'Add column right', action: 'add-column', disabled: !simpleTable },
            { label: 'Remove column', action: 'remove-column', disabled: !simpleTable || (selectedCell.parentElement as HTMLTableRowElement)?.cells.length <= 1 },
          ].map(item => <button key={item.action} type="button" disabled={item.disabled} onMouseDown={event => event.preventDefault()} onClick={() => changeTable(item.action as 'add-row' | 'remove-row' | 'add-column' | 'remove-column')} className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-primary disabled:opacity-40">{item.label}</button>)}
          {!simpleTable && <span className="text-xs text-gray-500">Merged cells: edit the text directly. Row and column changes are available in simple tables.</span>}
        </div>}

        <div
          ref={editorRef}
          role="textbox"
          aria-label={label || "Rich text content"}
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onFocus={() => { if (textOnly) document.execCommand?.("defaultParagraphSeparator", false, "p"); }}
          onClick={handleEditorClick}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onDragStart={(event) => {
            if (textOnly) { event.preventDefault(); return; }
            const target = event.target as HTMLElement;
            if (serviceLayout && target.closest(".service-media")) {
              event.preventDefault();
              return;
            }
            if (target.tagName === "IMG") {
              draggingImageRef.current = target as HTMLImageElement;
              event.dataTransfer.setData("text/x-internal-img", "1");
              setSelectedImage(null);
            } else {
              draggingImageRef.current = null;
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (textOnly) return;
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (textOnly) return;
            setIsDragOver(true);
            setSelectionFromPoint(event.clientX, event.clientY);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            setIsDragOver(false);
            if (textOnly) return;

            // Internal image drag — smart drop: into img-row container if target is one, else root level
            if (draggingImageRef.current && event.dataTransfer.getData("text/x-internal-img") === "1") {
              const img = draggingImageRef.current;
              draggingImageRef.current = null;
              const editor = editorRef.current;
              if (!editor) return;

              // Remove image from old location
              const oldParent = img.parentNode as HTMLElement | null;
              oldParent?.removeChild(img);

              // Clean up empty old parent (if it was a <p> that's now empty)
              if (
                oldParent &&
                oldParent !== editor &&
                oldParent.tagName === "P" &&
                oldParent.textContent?.trim() === "" &&
                oldParent.childNodes.length === 0
              ) {
                oldParent.parentNode?.removeChild(oldParent);
              }

              // Determine what we dropped onto
              const dropTarget = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;

              // Walk up from drop target to find img-row container
              let imgRow: HTMLElement | null = null;
              let walker: HTMLElement | null = dropTarget;
              while (walker && walker !== editor) {
                if (walker.classList?.contains("img-row")) {
                  imgRow = walker;
                  break;
                }
                walker = walker.parentElement;
              }

              if (imgRow) {
                // Drop is onto an img-row — insert image at the correct position within the row
                const children = Array.from(imgRow.children) as HTMLElement[];
                let insertBeforeChild: Element | null = null;
                for (const child of children) {
                  const r = child.getBoundingClientRect();
                  if (event.clientX < r.left + r.width / 2) {
                    insertBeforeChild = child;
                    break;
                  }
                }
                img.style.maxWidth = "none";
                if (insertBeforeChild) {
                  imgRow.insertBefore(img, insertBeforeChild);
                } else {
                  imgRow.appendChild(img);
                }
              } else {
                // Drop is onto empty area — find closest root-level child and insert before/after
                const editorRect = editor.getBoundingClientRect();
                let insertBefore: Node | null = null;
                for (const child of Array.from(editor.childNodes)) {
                  if (child === img) continue;
                  const el = child as HTMLElement;
                  if (!el.getBoundingClientRect) continue;
                  const r = el.getBoundingClientRect();
                  const midY = r.top + r.height / 2 - editorRect.top;
                  if (event.clientY - editorRect.top < midY) {
                    insertBefore = child;
                    break;
                  }
                }
                if (insertBefore) {
                  editor.insertBefore(img, insertBefore);
                } else {
                  editor.appendChild(img);
                }
              }

              emitChange();
              return;
            }

            draggingImageRef.current = null;

            const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
            if (!files.length) return;

            const row = (event.target as HTMLElement).closest<HTMLElement>(".img-row");
            activeImgRowRef.current = row && editorRef.current?.contains(row) ? row : null;
            setSelectionFromPoint(event.clientX, event.clientY);
            await insertUploadedImages(files);
          }}
          onInput={emitChange}
          onPaste={handlePaste}
          onBlur={() => {
            saveSelection();
            emitChange();
          }}
          className={`${serviceLayout ? "service-rich-content service-rich-editor" : ""} ${documentLayout ? "section-document" : ""} min-h-[220px] max-h-[600px] overflow-y-auto p-3 focus:outline-none text-sm leading-6 text-gray-700 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#eb5c10] [&_blockquote]:pl-3 [&_blockquote]:italic [&_table]:w-full [&_table]:border-separate [&_table]:[border-spacing:18px_0] [&_td]:align-top [&_td]:pr-4 [&_td]:pb-3 [&_th]:align-top [&_th]:pr-4 [&_th]:pb-3 [&_img]:max-w-full ${isDragOver ? "bg-[#fff7f2] ring-2 ring-[#eb5c10]/40" : ""}`}
        />

        {!textOnly && selectedImage && imageRect && (
          <div
            className="absolute pointer-events-none border-2 border-[#eb5c10] z-10"
            style={{
              top: imageRect.top,
              left: imageRect.left,
              width: imageRect.width,
              height: imageRect.height,
            }}
          >
            {!serviceLayout && !selectedImage.closest('.img-row--2, .img-row--3') && <>
            {/* Corners */}
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-nwse-resize -top-1.5 -left-1.5 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "nw")} />
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-nesw-resize -top-1.5 -right-1.5 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "ne")} />
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-nesw-resize -bottom-1.5 -left-1.5 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "sw")} />
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-nwse-resize -bottom-1.5 -right-1.5 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "se")} />
            
            {/* Edges */}
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-ns-resize -top-1.5 left-1/2 -translate-x-1/2 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "n")} />
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-ns-resize -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "s")} />
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-ew-resize top-1/2 -translate-y-1/2 -left-1.5 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "w")} />
            <div className="absolute w-3 h-3 bg-white border border-[#eb5c10] cursor-ew-resize top-1/2 -translate-y-1/2 -right-1.5 pointer-events-auto" onMouseDown={(e) => handleResizeStart(e, "e")} />
          
            {/* Alignment Toolbar */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white shadow-md border border-gray-200 rounded-md p-1 flex gap-1 z-20 pointer-events-auto">
              <button
                type="button"
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                title="Align Left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectedImage.style.display = "inline";
                  selectedImage.style.float = "left";
                  selectedImage.style.margin = "0 1em 1em 0";
                  emitChange();
                  setTimeout(updateImageRect, 50);
                }}
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                title="Align Center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectedImage.style.display = "block";
                  selectedImage.style.float = "none";
                  selectedImage.style.margin = "1em auto";
                  emitChange();
                  setTimeout(updateImageRect, 50);
                }}
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                title="Align Right"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectedImage.style.display = "inline";
                  selectedImage.style.float = "right";
                  selectedImage.style.margin = "0 0 1em 1em";
                  emitChange();
                  setTimeout(updateImageRect, 50);
                }}
              >
                <AlignRight className="w-4 h-4" />
              </button>
              <div className="w-px bg-gray-300 mx-1 py-1"></div>
              <button
                type="button"
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                title="Inline (Side-by-Side)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectedImage.style.display = "inline-block";
                  selectedImage.style.float = "none";
                  selectedImage.style.margin = "5px";
                  emitChange();
                  setTimeout(updateImageRect, 50);
                }}
              >
                <AlignJustify className="w-4 h-4" />
              </button>
            </div>
            </>}
          </div>
        )}
      </div>
      {helperText ? (
        <p className="mt-1 text-xs text-gray-500">
          {helperText}{!textOnly && <> Drag and drop images into the editor, or use Upload Image. Max image size: {MAX_IMAGE_SIZE_LABEL}.</>}
          {isUploading ? " Uploading..." : ""}
        </p>
      ) : null}
    </div>
  );
}
