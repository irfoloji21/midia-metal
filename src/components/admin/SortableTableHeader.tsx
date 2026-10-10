import { useState } from "react";

export type SortDirection = "asc" | "desc";

export interface TableSortState {
    key: string;
    direction: SortDirection;
}

export function useTableSort(initialKey: string, initialDirection: SortDirection = "asc") {
    const [sort, setSort] = useState<TableSortState>({ key: initialKey, direction: initialDirection });

    const toggleSort = (key: string) => {
        setSort((current) => current.key === key
            ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
            : { key, direction: "asc" });
    };

    return { sort, toggleSort };
}

const getValue = (row: unknown, key: string): unknown =>
    key.split(".").reduce<unknown>((value, part) => (
        value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined
    ), row);

const numericValue = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;

    const normalized = value.trim().replace(/[£$€,%\s]/g, "").replace(/,/g, "");
    if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
};

export function sortRows<T>(rows: T[], key: string, direction: SortDirection): T[] {
    const multiplier = direction === "asc" ? 1 : -1;

    return [...rows].sort((left, right) => {
        const a = getValue(left, key);
        const b = getValue(right, key);
        const aEmpty = a === null || a === undefined || a === "";
        const bEmpty = b === null || b === undefined || b === "";
        if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;

        if (typeof a === "boolean" && typeof b === "boolean") {
            return (Number(a) - Number(b)) * multiplier;
        }

        const isDateKey = /(?:^|_)(?:date|at|expires_at|published_at)$/.test(key) || key.endsWith("_at");
        if (isDateKey) {
            const aDate = new Date(String(a)).getTime();
            const bDate = new Date(String(b)).getTime();
            if (Number.isFinite(aDate) && Number.isFinite(bDate)) return (aDate - bDate) * multiplier;
        }

        const aNumber = numericValue(a);
        const bNumber = numericValue(b);
        if (aNumber !== null && bNumber !== null) return (aNumber - bNumber) * multiplier;

        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
    });
}

export function SortableTableHeader({
    label,
    sortKey,
    sort,
    onSort,
    className = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
    buttonClassName = "",
}: {
    label: string;
    sortKey: string;
    sort: TableSortState;
    onSort: (key: string) => void;
    className?: string;
    buttonClassName?: string;
}) {
    const active = sort.key === sortKey;
    const direction = active ? sort.direction : null;

    return (
        <th className={className} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={`inline-flex items-center gap-1.5 text-inherit hover:text-indigo-700 focus-visible:outline-none focus-visible:underline ${buttonClassName}`}
            >
                {label}
                <span aria-hidden="true" className="text-[10px] normal-case">
                    {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
                </span>
            </button>
        </th>
    );
}
