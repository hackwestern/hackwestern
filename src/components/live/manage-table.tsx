import { useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

// Shared by the organizer Activities and Rewards tabs

type Status = "draft" | "active" | "disabled";
type Row = { name: string; status: Status };

// Plain-language text for a failed tRPC call
export const errorText = (error: {
  message: string;
  data?: { zodError?: unknown } | null;
}) =>
  error.data?.zodError
    ? "Check what you entered and try again."
    : error.message;

export const FIELD =
  "h-10 w-full rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary disabled:opacity-dashboard-disabled";
export const LABEL = "text-sm font-medium text-dashboard-text-medium";
export const DISABLED =
  "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled";
export const CELL = "px-2 py-3 text-sm font-medium md:px-3";
const MENU_ITEM =
  "w-full cursor-pixel-hover rounded-dashboard-xs px-3 py-2 text-left text-sm font-medium text-dashboard-text-heavy hover:bg-dashboard-bg-highlight";

export const SearchBox = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="relative w-full md:w-[276px]">
    <Search
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-dashboard-text-disabled md:size-3.5"
    />
    <input
      type="search"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by name"
      className="w-full rounded-dashboard-sm bg-dashboard-bg-surface py-3 pl-[38px] pr-1 text-base font-medium leading-default text-dashboard-text-heavy backdrop-blur-dashboard-input placeholder:text-dashboard-text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:py-2 md:pl-[34px] md:text-sm"
    />
  </div>
);

// The name, struck through when disabled or sold out, with a tag for each
export const StatusName = ({
  row,
  soldOut = false,
}: {
  row: Row;
  soldOut?: boolean;
}) => (
  <span className="flex flex-wrap items-center gap-2">
    <span
      className={cn(
        (row.status === "disabled" || soldOut) &&
          "text-dashboard-text-disabled line-through",
      )}
    >
      {row.name}
    </span>
    {row.status !== "active" && (
      <DashboardTag>
        {row.status === "draft" ? "Draft" : "Disabled"}
      </DashboardTag>
    )}
    {soldOut && <DashboardTag>Sold out</DashboardTag>}
  </span>
);

export const RowMenu = ({
  row,
  onEdit,
  onDelete,
  onToggleDisabled,
}: {
  row: Row;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDisabled: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Actions for ${row.name}`}
        className="flex cursor-pixel-hover rounded-dashboard-xs p-1 text-dashboard-text-light hover:bg-dashboard-bg-nav hover:text-dashboard-text-heavy"
      >
        <MoreHorizontal className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex w-36 flex-col p-1 font-figtree"
      >
        <button type="button" className={MENU_ITEM} onClick={run(onEdit)}>
          Edit
        </button>
        {row.status !== "draft" && (
          <button
            type="button"
            className={MENU_ITEM}
            onClick={run(onToggleDisabled)}
          >
            {row.status === "disabled" ? "Enable" : "Disable"}
          </button>
        )}
        <button
          type="button"
          className={cn(MENU_ITEM, "text-dashboard-text-warning")}
          onClick={run(onDelete)}
        >
          Delete
        </button>
      </PopoverContent>
    </Popover>
  );
};

// Stays open until the delete succeeds, so failures show in it
export const DeleteDialog = ({
  name,
  description,
  error,
  isPending,
  onConfirm,
  onClose,
}: {
  name: string | undefined; // Undefined closes the dialog
  description: string;
  error: { message: string; data?: { zodError?: unknown } | null } | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <AlertDialog
    open={name !== undefined}
    onOpenChange={(open) => !open && onClose()}
  >
    <AlertDialogContent className="max-w-md rounded-dashboard-lg border-dashboard-border-default bg-dashboard-bg-surface font-figtree">
      <div className="flex flex-col gap-2">
        <AlertDialogTitle className="text-lg font-semibold text-dashboard-text-heavy">
          Delete {name}?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-sm text-dashboard-text-light">
          {description}
        </AlertDialogDescription>
      </div>
      {error && (
        <p role="alert" className="text-sm text-dashboard-text-warning">
          {errorText(error)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
        <AlertDialogPrimitive.Cancel asChild>
          <DashboardButton variant="neutral">Cancel</DashboardButton>
        </AlertDialogPrimitive.Cancel>
        <AlertDialogPrimitive.Action asChild>
          <DashboardButton
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? "Deleting…" : "Delete"}
          </DashboardButton>
        </AlertDialogPrimitive.Action>
      </div>
    </AlertDialogContent>
  </AlertDialog>
);
