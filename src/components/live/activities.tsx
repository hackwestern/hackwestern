import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, type RouterOutputs } from "~/utils/api";
import { cn } from "~/lib/utils";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
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
import { formatEventTime } from "~/lib/date";
import {
  CELL,
  DISABLED,
  DeleteDialog,
  FIELD,
  LABEL,
  RowMenu,
  SearchBox,
  StatusName,
  errorText,
} from "~/components/live/manage-table";
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

// Phones show only Name and Date/Time; the rest opens in a row below
const COLUMNS = [
  { header: "Name", mobile: true },
  { header: "Type", mobile: false },
  { header: "Date/Time", mobile: true },
  { header: "Location", mobile: false },
  { header: "Points", mobile: false },
  { header: "Scans", mobile: false },
];

const typeLabel = (a: Activity) => {
  const label =
    ACTIVITY_TYPES.find((t) => t.value === a.type)?.label ?? "Other";
  return a.winPoints !== null ? `${label} (Winnable)` : label;
};

// datetime-local needs local "YYYY-MM-DDTHH:mm"
const toInputValue = (d: Date | null | undefined) => {
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
          <SearchBox
            label="Search activities"
            value={search}
            onChange={setSearch}
          />
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
                        <StatusName row={a} />
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
                        {a.startsAt && a.endsAt ? (
                          <>
                            {formatEventTime(a.startsAt, {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            –
                            {formatEventTime(a.endsAt, {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </>
                        ) : (
                          "----"
                        )}
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
                          row={a}
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

      <DeleteDialog
        name={deleting?.name}
        description="Existing scans and points for this activity will not be deleted."
        error={remove.error}
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate({ itemId: deleting.id })}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
      />
    </div>
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
  // An item with no set time has no start or end, and never shows as happening now
  const [timed, setTimed] = useState(
    activity ? activity.startsAt !== null : true,
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
  const endBeforeStart =
    timed && startsAt !== "" && endsAt !== "" && endsAt <= startsAt;
  const isDuplicateName = activities.some(
    (a) =>
      a.id !== activity?.id &&
      a.name.toLowerCase() === name.trim().toLowerCase(),
  );
  // Same rule as the server: a new or changed end time must be in the future
  const endInPast =
    timed &&
    endsAt !== "" &&
    endsAt !== toInputValue(activity?.endsAt) &&
    endsAt <= toInputValue(new Date());
  // An empty or non-whole-number points box would otherwise save as 0
  const isPoints = (v: string) => /^\d+$/.test(v.trim()) && Number(v) <= 32767;
  const pointsInvalid =
    !isPoints(points) || (isWinnable && !isPoints(winPoints));
  // Editing points also changes the balances of hackers who already scanned
  const newWinPoints = isWinnable ? Number(winPoints) : null;
  const attendanceChanged =
    !isNew && Number(points) !== activity.points && activity.scans > 0;
  const winChanged =
    !isNew && newWinPoints !== activity.winPoints && activity.winScans > 0;
  const affectsBalances = !pointsInvalid && (attendanceChanged || winChanged);
  const canSave =
    !pointsInvalid &&
    !endInPast &&
    name.trim() !== "" &&
    (!timed || (startsAt !== "" && endsAt !== "")) &&
    !endBeforeStart &&
    !isDuplicateName;

  const submit = (status?: "draft" | "active") =>
    save.mutate({
      id: activity?.id,
      type,
      name,
      startsAt: timed ? new Date(startsAt) : null,
      endsAt: timed ? new Date(endsAt) : null,
      room,
      points: Number(points),
      winPoints: newWinPoints,
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
                required={timed}
                disabled={!timed}
                className={cn(FIELD, DISABLED)}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>End</span>
              <input
                type="datetime-local"
                required={timed}
                disabled={!timed}
                className={cn(FIELD, DISABLED)}
                value={endsAt}
                min={startsAt || undefined}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <DashboardCheckbox
              checked={!timed}
              onCheckedChange={(c) => setTimed(c !== true)}
            />
            <span className={LABEL}>No set time</span>
          </label>
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
          {pointsInvalid && (
            <p className="text-sm text-dashboard-text-warning">
              Points must be a whole number from 0 to 32767.
            </p>
          )}
          {affectsBalances && (
            <p className="text-sm text-dashboard-text-warning">
              Hackers who already scanned this get the difference. Anyone who
              already spent their points can go below 0.
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
