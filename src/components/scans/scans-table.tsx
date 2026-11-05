"use client";
"use no memo";

import {
  type ColumnDef,
  type Table as TanstackTable,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Search } from "lucide-react";
import { cn } from "~/lib/utils";

export type ScanRow = {
  id: string;
  hackerName: string;
  event: string;
  scanner: string;
  day: string;
  time: string;
  createdAt: Date | null;
};

const column = (
  key: keyof ScanRow,
  header: string,
  width: string,
  emphasis = false,
): ColumnDef<ScanRow> => ({
  accessorKey: key,
  header,
  meta: { width },
  cell: ({ row }) => (
    <span
      className={
        emphasis ? "text-dashboard-text-heavy" : "text-dashboard-text-light"
      }
    >
      {row.getValue<string>(key)}
    </span>
  ),
});

export const scansColumns: ColumnDef<ScanRow>[] = [
  column("hackerName", "Hacker Name", "w-[144px]", true),
  column("event", "Event", "w-[144px]", true),
  column("scanner", "Scanner", "w-[144px]"),
  column("day", "Day", "w-[84px]"),
  column("time", "Time", "w-[124px]"),
];

export interface ScanFilter {
  value: string;
  label: string;
}

interface ScansTableProps {
  scans: ScanRow[];
  isLoading?: boolean;
  filters?: ScanFilter[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function ScansTable({
  scans,
  isLoading = false,
  filters,
  activeFilter,
  onFilterChange,
  search,
  onSearchChange,
}: ScansTableProps) {
  const table = useReactTable({
    data: scans,
    columns: scansColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasFilters = filters !== undefined && filters.length > 0;
  const hasSearch = onSearchChange !== undefined;

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-6 font-figtree">
      {(hasFilters || hasSearch) && (
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
          {hasFilters && (
            <div
              role="group"
              aria-label="Filter scans"
              className="flex flex-wrap items-center gap-x-[60px] gap-y-2"
            >
              {filters.map((filter) => {
                const isActive = filter.value === activeFilter;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onFilterChange?.(filter.value)}
                    className={cn(
                      "rounded-dashboard-xs text-sm leading-default transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                      isActive
                        ? "cursor-pixel-default font-bold text-dashboard-text-heavy"
                        : "cursor-pixel-hover font-medium text-dashboard-text-light hover:text-dashboard-text-medium",
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          )}

          {hasSearch && (
            <div className="relative w-full md:ml-auto md:w-[276px]">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-dashboard-text-disabled"
              />
              <input
                type="search"
                aria-label="Search scans"
                value={search ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by name, activity, scanner"
                className={cn(
                  "w-full rounded-dashboard-sm bg-dashboard-bg-surface py-2 pl-[34px] pr-1 text-sm font-medium leading-default text-dashboard-text-heavy backdrop-blur-dashboard-input",
                  "placeholder:text-dashboard-text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                )}
              />
            </div>
          )}
        </div>
      )}

      {isLoading || scans.length === 0 ? (
        <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
          {isLoading ? "Loading scans..." : "No scans found"}
        </p>
      ) : (
        <ScansTableBody table={table} />
      )}
    </div>
  );
}

function ScansTableBody({ table }: { table: TanstackTable<ScanRow> }) {
  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[620px] font-figtree leading-default">
        <TableHeader className="[&_tr]:border-dashboard-border-faint">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-auto px-3 py-2 text-left text-xs font-semibold uppercase text-dashboard-text-light",
                    (header.column.columnDef.meta as { width?: string })?.width,
                  )}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-0 odd:bg-dashboard-bg-highlightSubtle hover:bg-dashboard-bg-highlight"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className="px-3 py-3 text-sm font-medium"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
