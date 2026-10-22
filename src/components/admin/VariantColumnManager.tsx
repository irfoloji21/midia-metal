// ---------------------------------------------------------------------------
// VariantColumnManager — extracted from AdminProducts.tsx
// A popover UI for managing variant table column visibility, labels, and
// custom column creation.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isCustomColumnKey } from "@/lib/adminProductUtils";
import type { VariantTableColumn } from "@/types/product";

export type VariantColumnManagerProps = {
    title: string;
    description: string;
    columns: VariantTableColumn[];
    onLabelChange: (key: string, label: string) => void;
    onVisibilityChange: (key: string, visible: boolean) => void;
    onFrontendVisibilityChange: (key: string, frontendVisible: boolean) => void;
    onAddColumn: (label: string) => void;
};

export default function VariantColumnManager({
    title,
    description,
    columns,
    onLabelChange,
    onVisibilityChange,
    onFrontendVisibilityChange,
    onAddColumn,
}: VariantColumnManagerProps) {
    const visibleCount = columns.filter((column) => column.visible).length;
    const [newColumnLabel, setNewColumnLabel] = useState("");

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Columns</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                        {visibleCount}/{columns.length}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" collisionPadding={12} sticky="always" className="w-[360px] max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
                    <p className="text-xs text-gray-400">{description}</p>
                </div>
                <div className="mt-3 pr-3">
                    <div className="space-y-2">
                        {columns.map((column) => (
                            <div key={column.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
                                <button
                                    type="button"
                                    onClick={() => onVisibilityChange(column.key, !column.visible)}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                        column.visible
                                            ? "border-red-200 bg-white text-red-500 hover:bg-red-50"
                                            : "border-green-200 bg-white text-green-600 hover:bg-green-50"
                                    }`}
                                    aria-label={column.visible ? `Remove ${column.label} column` : `Restore ${column.label} column`}
                                    title={column.visible ? "Remove column" : "Restore column"}
                                >
                                    {column.visible ? <Trash2 className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                                </button>
                                <div className="min-w-0">
                                    <input
                                        type="text"
                                        value={column.label}
                                        onChange={(event) => onLabelChange(column.key, event.target.value)}
                                        className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                                    />
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <div className="text-[10px] uppercase tracking-wider text-gray-400">
                                            {column.visible ? "visible" : "removed"} • {isCustomColumnKey(column.key) ? "custom" : column.key}
                                        </div>
                                        <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                                            <input
                                                type="checkbox"
                                                checked={column.frontendVisible}
                                                onChange={(event) => onFrontendVisibilityChange(column.key, event.target.checked)}
                                                className="rounded border-gray-300 text-[#eb5c10] focus:ring-[#eb5c10]"
                                            />
                                            <span>Show on frontend</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newColumnLabel}
                            onChange={(event) => setNewColumnLabel(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    const label = newColumnLabel.trim();
                                    if (!label) return;
                                    onAddColumn(label);
                                    setNewColumnLabel("");
                                }
                            }}
                            className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-sm focus:border-[#eb5c10] focus:outline-none"
                            placeholder="Add new text column"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const label = newColumnLabel.trim();
                                if (!label) return;
                                onAddColumn(label);
                                setNewColumnLabel("");
                            }}
                            className="inline-flex items-center rounded-md bg-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-hover"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
