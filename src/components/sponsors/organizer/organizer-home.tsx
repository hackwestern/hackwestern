import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CircleCheck,
  Coffee,
  ExternalLink,
  Gavel,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { hover, press } from "~/components/internals/interaction";
import { DayGrid } from "~/components/sponsors/day-grid";
import { SponsorLogo } from "~/components/sponsors/organizer/day-cells";
import {
  Pill,
  type MySponsorData,
} from "~/components/sponsors/organizer/my-sponsors";
import { PrimaryCrownIcon } from "~/components/sponsors/organizer/primary-crown";
import {
  RunOfShowExtras,
  type OrganizerSchedule,
} from "~/components/sponsors/organizer/run-of-show-tab";
import { CopyLinkButton } from "~/components/sponsors/organizer/sponsors-tab";
import { useSponsorWrites } from "~/components/sponsors/organizer/use-sponsor-writes";
import { PhoneCopy } from "~/components/sponsors/phone-copy";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import {
  applies,
  boardCount,
  dayStarted,
  doneColumns,
  eventToday,
  flagsFor,
  HOME_COLUMNS,
  isDone,
  minutesInto,
  sponsorFlags,
  sponsorsOnDay,
  upNext,
  type HomeColumnKey,
  type HomeFlag,
  type HomeSponsor,
} from "~/lib/organizer-home";
import {
  formatClock,
  RUN_OF_SHOW_DAYS,
  type RunOfShowDay,
} from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { round1State } from "~/lib/sponsor-day-board";
import {
  contactRowsNamed,
  leadsSponsor,
  organizerHomeHref,
  pillDone,
  statusAfterPill,
  type OrganizerContact,
  type SponsorSummary,
} from "~/lib/sponsor-organizer";
import { hasPrizeTrack, isDigitalJudging } from "~/lib/sponsor-prize-tracks";
import { buildOrganizerTimeline, taskEntries } from "~/lib/sponsor-timeline";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

const copy = sponsorOrganizerCopy.home;

type SheetSponsor = RouterOutputs["sponsorDashboard"]["getSponsors"][number];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";

/** "6:12 PM" (Eastern), with the weekday when it isn't `day`. */
function timeOf(at: string | Date, day?: RunOfShowDay): string {
  const d = new Date(at);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/Toronto",
  }).format(d);
  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(d);
  return day && weekday !== day ? `${weekday.slice(0, 3)} ${clock}` : clock;
}

/** Minutes after midnight → "1:30 PM". */
function clockOf(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return formatClock(`${h}:${m}`);
}

/** "10–11" for an hour block, "1:30–2:30" otherwise (no AM/PM). */
function spanOf(start: number, end: number): string {
  const short = (m: number) => {
    const h = Math.floor(m / 60) % 12 || 12;
    const mm = m % 60;
    return mm ? `${h}:${String(mm).padStart(2, "0")}` : `${h}`;
  };
  return `${short(start)}–${short(end)}`;
}

/** "HH:MM" minus `minutes`, as a clock. */
function before(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return clockOf(h * 60 + m - minutes);
}

/** A Home row: the sponsor plus the sheet fields the details show. */
type Row = HomeSponsor & {
  hwContact: string;
  companyContact: string;
  boothLocation: string;
  notes: string;
  fromSheet: boolean;
  reps: MySponsorData["reps"];
  summary: SponsorSummary | undefined;
  judgingRoom: string | null;
  workshopRooms: (string | null)[];
};

/**
 * The organizer Home (mock organizer-sponsors-home-v3, decisions 2026-11-19):
 * Fri · Sat · Sun tabs (opens on today), Your sponsors / All sponsors, Up
 * next, your day (the run of show grid), and that day's sponsor table with
 * only its columns, amber flags in the cell they belong to, and "All done"
 * chips for finished columns. A sponsor's name opens its contacts and
 * package. Coffee chats and judging are tools (the board buttons).
 */
export function OrganizerHome({
  now,
  me,
  contactNames,
  contactsError,
  sheet,
  sheetFailed,
  summaries,
  mine,
  schedule,
  scheduleFailed,
  round2Open,
  prizeTracks,
  view,
  onView,
}: {
  now: Date;
  me: OrganizerContact | null;
  contactNames: readonly string[];
  contactsError: boolean;
  /** Sponsor Day-Of rows; undefined while loading or when unread. */
  sheet: readonly SheetSponsor[] | undefined;
  sheetFailed: boolean;
  summaries: ReadonlyMap<string, SponsorSummary>;
  mine: Record<string, MySponsorData> | undefined;
  schedule: OrganizerSchedule | undefined;
  scheduleFailed: boolean;
  round2Open: boolean;
  /** The Judging board's prize track list; undefined = the built-in one. */
  prizeTracks?: readonly string[];
  view: "mine" | "all";
  onView: (view: "mine" | "all") => void;
}) {
  const today = eventToday(now);
  const [picked, setPicked] = useState<RunOfShowDay | null>(null);
  // Today, else Friday before the event and Sunday after it.
  const day: RunOfShowDay = picked ?? today ?? defaultRunOfShowDay(now);
  const writes = useSponsorWrites();
  const utils = api.useUtils();
  const sync = api.sponsorDashboard.syncSponsors.useMutation({
    onSuccess: async (registered) => {
      writes.setNote({
        tone: "ok",
        text: sponsorOrganizerCopy.board.synced(registered.length),
      });
      await Promise.all([
        utils.sponsorDashboard.getSponsors.invalidate(),
        utils.sponsorOrganizer.summary.invalidate(),
      ]);
    },
    onError: (error) => {
      writes.setNote({
        tone: "error",
        text: sponsorOrganizerCopy.board.syncFailed(error.message),
      });
    },
  });

  // Every sponsor, from the sheet when it loaded, else from the database.
  const rows = useMemo<Row[]>(() => {
    const base: {
      name: string;
      sponsorId: string | null;
      status: string | null;
      atCcWorkshop: boolean | null;
      hwContact: string;
      companyContact: string;
      boothLocation: string;
      notes: string;
      /** Sponsor Day-Of "In person / Digital" = Digital. */
      sheetDigital: boolean;
      fromSheet: boolean;
    }[] = sheet
      ? sheet.map((s) => ({
          name: s.name,
          sponsorId: s.sponsorId,
          status: s.status,
          atCcWorkshop: s.atCcWorkshop,
          hwContact: s.hwContact,
          companyContact: s.companyContact,
          boothLocation: s.boothLocation,
          notes: s.notes,
          sheetDigital: s.digital,
          fromSheet: true,
        }))
      : [...summaries.values()]
          .map((s) => ({
            name: s.name,
            sponsorId: s.sponsorId,
            status: null,
            atCcWorkshop: null,
            hwContact: "",
            companyContact: "",
            boothLocation: "",
            notes: "",
            sheetDigital: false,
            fromSheet: false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
    const workshops = schedule?.workshops ?? [];
    return base.map(({ sheetDigital, ...b }) => {
      const summary = b.sponsorId
        ? summaries.get(b.sponsorId.toLowerCase())
        : undefined;
      const data = b.sponsorId ? mine?.[b.sponsorId] : undefined;
      const theirs = workshops.filter(
        (w) =>
          w.sponsor?.toLowerCase() === b.name.toLowerCase() && w.day && w.start,
      );
      return {
        ...b,
        chats: data?.chats,
        // Loaded with no chat progress = not signed up for chats.
        noChats: !!data && !data.chats,
        blocks: data?.blocks ?? [],
        reps: data?.reps ?? [],
        sunday: summary?.sunday,
        missingRoom: summary?.judging?.missingRoom ?? false,
        judgingRoom: summary?.judging?.room ?? null,
        workshops: theirs.map((w) => ({
          day: w.day!,
          start: w.start!,
          end: null,
        })),
        workshopRooms: theirs.map((w) => w.room),
        prizeTrack: hasPrizeTrack(b.name, prizeTracks),
        // Digital on the sheet (not on site: no arrival, booth or chats),
        // or a digital prize track sponsor (judging).
        digital: sheetDigital || isDigitalJudging(b.name),
        summary,
      };
    });
  }, [sheet, summaries, mine, schedule?.workshops, prizeTracks]);

  const isMine = (r: Row) =>
    !!me && leadsSponsor(r.hwContact, me, contactNames);
  const led = rows.filter(isMine);
  const shown = sponsorsOnDay(day, view === "mine" ? led : rows);
  const allOnDay = sponsorsOnDay(day, rows);
  const started = dayStarted(day, now);
  const flagCount = shown.reduce(
    (n, s) => n + sponsorFlags(s, day, now).length,
    0,
  );
  const done = doneColumns(day, shown, now);
  const [unhidden, setUnhidden] = useState<ReadonlySet<string>>(new Set());
  const columns = HOME_COLUMNS[day].filter(
    (c) => !done.has(c) || unhidden.has(`${day}:${c}`),
  );
  const chips = HOME_COLUMNS[day].filter(
    (c) => done.has(c) && !unhidden.has(`${day}:${c}`),
  );
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isMyTask = (owner: string | null) =>
    !!me && contactRowsNamed(owner, contactNames).has(me.row);
  const next = schedule
    ? upNext(day, schedule.tasks, now, me ? isMyTask : (o) => !!o)
    : null;
  const ledNames = led.map((r) => r.name);
  const board = day === "Sunday" ? "judging" : "coffee";
  const count = boardCount(day, allOnDay, now, round2Open);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 font-figtree text-3xl font-semibold text-dashboard-text-heavy">
          {copy.title}
        </h1>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {me
            ? me.ownName
              ? copy.signedInWithView(me.ownName, me.name, ledNames)
              : copy.signedIn(me.name, ledNames)
            : copy.noMatch}
        </p>
        {!me && contactsError && (
          <p
            role="status"
            className="m-0 flex items-center gap-2 text-sm font-semibold text-dashboard-text-warning"
          >
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {sponsorOrganizerCopy.mine.contactsError}
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayTabs day={day} today={today} onPick={setPicked} />
        <div className="flex flex-wrap items-center gap-2">
          <DashboardButton
            variant="outline"
            disabled={sync.isPending}
            onClick={() => {
              writes.setNote(null);
              sync.mutate();
            }}
            className={cn("h-11 md:h-10", press)}
          >
            <RefreshCw
              aria-hidden
              className={cn(sync.isPending && "motion-safe:animate-spin")}
            />
            {sync.isPending
              ? sponsorOrganizerCopy.board.syncing
              : sponsorOrganizerCopy.board.sync}
          </DashboardButton>
          {me && (
            <div
              role="group"
              aria-label={copy.viewLabel}
              className="inline-flex rounded-full border border-dashboard-border-default bg-dashboard-bg-surface p-0.5"
            >
              {(["mine", "all"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => onView(v)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold md:min-h-9",
                    press,
                    focusRing,
                    view === v
                      ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                      : cn("text-dashboard-text-medium", hover.highlight),
                  )}
                >
                  {v === "mine" ? copy.yours : copy.all}
                  <span className="tabular-nums opacity-80">
                    {v === "mine"
                      ? sponsorsOnDay(day, led).length
                      : allOnDay.length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <UpNextCard day={day} next={next} failed={scheduleFailed} />

      {schedule && (
        <section aria-labelledby="your-day" className="min-w-0">
          <DayGrid
            mode="organizer"
            day={day}
            now={now}
            headerStart={
              <h2
                id="your-day"
                className="m-0 text-lg font-semibold text-dashboard-text-heavy"
              >
                {me ? copy.yourDay : copy.yourDayNoMatch}
              </h2>
            }
            entries={[
              ...buildOrganizerTimeline({
                day,
                items: schedule.items,
                live: undefined,
                showHackathon: false,
              }),
              ...taskEntries(day, schedule.tasks),
            ]}
            workshops={schedule.workshops}
            tasks={schedule.tasks}
          />
        </section>
      )}

      <section
        aria-labelledby="sponsors-on-day"
        className="flex min-w-0 flex-col gap-4 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="sponsors-on-day"
            className="m-0 text-lg font-semibold text-dashboard-text-heavy"
          >
            {copy.sponsorsOn(view === "mine" && !!me, day)}
          </h2>
          {day !== "Sunday" || allOnDay.some((s) => s.prizeTrack) ? (
            <DashboardButton
              asChild
              // Wraps on phones so the count never runs out of the card.
              className="h-auto min-h-11 flex-wrap justify-center gap-x-2.5 gap-y-1 py-2 md:h-11 md:flex-nowrap md:py-0"
            >
              <Link
                href={organizerHomeHref({ tab: board })}
                shallow
                scroll={false}
              >
                {board === "coffee" ? (
                  <Coffee aria-hidden className="size-5" />
                ) : (
                  <Gavel aria-hidden className="size-5" />
                )}
                {board === "coffee" ? copy.board.coffee : copy.board.judging}
                {count > 0 && (
                  <span className="whitespace-nowrap rounded-full bg-dashboard-text-inverse/20 px-2 py-0.5 text-sm tabular-nums">
                    {board === "coffee"
                      ? copy.board.coffeeCount(count)
                      : copy.board.judgingCount(count)}
                  </span>
                )}
              </Link>
            </DashboardButton>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            role="status"
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-dashboard-md px-3 text-sm font-semibold",
              !started
                ? "bg-dashboard-bg-inset text-dashboard-text-medium"
                : flagCount > 0
                  ? "bg-dashboard-schedule-orange text-dashboard-text-warning"
                  : "bg-dashboard-schedule-green text-dashboard-text-heavy",
            )}
          >
            {started && flagCount > 0 && (
              <TriangleAlert aria-hidden className="size-4" />
            )}
            {started && flagCount === 0 && (
              <CircleCheck
                aria-hidden
                className="size-4 text-dashboard-status-live"
              />
            )}
            {!started
              ? copy.count.notStarted(day)
              : flagCount > 0
                ? copy.count.things(flagCount)
                : copy.count.clear(view === "mine" && !!me)}
          </span>
          <span className="text-xs text-dashboard-text-light">
            {copy.countHint}
          </span>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() =>
                  setUnhidden((prev) => new Set(prev).add(`${day}:${c}`))
                }
                aria-label={copy.doneChipShow(copy.columns[c])}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashboard-status-live bg-dashboard-schedule-green px-3 text-xs font-semibold text-dashboard-text-heavy",
                  press,
                  focusRing,
                )}
              >
                <CircleCheck
                  aria-hidden
                  className="size-3.5 text-dashboard-status-live"
                />
                {copy.doneChip(copy.columns[c])}
              </button>
            ))}
          </div>
        )}

        {writes.note && (
          <p
            role={writes.note.tone === "error" ? "alert" : "status"}
            className="m-0 text-sm font-semibold text-dashboard-text-warning"
          >
            {writes.note.text}
          </p>
        )}
        {sheetFailed && !sheet && (
          <p role="status" className="m-0 text-sm text-dashboard-text-warning">
            {copy.loadFailed}
          </p>
        )}

        {!sheet && !sheetFailed && rows.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.loading}
          </p>
        ) : shown.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-medium">
            {view === "mine" && me ? copy.noneLed : copy.noSponsors}
          </p>
        ) : (
          <SponsorTable
            day={day}
            now={now}
            rows={shown as Row[]}
            columns={columns}
            open={open}
            onToggle={toggle}
            me={me}
            contactNames={contactNames}
            writes={writes}
          />
        )}
      </section>

      {schedule && <RunOfShowExtras data={schedule} day={day} />}
    </div>
  );
}

function DayTabs({
  day,
  today,
  onPick,
}: {
  day: RunOfShowDay;
  today: RunOfShowDay | null;
  onPick: (d: RunOfShowDay) => void;
}) {
  return (
    <div
      role="group"
      aria-label={copy.daysLabel}
      className="inline-flex gap-0.5 rounded-dashboard-lg bg-dashboard-bg-nav p-1"
    >
      {RUN_OF_SHOW_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={d === day}
          onClick={() => onPick(d)}
          className={cn(
            "flex min-h-11 min-w-16 flex-col items-center justify-center rounded-dashboard-md px-3 py-1 leading-tight",
            press,
            focusRing,
            d === day
              ? "bg-dashboard-bg-surface shadow-dashboard-card"
              : hover.highlight,
          )}
        >
          <span className="text-sm font-semibold text-dashboard-text-heavy">
            {copy.dayShort[d]}
          </span>
          <span
            className={cn(
              "text-xs",
              d === today
                ? "font-semibold text-dashboard-text-active"
                : "text-dashboard-text-light",
            )}
          >
            {d === today ? copy.today : copy.dayDate[d]}
          </span>
        </button>
      ))}
    </div>
  );
}

function UpNextCard({
  day,
  next,
  failed,
}: {
  day: RunOfShowDay;
  next: ReturnType<typeof upNext> | null;
  failed: boolean;
}) {
  const u = copy.upNext;
  return (
    <section
      aria-label={u.label}
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-dashboard-lg border-l-4 border-dashboard-action-primary bg-dashboard-bg-surface px-4 py-3 shadow-dashboard-card"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-dashboard-text-active">
        {u.label}
      </span>
      {!next ? (
        <span className="text-sm text-dashboard-text-light">
          {failed ? u.loadError : sponsorOrganizerCopy.board.loading}
        </span>
      ) : next.kind === "next" ? (
        <>
          <span className="text-base font-semibold text-dashboard-text-heavy">
            <span className="tabular-nums">{formatClock(next.task.start)}</span>{" "}
            {next.task.task}
          </span>
          <span className="rounded-full bg-dashboard-bg-highlight px-2 py-0.5 text-xs font-semibold text-dashboard-text-active">
            {u.inMinutes(next.minutes)}
          </span>
        </>
      ) : next.kind === "first" ? (
        <span className="text-base font-semibold text-dashboard-text-heavy">
          {u.first(day, formatClock(next.task.start), next.task.task)}
        </span>
      ) : next.kind === "over" ? (
        <span className="text-sm text-dashboard-text-medium">
          {u.over(day)}
        </span>
      ) : (
        <span className="text-sm text-dashboard-text-medium">
          {u.none(day)}
        </span>
      )}
    </section>
  );
}

type Writes = ReturnType<typeof useSponsorWrites>;

function SponsorTable({
  day,
  now,
  rows,
  columns,
  open,
  onToggle,
  me,
  contactNames,
  writes,
}: {
  day: RunOfShowDay;
  now: Date;
  rows: Row[];
  columns: HomeColumnKey[];
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
  me: OrganizerContact | null;
  contactNames: readonly string[];
  writes: Writes;
}) {
  const keyOf = (r: Row) => r.sponsorId ?? r.name;
  const cell = (col: HomeColumnKey, r: Row) => (
    <Cell col={col} row={r} day={day} now={now} writes={writes} />
  );
  /**
   * The sponsor's portal, one tap from the table (Jazz, 2026-11-19): an
   * icon link beside the name. Copy link stays in the details.
   */
  const portalLink = (r: Row) =>
    r.sponsorId ? (
      <a
        href={`/sponsors/${r.sponsorId}`}
        target="_blank"
        rel="noreferrer"
        aria-label={sponsorOrganizerCopy.board.openPage(r.name)}
        title={sponsorOrganizerCopy.board.openPage(r.name)}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-md text-dashboard-text-light md:size-8",
          hover.highlightSubtle,
          press,
          focusRing,
        )}
      >
        <ExternalLink aria-hidden className="size-4" />
      </a>
    ) : null;
  const nameWithLink = (r: Row, panel: string) => (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1">{nameButton(r, panel)}</div>
      {portalLink(r)}
    </div>
  );
  const nameButton = (r: Row, panel: string) => {
    const flags = sponsorFlags(r, day, now).length;
    const isOpen = open.has(keyOf(r));
    return (
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panel}
        onClick={() => onToggle(keyOf(r))}
        className={cn(
          "-m-1.5 flex w-full items-start gap-2 rounded-dashboard-md p-1.5 text-left",
          press,
          focusRing,
          hover.highlightSubtle,
        )}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0 text-dashboard-text-light transition-transform duration-150 ease-out motion-reduce:transition-none",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <SponsorLogo name={r.name} />
            <span className="min-w-0 break-words font-semibold text-dashboard-text-heavy">
              {r.name}
            </span>
          </span>
          {flags > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-dashboard-text-warning">
              <TriangleAlert aria-hidden className="size-3.5" />
              {copy.toFix(flags)}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      {/*
       * Under 1024px: one compact row per sponsor, the day's fields as
       * label | value lines, so nothing scrolls sideways (Jazz, 2026-11-20).
       * Two per row from 640px.
       */}
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:hidden">
        {rows.map((r) => {
          const panel = `home-details-m-${keyOf(r)}`;
          const flagged = sponsorFlags(r, day, now).length > 0;
          return (
            <li
              key={keyOf(r)}
              data-sponsor={r.name}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-dashboard-lg border border-dashboard-border-subtle p-3",
                flagged && "border-l-4 border-l-dashboard-status-warning",
              )}
            >
              {nameWithLink(r, panel)}
              <dl className="m-0 flex flex-col divide-y divide-dashboard-border-subtle text-sm">
                {columns.map((col) => (
                  <div
                    key={col}
                    className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-start gap-x-3 py-1.5"
                  >
                    <dt className="pt-0.5 text-xs text-dashboard-text-light">
                      {copy.columns[col]}
                    </dt>
                    <dd className="m-0 min-w-0">{cell(col, r)}</dd>
                  </div>
                ))}
              </dl>
              {open.has(keyOf(r)) && (
                <div
                  id={panel}
                  className="border-t border-dashboard-border-subtle pt-3"
                >
                  <Details
                    row={r}
                    day={day}
                    me={me}
                    contactNames={contactNames}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/*
       * 1024px and up: a fixed-layout table that fits the card (no sideways
       * scroll at 1280px); long values wrap inside their column.
       */}
      <div className="hidden overflow-hidden rounded-dashboard-lg border border-dashboard-border-subtle lg:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{copy.tableLabel(day)}</caption>
          <thead>
            <tr className="bg-dashboard-bg-inset text-xs font-semibold text-dashboard-text-heavy">
              <th
                scope="col"
                className="w-40 border-b border-dashboard-border-subtle bg-dashboard-bg-inset px-2 py-2.5 xl:w-52 xl:px-2.5"
              >
                {copy.sponsor}
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="border-b border-dashboard-border-subtle px-2 py-2.5 align-bottom xl:px-2.5"
                >
                  {copy.columns[col]}
                  {copy.columnSub[col] && (
                    <span className="block font-medium text-dashboard-text-light">
                      {copy.columnSub[col]}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const panel = `home-details-${keyOf(r)}`;
              const isOpen = open.has(keyOf(r));
              const flagged = sponsorFlags(r, day, now).length > 0;
              const td = cn(
                "border-b border-dashboard-border-subtle px-2 py-3 align-top xl:px-2.5",
                isOpen && "border-b-0",
              );
              return (
                <Fragment key={keyOf(r)}>
                  <tr data-sponsor={r.name}>
                    <th
                      scope="row"
                      className={cn(
                        td,
                        "bg-dashboard-bg-surface font-normal",
                        flagged &&
                          "border-l-4 border-l-dashboard-status-warning",
                      )}
                    >
                      {nameWithLink(r, panel)}
                    </th>
                    {columns.map((col) => (
                      <td key={col} className={td}>
                        {cell(col, r)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr id={panel}>
                      <td
                        colSpan={columns.length + 1}
                        className="border-b border-dashboard-border-subtle bg-dashboard-bg-highlightSubtle px-4 pb-4 pt-2"
                      >
                        <Details
                          row={r}
                          day={day}
                          me={me}
                          contactNames={contactNames}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-dashboard-text-light">{children}</span>;
}

/** An amber flag inside its cell, linking to where it's fixed. */
function Flag({
  flag,
  sponsorId,
}: {
  flag: HomeFlag;
  sponsorId: string | null;
}) {
  const f = copy.flags;
  const text =
    flag.kind === "emptyBlocks"
      ? f.emptyBlocks(flag.count, flag.first.rep, clockOf(flag.first.start))
      : f[flag.kind];
  const tab =
    flag.kind === "notHere"
      ? null
      : ["shortlistLate", "noRoom", "topLate"].includes(flag.kind)
        ? ("judging" as const)
        : ("coffee" as const);
  const body = (
    <>
      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{text}</span>
    </>
  );
  const cls =
    "mt-1.5 flex items-start gap-1.5 rounded-dashboard-md bg-dashboard-schedule-orange px-2 py-1.5 text-xs font-semibold text-dashboard-text-warning";
  return tab ? (
    <Link
      href={organizerHomeHref({ tab, sponsor: sponsorId })}
      shallow
      scroll={false}
      className={cn(cls, focusRing, hover.underline)}
    >
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function Cell({
  col,
  row: r,
  day,
  now,
  writes,
}: {
  col: HomeColumnKey;
  row: Row;
  day: RunOfShowDay;
  now: Date;
  writes: Writes;
}) {
  if (!applies(col, r)) return <Muted>{copy.none}</Muted>;
  const c = copy.cell;
  const flags = flagsFor(col, r, day, now);
  const busy = writes.pending(r.name);
  const pillLabel = sponsorOrganizerCopy.mine.attrs;
  const pillStates = sponsorOrganizerCopy.mine.pill;
  const status = r.status;
  const nowMin = minutesInto("Saturday", now);

  let content: React.ReactNode;
  switch (col) {
    case "arrived":
      content =
        status === null ? (
          <Muted>{sponsorOrganizerCopy.day.noSheet}</Muted>
        ) : (
          <Pill
            label={pillLabel.arrival}
            sponsor={r.name}
            states={pillStates.arrival}
            done={pillDone("arrival", status)}
            busy={busy}
            onToggle={() =>
              writes.changeStatus(
                r.name,
                statusAfterPill(
                  "arrival",
                  pillDone("arrival", status) ? "undo" : "advance",
                ),
              )
            }
          />
        );
      break;
    case "booth":
      content = (
        <span className="flex flex-col items-start gap-1.5">
          <span>
            {r.boothLocation && r.boothLocation !== "TBD"
              ? r.boothLocation
              : c.boothTbd}
          </span>
          {status !== null && (
            <Pill
              label={pillLabel.booth}
              sponsor={r.name}
              states={pillStates.booth}
              done={pillDone("booth", status)}
              busy={busy}
              onToggle={() =>
                writes.changeStatus(
                  r.name,
                  statusAfterPill(
                    "booth",
                    pillDone("booth", status) ? "undo" : "advance",
                  ),
                )
              }
            />
          )}
        </span>
      );
      break;
    case "briefing":
      content = (
        <Pill
          label={pillLabel.ccWorkshop}
          sponsor={r.name}
          states={pillStates.ccWorkshop}
          done={r.atCcWorkshop === true}
          busy={busy}
          onToggle={() => writes.changeCcWorkshop(r.name, !r.atCcWorkshop)}
        />
      );
      break;
    case "availability":
      content = !r.chats ? (
        <Muted>{copy.none}</Muted>
      ) : r.chats.prefsSubmittedAt ? (
        <span className="flex flex-col">
          <span>
            {c.availabilitySent(timeOf(r.chats.prefsSubmittedAt, day))}
          </span>
          {r.chats.repsChatting > 0 && (
            <Muted>
              {c.repsPlaced(r.chats.repsPlaced, r.chats.repsChatting)}
            </Muted>
          )}
        </span>
      ) : (
        <Muted>{c.noAvailability}</Muted>
      );
      break;
    case "shortlist":
      content = !r.chats ? (
        <Muted>{copy.none}</Muted>
      ) : r.chats.shortlistSubmittedAt ? (
        c.shortlistSent(timeOf(r.chats.shortlistSubmittedAt, day))
      ) : (
        <Muted>{c.shortlistNot}</Muted>
      );
      break;
    case "invites":
      content = !r.chats ? (
        <Muted>{copy.none}</Muted>
      ) : r.chats.invites > 0 ? (
        <span className="flex flex-col">
          <span>{c.invitesOut(r.chats.accepted, r.chats.invites)}</span>
          {r.chats.scheduleSent && <Muted>{c.confirmed}</Muted>}
        </span>
      ) : (
        <Muted>{c.invitesNotOut}</Muted>
      );
      break;
    case "chats":
      content =
        r.blocks.length === 0 ? (
          <Muted>
            {r.chats && r.chats.repsChatting > 0
              ? c.repsPlaced(r.chats.repsPlaced, r.chats.repsChatting)
              : c.noChats}
          </Muted>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs">
            {r.blocks.map((b) => (
              <li key={`${b.repName}-${b.sessionId}`}>
                <span className="font-semibold text-dashboard-text-heavy">
                  {b.repName}
                </span>{" "}
                <span className="tabular-nums text-dashboard-text-medium">
                  {spanOf(b.start, b.end)} · Rm {b.room} ·{" "}
                </span>
                <span className="font-semibold tabular-nums">
                  {c.seats(b.accepted, b.waiting)}
                </span>
                {b.end <= nowMin && <Muted> · {c.blockDone}</Muted>}
              </li>
            ))}
          </ul>
        );
      break;
    case "workshop": {
      const sat = r.workshops
        .map((w, i) => ({ ...w, room: r.workshopRooms[i] ?? null }))
        .filter((w) => w.day === "Saturday");
      content = (
        <span className="flex flex-col gap-1">
          {sat.map((w) => (
            <span key={w.start} className="flex flex-col">
              <span className="font-semibold tabular-nums">
                {c.workshop(formatClock(w.start), w.room)}
              </span>
              <Muted>
                {isDone("workshop", r, day, now)
                  ? c.workshopDone
                  : c.setup(before(w.start, 30))}
              </Muted>
            </span>
          ))}
        </span>
      );
      break;
    }
    case "boothOpen":
      content = status ?? <Muted>{copy.none}</Muted>;
      break;
    case "judgingShortlist": {
      const s = r.sunday ? round1State(r.sunday) : null;
      content = !s ? (
        <Muted>{copy.none}</Muted>
      ) : s.kind === "sent" ? (
        c.judgingSent(s.teams, timeOf(s.at, day))
      ) : s.kind === "working" ? (
        c.shortlistWorking(s.scored, s.shortlisted)
      ) : (
        <Muted>{c.shortlistNotStarted}</Muted>
      );
      break;
    }
    case "judgingRoom":
      content = r.judgingRoom ?? <Muted>{c.roomMissing}</Muted>;
      break;
    case "top5":
      content = r.sunday?.finalSubmittedAt ? (
        c.topIn(timeOf(r.sunday.finalSubmittedAt, day))
      ) : r.digital ? (
        <Muted>{c.digitalTop}</Muted>
      ) : (
        <Muted>{c.topNot}</Muted>
      );
      break;
  }
  return (
    <div className="flex min-w-0 flex-col">
      <div className="min-w-0 break-words">{content}</div>
      {flags.map((f, i) => (
        <Flag key={i} flag={f} sponsorId={r.sponsorId} />
      ))}
    </div>
  );
}

/** Contacts and package: everything about a sponsor, any day. */
function Details({
  row: r,
  day,
  me,
  contactNames,
}: {
  row: Row;
  day: RunOfShowDay;
  me: OrganizerContact | null;
  contactNames: readonly string[];
}) {
  const d = copy.details;
  const mineLead = !!me && leadsSponsor(r.hwContact, me, contactNames);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-dashboard-text-heavy">
        {d.heading}
      </h3>
      {/* One fact per row, label | value (Jazz, 2026-11-20). */}
      <dl className="m-0 flex max-w-3xl flex-col divide-y divide-dashboard-border-subtle border-y border-dashboard-border-subtle text-sm">
        <Item label={d.hwLead}>
          {r.hwContact ? (
            mineLead ? (
              `${r.hwContact} (${d.you})`
            ) : (
              r.hwContact
            )
          ) : (
            <Muted>{d.noLead}</Muted>
          )}
        </Item>
        <Item label={d.mainContact}>
          {r.companyContact || <Muted>{copy.none}</Muted>}
        </Item>
        <Item label={d.reps}>
          {r.reps.length === 0 ? (
            <Muted>{d.noReps}</Muted>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {r.reps.map((rep) => (
                <li
                  key={rep.id}
                  className="flex flex-wrap items-center gap-x-2"
                >
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {rep.name}
                    {rep.isPrimary && (
                      <PrimaryCrownIcon
                        label={sponsorOrganizerCopy.mine.people.primary}
                      />
                    )}
                  </span>
                  <PhoneCopy name={rep.name} phone={rep.phone} />
                </li>
              ))}
            </ul>
          )}
        </Item>
        {!r.digital && (
          <Item label={d.booth}>
            {r.boothLocation && r.boothLocation !== "TBD"
              ? r.boothLocation
              : copy.cell.boothTbd}
          </Item>
        )}
        <Item label={d.workshops}>
          {r.workshops.length === 0 ? (
            <Muted>{d.noWorkshop}</Muted>
          ) : (
            r.workshops.map((w, i) => (
              <span key={i} className="block tabular-nums">
                {`${copy.dayShort[w.day]} ${formatClock(w.start)}`}
                {r.workshopRooms[i] ? ` · ${r.workshopRooms[i]}` : ""}
              </span>
            ))
          )}
        </Item>
        <Item label={d.prize}>
          {r.digital && r.prizeTrack ? (
            d.prizeDigital
          ) : r.prizeTrack ? (
            d.prizeInPerson
          ) : (
            <Muted>{d.prizeNone}</Muted>
          )}
        </Item>
        <Item label={d.portal}>
          <CopyLinkButton sponsorId={r.sponsorId} name={r.name} showUrl />
        </Item>
        {r.notes && (
          <Item label={d.notes}>
            <span className="whitespace-pre-line text-dashboard-text-medium">
              {r.notes}
            </span>
          </Item>
        )}
      </dl>
      {r.sponsorId && (
        <div className="flex flex-wrap gap-1.5">
          {!r.digital && day !== "Sunday" && (
            <DashboardButton variant="link" asChild className="-ml-2">
              <Link
                href={organizerHomeHref({
                  tab: "coffee",
                  sponsor: r.sponsorId,
                })}
                shallow
                scroll={false}
              >
                <Coffee aria-hidden />
                {d.openCoffee}
                <span className="sr-only"> {r.name}</span>
              </Link>
            </DashboardButton>
          )}
          {r.prizeTrack && (
            <DashboardButton variant="link" asChild className="-ml-2">
              <Link
                href={organizerHomeHref({
                  tab: "judging",
                  sponsor: r.sponsorId,
                })}
                shallow
                scroll={false}
              >
                <Gavel aria-hidden />
                {d.openJudging}
                <span className="sr-only"> {r.name}</span>
              </Link>
            </DashboardButton>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-start gap-x-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="pt-0.5 text-xs font-semibold text-dashboard-text-light">
        {label}
      </dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}
