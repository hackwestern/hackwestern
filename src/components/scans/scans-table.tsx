"use client";

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

type ScanTextField = {
  [K in keyof ScanRow]: ScanRow[K] extends string ? K : never;
}[keyof ScanRow];

const SCAN_COLUMNS: {
  key: ScanTextField;
  header: string;
  width: string;
  emphasis?: boolean;
}[] = [
  {
    key: "hackerName",
    header: "Hacker Name",
    width: "w-[144px]",
    emphasis: true,
  },
  { key: "event", header: "Event", width: "w-[144px]", emphasis: true },
  { key: "scanner", header: "Scanner", width: "w-[144px]" },
  { key: "day", header: "Day", width: "w-[84px]" },
  { key: "time", header: "Time", width: "w-[124px]" },
];

export interface ScanFilter {
  value: string;
  label: string;
}

type FilterProps =
  | {
      filters: ScanFilter[];
      activeFilter: string;
      onFilterChange: (value: string) => void;
    }
  | {
      filters?: undefined;
      activeFilter?: undefined;
      onFilterChange?: undefined;
    };

type SearchProps =
  | { search: string; onSearchChange: (value: string) => void }
  | { search?: undefined; onSearchChange?: undefined };

type ScansTableProps = {
  scans: ScanRow[];
  isLoading?: boolean;
} & FilterProps &
  SearchProps;

export function ScansTable({
  scans,
  isLoading = false,
  filters,
  activeFilter,
  onFilterChange,
  search,
  onSearchChange,
}: ScansTableProps) {
  const showFilters =
    filters !== undefined && filters.length > 0 && onFilterChange !== undefined;
  const showSearch = search !== undefined && onSearchChange !== undefined;

  return (
    <div className="flex w-full flex-col gap-6 font-figtree">
      {(showFilters || showSearch) && (
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
          {showFilters && (
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
                    onClick={() => onFilterChange(filter.value)}
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

          {showSearch && (
            <div className="relative w-full md:ml-auto md:w-[276px]">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-dashboard-text-disabled"
              />
              <input
                type="search"
                aria-label="Search scans"
                value={search}
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
        <div className="w-full overflow-x-auto">
          <Table className="w-full min-w-[620px] font-figtree leading-default">
            <TableHeader className="[&_tr]:border-dashboard-border-faint">
              <TableRow className="hover:bg-transparent">
                {SCAN_COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "h-auto px-3 py-2 text-left text-xs font-semibold uppercase text-dashboard-text-light",
                      column.width,
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => (
                <TableRow
                  key={scan.id}
                  className="border-0 odd:bg-dashboard-bg-highlightSubtle hover:bg-dashboard-bg-highlight"
                >
                  {SCAN_COLUMNS.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "px-3 py-3 text-sm font-medium",
                        column.emphasis
                          ? "text-dashboard-text-heavy"
                          : "text-dashboard-text-light",
                      )}
                    >
                      {scan[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
