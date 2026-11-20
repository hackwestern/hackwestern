import { useState } from "react";
import { Check } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const FILTERS = [
  ["all", "All"],
  ["todo", "To do"],
  ["done", "Done"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const EMPTY_MESSAGE: Record<Filter, string> = {
  all: "No bonus tasks yet. Check back soon!",
  todo: "You've done every bonus task. Nice work!",
  done: "You haven't been scanned for any bonus tasks yet.",
};

const ScavengerHunt = ({ isOrganizer = false }: { isOrganizer?: boolean }) => {
  const [filter, setFilter] = useState<Filter>("all");
  // Poll so a task flips to done right after an organizer scans it
  const { data: tasks, isLoading } = api.scavengerHunt.getTasks.useQuery(
    undefined,
    { refetchInterval: isOrganizer ? false : 5000 },
  );

  const all = tasks ?? [];
  const done = all.filter((task) => task.scannedAt !== null);
  const earned = done.reduce((sum, task) => sum + task.points, 0);
  const possible = all.reduce((sum, task) => sum + task.points, 0);
  const shown = all.filter((task) =>
    filter === "all" ? true : (task.scannedAt !== null) === (filter === "done"),
  );
  // Organizers aren't scanned, so they only see the list itself
  const showProgress = !isOrganizer;

  return (
    <div className="flex w-full flex-col gap-6 font-figtree">
      <p className="text-sm font-medium leading-default text-dashboard-text-light md:text-base">
        These are <strong className="text-dashboard-text-heavy">bonus</strong>{" "}
        scavenger hunt tasks. Complete them around the venue and find an
        organizer to scan your hacker pass. Each one counts once. Meals,
        workshops and activities still earn points separately, and your full
        total is under Your Points on Home.
      </p>

      {showProgress && all.length > 0 && (
        <DashboardPanel className="gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase leading-default text-dashboard-text-light">
                Bonus tasks done
              </span>
              <span className="text-2xl font-bold leading-default text-dashboard-text-heavy">
                {done.length}
                <span className="text-base font-medium text-dashboard-text-light">
                  {" "}
                  / {all.length}
                </span>
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-semibold uppercase leading-default text-dashboard-text-light">
                Bonus points earned
              </span>
              <span className="text-2xl font-bold leading-default text-dashboard-action-primary">
                {earned}
                <span className="text-base font-medium text-dashboard-text-light">
                  {" "}
                  / {possible} pts
                </span>
              </span>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label="Bonus tasks done"
            aria-valuemin={0}
            aria-valuemax={all.length}
            aria-valuenow={done.length}
            className="h-2 w-full overflow-hidden rounded-full bg-dashboard-bg-inset"
          >
            <div
              className="h-full rounded-full bg-dashboard-action-primary transition-[width]"
              style={{ width: `${(done.length / all.length) * 100}%` }}
            />
          </div>
        </DashboardPanel>
      )}

      {showProgress && all.length > 0 && (
        <div
          role="group"
          aria-label="Filter tasks"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map(([value, label]) => (
            <DashboardChip
              key={value}
              selected={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              {value !== "all" &&
                ` (${value === "done" ? done.length : all.length - done.length})`}
            </DashboardChip>
          ))}
        </div>
      )}

      {isLoading || shown.length === 0 ? (
        <p className="rounded-dashboard-sm bg-dashboard-bg-inset p-5 text-sm font-medium italic leading-default text-dashboard-text-medium">
          {isLoading ? "Loading tasks..." : EMPTY_MESSAGE[filter]}
        </p>
      ) : (
        <Table className="w-full table-fixed font-figtree leading-default">
          <TableHeader className="[&_tr]:border-dashboard-border-faint">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto w-[76px] px-3 py-2 text-left text-xs font-semibold uppercase text-dashboard-text-light sm:w-[104px]">
                Points
              </TableHead>
              <TableHead className="h-auto px-3 py-2 text-left text-xs font-semibold uppercase text-dashboard-text-light">
                Task
              </TableHead>
              {showProgress && (
                <TableHead className="h-auto w-[52px] px-3 py-2 text-right text-xs font-semibold uppercase text-dashboard-text-light sm:w-[132px]">
                  <span className="sr-only sm:not-sr-only">Status</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((task) => {
              const isDone = showProgress && task.scannedAt !== null;
              return (
                <TableRow
                  key={task.id}
                  className={cn(
                    "border-0",
                    isDone
                      ? "bg-dashboard-bg-highlight hover:bg-dashboard-bg-highlight"
                      : "odd:bg-dashboard-bg-highlightSubtle hover:bg-dashboard-bg-highlightMedium",
                  )}
                >
                  <TableCell className="px-3 py-3 align-middle">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-dashboard-lg px-2 py-1 text-sm font-bold tabular-nums leading-default",
                        isDone
                          ? "bg-dashboard-bg-surface text-dashboard-text-light"
                          : "bg-dashboard-bg-nav text-dashboard-action-primary",
                      )}
                    >
                      {task.points} pts
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "break-words px-3 py-3 text-sm font-medium md:text-base",
                      isDone
                        ? "text-dashboard-text-light"
                        : "text-dashboard-text-heavy",
                    )}
                  >
                    {task.name}
                  </TableCell>
                  {showProgress && (
                    <TableCell className="px-3 py-3 text-right align-middle">
                      {isDone ? (
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-dashboard-lg bg-dashboard-status-live px-2 py-1 text-xs font-semibold leading-default text-dashboard-text-inverse"
                          title={`Scanned ${task.scannedAt!.toLocaleString(
                            "en-US",
                            {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}`}
                        >
                          <Check
                            aria-hidden="true"
                            className="size-3.5"
                            strokeWidth={3}
                          />
                          <span className="sr-only sm:not-sr-only">
                            Scanned
                          </span>
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-xs font-medium text-dashboard-text-light">
                          <span className="sr-only sm:not-sr-only">To do</span>
                        </span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default ScavengerHunt;
