import { Fragment, useState } from "react";
import { ChevronDown, MoreHorizontal, Search } from "lucide-react";
import { api, type RouterOutputs } from "~/utils/api";
import { cn } from "~/lib/utils";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
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
import { formatEventTime } from "~/lib/date";
type Activity = RouterOutputs["scavengerHunt"]["getScavengerHuntItems"][number];
type ActivityType = Activity["type"];

const ACTIVITY_TYPES: {
  value: ActivityType;
  label: string;
  filterLabel: string;
}[] = [
  { value: "meal", label: "Meal", filterLabel: "Meals" },
  { value: "workshop", label: "Workshop", filterLabel: "Workshops" },
  {
    value: "sponsor_workshop",
    label: "Sponsor Workshop",
    filterLabel: "Sponsor Workshops",
  },
  { value: "activity", label: "Activity", filterLabel: "Activities" },
  { value: "bonus", label: "Bonus", filterLabel: "Bonus" },
];

// Plain-language text for a failed tRPC call
const errorText = (error: {
  message: string;
  data?: { zodError?: unknown } | null;
}) =>
  error.data?.zodError
    ? "Check what you entered and try again."
    : error.message;

const FIELD =
  "h-10 w-full rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary disabled:opacity-dashboard-disabled";
const LABEL = "text-sm font-medium text-dashboard-text-medium";
const DISABLED =
  "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled";
const MENU_ITEM =
  "w-full cursor-pixel-hover rounded-dashboard-xs px-3 py-2 text-left text-sm font-medium text-dashboard-text-heavy hover:bg-dashboard-bg-highlight";

// Phones show only Name and Date/Time; the rest opens in a row below
const COLUMNS = [
  { header: "Name", mobile: true },
  { header: "Type", mobile: false },
  { header: "Date/Time", mobile: true },
  { header: "Location", mobile: false },
  { header: "Points", mobile: false },
  { header: "Scans", mobile: false },
];
const CELL = "px-2 py-3 text-sm font-medium md:px-3";

const typeLabel = (a: Activity) => {
  const label =
    ACTIVITY_TYPES.find((t) => t.value === a.type)?.label ?? "Other";
  return a.winPoints !== null ? `${label} (Winnable)` : label;
};

// datetime-local needs local "YYYY-MM-DDTHH:mm"
const toInputValue = (d: Date | undefined) => {
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const Activities = () => {
  const [filter, setFilter] = useState<ActivityType | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // Winnable rows show attendance points and scans unless switched to Win
  const [showWin, setShowWin] = useState(false);
  const [editing, setEditing] = useState<Activity | "new" | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);

  const utils = api.useUtils();
  const { data: activities, isLoading } =
    api.scavengerHunt.getScavengerHuntItems.useQuery();
  const invalidate = () =>
    utils.scavengerHunt.getScavengerHuntItems.invalidate();
  const setStatus = api.scavengerHunt.setActivityStatus.useMutation({
    onSuccess: invalidate,
  });
  // The confirm dialog stays open until the delete succeeds, so failures show in it
  const remove = api.scavengerHunt.deleteScavengerHuntItem.useMutation({
    onSuccess: () => {
      setDeleting(null);
      void invalidate();
    },
  });

  const query = search.trim().toLowerCase();
  const rows = (activities ?? []).filter(
    (a) =>
      (filter === "all" || a.type === filter) &&
      (!query || a.name.toLowerCase().includes(query)),
  );

  return (
    <div className="flex w-full flex-col gap-6 font-figtree md:min-h-0 md:flex-1">
      <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between">
        <div
          role="group"
          aria-label="Filter activities"
          className="flex flex-wrap gap-2"
        >
          <DashboardChip
            selected={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </DashboardChip>
          {ACTIVITY_TYPES.map((t) => (
            <DashboardChip
              key={t.value}
              selected={filter === t.value}
              onClick={() => setFilter(t.value)}
            >
              {t.filterLabel}
            </DashboardChip>
          ))}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <button
            type="button"
            role="switch"
            aria-checked={showWin}
            onClick={() => setShowWin((v) => !v)}
            className="inline-flex cursor-pixel-hover items-center gap-2 self-start whitespace-nowrap rounded-dashboard-sm text-sm font-medium text-dashboard-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 md:self-auto"
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                showWin
                  ? "bg-dashboard-action-primary"
                  : "bg-dashboard-border-default",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform duration-200 motion-reduce:transition-none",
                  showWin && "translate-x-4",
                )}
              />
            </span>
            Show for wins
          </button>
          <div className="relative w-full md:w-[276px]">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-dashboard-text-disabled md:size-3.5"
            />
            <input
              type="search"
              aria-label="Search activities"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="w-full rounded-dashboard-sm bg-dashboard-bg-surface py-3 pl-[38px] pr-1 text-base font-medium leading-default text-dashboard-text-heavy backdrop-blur-dashboard-input placeholder:text-dashboard-text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:py-2 md:pl-[34px] md:text-sm"
            />
          </div>
          <DashboardButton onClick={() => setEditing("new")}>
            New activity
          </DashboardButton>
        </div>
      </div>

      {setStatus.error && (
        <p
          role="alert"
          className="rounded-dashboard-sm bg-dashboard-bg-inset p-3 text-sm font-medium text-dashboard-text-warning"
        >
          Couldn&apos;t update the activity: {errorText(setStatus.error)}
        </p>
      )}

      {isLoading || rows.length === 0 ? (
        <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
          {isLoading ? "Loading activities..." : "No activities found"}
        </p>
      ) : (
        <div className="w-full overflow-x-auto md:min-h-0 md:flex-1 md:overflow-y-auto">
          <Table className="w-full font-figtree leading-default md:min-w-[720px]">
            <TableHeader className="md:sticky md:top-0 md:z-10 md:bg-dashboard-bg-page [&_tr]:border-dashboard-border-faint">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.header}
                    className={cn(
                      "h-auto px-2 py-2 text-left text-xs font-semibold uppercase text-dashboard-text-light md:px-3",
                      !column.mobile && "hidden md:table-cell",
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
                <TableHead className="w-0 px-0 md:hidden">
                  <span className="sr-only">Details</span>
                </TableHead>
                <TableHead className="w-0 px-2 md:px-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a, i) => {
                const isExpanded = expanded.has(a.id);
                const isWin = showWin && a.winPoints !== null;
                // Index-based stripes, because the details row breaks odd/even
                const stripe = i % 2 === 0 && "bg-dashboard-bg-highlightSubtle";
                const blue = isWin && "text-dashboard-action-primary";
                const details = [
                  ["Type", typeLabel(a)],
                  ["Location", a.room ?? "TBD"],
                  ["Points", String(isWin ? a.winPoints : a.points)],
                  ["Scans", String(isWin ? a.winScans : a.scans)],
                ] as const;
                return (
                  <Fragment key={a.id}>
                    <TableRow
                      className={cn(
                        "border-0 hover:bg-dashboard-bg-highlight",
                        stripe,
                      )}
                    >
                      <TableCell
                        className={cn(CELL, "text-dashboard-text-heavy", blue)}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              a.status === "disabled" &&
                                "text-dashboard-text-disabled line-through",
                            )}
                          >
                            {a.name}
                          </span>
                          {a.status !== "active" && (
                            <DashboardTag>
                              {a.status === "draft" ? "Draft" : "Disabled"}
                            </DashboardTag>
                          )}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          CELL,
                          "hidden text-dashboard-text-light md:table-cell",
                          blue,
                        )}
                      >
                        {typeLabel(a)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          CELL,
                          "whitespace-nowrap text-dashboard-text-light",
                          blue,
                        )}
                      >
                        {formatEventTime(a.startsAt, {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        –
                        {formatEventTime(a.endsAt, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      {details.slice(1).map(([label, value]) => (
                        <TableCell
                          key={label}
                          className={cn(
                            CELL,
                            "hidden text-dashboard-text-light md:table-cell",
                            blue,
                          )}
                        >
                          {value}
                        </TableCell>
                      ))}
                      <TableCell className="w-0 px-0 py-3 md:hidden">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Hide" : "Show"} details for ${a.name}`}
                          onClick={() => toggleExpanded(a.id)}
                          className="flex cursor-pixel-hover rounded-dashboard-xs p-1 text-dashboard-text-light hover:bg-dashboard-bg-nav hover:text-dashboard-text-heavy"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="w-0 px-2 py-3 md:px-3">
                        <RowMenu
                          activity={a}
                          onEdit={() => setEditing(a)}
                          onDelete={() => setDeleting(a)}
                          onToggleDisabled={() =>
                            setStatus.mutate({
                              id: a.id,
                              status:
                                a.status === "disabled" ? "active" : "disabled",
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className={cn("border-0 md:hidden", stripe)}>
                        <TableCell colSpan={4} className="px-2 pb-4 pt-3">
                          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                            {details.map(([label, value]) => (
                              <Fragment key={label}>
                                <dt className="text-xs font-semibold uppercase leading-5 text-dashboard-text-light">
                                  {label}
                                </dt>
                                <dd
                                  className={cn(
                                    "font-medium text-dashboard-text-light",
                                    blue,
                                  )}
                                >
                                  {value}
                                </dd>
                              </Fragment>
                            ))}
                          </dl>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <ActivityDialog
          activity={editing === "new" ? null : editing}
          activities={activities ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void invalidate();
          }}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (open) return;
          setDeleting(null);
          remove.reset();
        }}
      >
        <AlertDialogContent className="max-w-md rounded-dashboard-lg border-dashboard-border-default bg-dashboard-bg-surface font-figtree">
          <div className="flex flex-col gap-2">
            <AlertDialogTitle className="text-lg font-semibold text-dashboard-text-heavy">
              Delete {deleting?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-dashboard-text-light">
              Existing scans and points for this activity will not be deleted.
            </AlertDialogDescription>
          </div>
          {remove.error && (
            <p role="alert" className="text-sm text-dashboard-text-warning">
              {errorText(remove.error)}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <DashboardButton variant="neutral">Cancel</DashboardButton>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <DashboardButton
                variant="destructive"
                disabled={remove.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (deleting) remove.mutate({ itemId: deleting.id });
                }}
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </DashboardButton>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const RowMenu = ({
  activity,
  onEdit,
  onDelete,
  onToggleDisabled,
}: {
  activity: Activity;
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
        aria-label={`Actions for ${activity.name}`}
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
        {activity.status !== "draft" && (
          <button
            type="button"
            className={MENU_ITEM}
            onClick={run(onToggleDisabled)}
          >
            {activity.status === "disabled" ? "Enable" : "Disable"}
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

const ActivityDialog = ({
  activity,
  activities,
  onClose,
  onSaved,
}: {
  activity: Activity | null;
  activities: Activity[]; // Checked for a duplicate name before saving
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isNew = activity === null;
  const [name, setName] = useState(activity?.name ?? "");
  const [type, setType] = useState<ActivityType>(activity?.type ?? "meal");
  const [winnable, setWinnable] = useState(
    activity ? activity.winPoints !== null : false,
  );
  const [startsAt, setStartsAt] = useState(toInputValue(activity?.startsAt));
  const [endsAt, setEndsAt] = useState(toInputValue(activity?.endsAt));
  const [room, setRoom] = useState(activity?.room ?? "");
  const [points, setPoints] = useState(String(activity?.points ?? 0));
  const [winPoints, setWinPoints] = useState(String(activity?.winPoints ?? 0));

  const save = api.scavengerHunt.saveActivity.useMutation({
    onSuccess: onSaved,
  });
  const isWinnable = type === "activity" && winnable;

  // datetime-local strings have one format, so string order is time order
  const endBeforeStart = startsAt !== "" && endsAt !== "" && endsAt <= startsAt;
  const isDuplicateName = activities.some(
    (a) =>
      a.id !== activity?.id &&
      a.name.toLowerCase() === name.trim().toLowerCase(),
  );
  // Same rule as the server: a new or changed end time must be in the future
  const endInPast =
    endsAt !== "" &&
    endsAt !== toInputValue(activity?.endsAt) &&
    endsAt <= toInputValue(new Date());
  const canSave =
    !endInPast &&
    name.trim() !== "" &&
    startsAt !== "" &&
    endsAt !== "" &&
    !endBeforeStart &&
    !isDuplicateName;

  const submit = (status?: "draft" | "active") =>
    save.mutate({
      id: activity?.id,
      type,
      name,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      room,
      points: Number(points) || 0,
      winPoints: isWinnable ? Number(winPoints) || 0 : null,
      status,
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-dashboard-lg border-dashboard-border-default bg-dashboard-bg-surface font-figtree">
        <DialogTitle className="text-lg font-semibold text-dashboard-text-heavy">
          {isNew ? "New activity" : "Edit activity"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Set the name, type, time and room of the activity.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(
              activity?.status === "draft" || isNew ? "active" : undefined,
            );
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Name</span>
            <input
              required
              className={FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Dinner"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Type</span>
            {/* The native arrow ignores padding, so it is hidden and drawn here */}
            <span className="relative">
              <select
                className={cn(FIELD, "cursor-pixel-hover appearance-none pr-9")}
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-text-light"
              />
            </span>
          </label>
          {type === "activity" && (
            <label className="flex items-center gap-2">
              <DashboardCheckbox
                checked={winnable}
                onCheckedChange={(c) => setWinnable(c === true)}
              />
              <span className={LABEL}>
                Winnable (scan for attendance and for winners)
              </span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Start</span>
              <input
                type="datetime-local"
                required
                className={FIELD}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>End</span>
              <input
                type="datetime-local"
                required
                className={FIELD}
                value={endsAt}
                min={startsAt || undefined}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Room</span>
            <input
              className={FIELD}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Rm 1230"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>
                {isWinnable ? "Attendance points" : "Points"}
              </span>
              <input
                type="number"
                min={0}
                className={FIELD}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </label>
            {isWinnable && (
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Win points</span>
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={winPoints}
                  onChange={(e) => setWinPoints(e.target.value)}
                />
              </label>
            )}
          </div>

          {isDuplicateName && (
            <p className="text-sm text-dashboard-text-warning">
              An activity with this name already exists.
            </p>
          )}
          {endInPast && (
            <p className="text-sm text-dashboard-text-warning">
              End time must be in the future.
            </p>
          )}
          {endBeforeStart && (
            <p className="text-sm text-dashboard-text-warning">
              End time must be after start time.
            </p>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-dashboard-text-warning">
              {errorText(save.error)}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {(isNew || activity.status === "draft") && (
              <DashboardButton
                type="button"
                variant="outline"
                disabled={save.isPending || !canSave}
                className={DISABLED}
                onClick={() => submit("draft")}
              >
                Save as draft
              </DashboardButton>
            )}
            <DashboardButton
              type="submit"
              disabled={save.isPending || !canSave}
              className={DISABLED}
            >
              {isNew
                ? "Create"
                : activity.status === "draft"
                  ? "Publish"
                  : "Save"}
            </DashboardButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Activities;
