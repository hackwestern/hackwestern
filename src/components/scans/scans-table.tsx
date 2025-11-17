"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/data-table";

export type ScanRow = {
  id: string;
  hackerName: string;
  event: string;
  scanner: string;
  day: string;
  time: string;
  createdAt: Date | null;
};

export const scansColumns: ColumnDef<ScanRow>[] = [
  {
    accessorKey: "hackerName",
    header: () => (
      <div
        className="font-figtree text-xs font-medium uppercase tracking-wider"
        style={{ color: "#dcd8de" }}
      >
        HACKER NAME
      </div>
    ),
    cell: ({ row }) => (
      <div className="font-figtree text-sm font-bold text-heavy">
        {row.getValue("hackerName")}
      </div>
    ),
  },
  {
    accessorKey: "event",
    header: () => (
      <div
        className="font-figtree text-xs font-medium uppercase tracking-wider"
        style={{ color: "#dcd8de" }}
      >
        EVENT
      </div>
    ),
    cell: ({ row }) => (
      <div className="font-figtree text-sm font-bold text-heavy">
        {row.getValue("event")}
      </div>
    ),
  },
  {
    accessorKey: "scanner",
    header: () => (
      <div
        className="font-figtree text-xs font-medium uppercase tracking-wider"
        style={{ color: "#dcd8de" }}
      >
        SCANNER
      </div>
    ),
    cell: ({ row }) => (
      <div className="font-figtree text-sm text-heavy">
        {row.getValue("scanner")}
      </div>
    ),
  },
  {
    accessorKey: "day",
    header: () => (
      <div
        className="font-figtree text-xs font-medium uppercase tracking-wider"
        style={{ color: "#dcd8de" }}
      >
        DAY
      </div>
    ),
    cell: ({ row }) => (
      <div className="font-figtree text-sm text-heavy">
        {row.getValue("day")}
      </div>
    ),
  },
  {
    accessorKey: "time",
    header: () => (
      <div
        className="font-figtree text-xs font-medium uppercase tracking-wider"
        style={{ color: "#dcd8de" }}
      >
        TIME
      </div>
    ),
    cell: ({ row }) => (
      <div className="font-figtree text-sm text-heavy">
        {row.getValue("time")}
      </div>
    ),
  },
];

interface ScansTableProps {
  scans: ScanRow[];
  isLoading?: boolean;
}

export function ScansTable({ scans, isLoading }: ScansTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-8 shadow-md">
        <div className="text-center font-figtree text-medium">
          Loading scans...
        </div>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 shadow-md">
        <div className="text-center font-figtree text-medium">
          No scans found
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white">
      <div className="overflow-x-auto">
        <div className="[&_table]:cursor-default [&_table]:border-0 [&_table]:outline-none [&_table]:ring-0 [&_tbody_tr:nth-child(odd)]:bg-[#f5f2f6] [&_tbody_tr]:border-0 [&_td]:cursor-default [&_td]:border-0 [&_th]:cursor-default [&_th]:border-0 [&_thead]:bg-white [&_thead_tr]:border-0 [&_tr]:cursor-default [&_tr]:border-0">
          <DataTable columns={scansColumns} data={scans} />
        </div>
      </div>
    </div>
  );
}
