import { useRouter } from "next/router";
import * as Dialog from "@radix-ui/react-dialog";
import { Clock, MapPin, User, Users, X } from "lucide-react";
import { IveyWalkNote } from "~/components/ivey-walk-note";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { iveyWalkCopy } from "~/content/ivey-walk";
import { scheduleCopy } from "~/content/sponsor-schedule";
import {
  formatClock,
  locationFor,
  type RunOfShowDay,
  type RunOfShowTask,
  type WorkshopInfo,
} from "~/lib/run-of-show";
import { RUN_OF_SHOW_DATES } from "~/lib/run-of-show-time";
import {
  entriesAt,
  formatMinutes,
  tasksInEntry,
  workshopForEntry,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";
import { cn } from "~/lib/utils";

const copy = scheduleCopy.timeline;
const details = copy.details;

export type GridMode = "sponsor" | "organizer";

// Everything about one grid block, so nothing is lost to a short cell.
// Bottom sheet on phones, centred dialog on wider screens (same pattern as
// the help sheet). Radix traps focus and closes on Escape; the grid passes
// onCloseAutoFocus to put focus back on the block that opened it.
export function EventDetails({
  entry,
  day,
  mode,
  sponsorName,
  workshops,
  tasks,
  entries,
  onClose,
  onCloseAutoFocus,
}: {
  entry: TimelineEntry | null;
  day: RunOfShowDay;
  mode: GridMode;
  sponsorName?: string;
  workshops: readonly WorkshopInfo[];
  tasks: readonly RunOfShowTask[];
  /** Everything on the grid, for "happening at this time" on a task. */
  entries: readonly TimelineEntry[];
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog.Root open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 duration-200 ease-out data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        {/* Phones: a bottom sheet that slides up from the edge and back
            down on close. Wider: a centred dialog that fades and grows
            from 95% (centred with margins, not translate, so the
            animation's transform doesn't knock it off centre). Enter
            200-250ms ease-out, exit faster; reduced motion: none. */}
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed z-50 flex max-h-[90dvh] w-full flex-col gap-5 overflow-y-auto overscroll-contain bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "ease-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full motion-reduce:animate-none",
            "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[520px] sm:rounded-dashboard-2xl sm:pb-6",
            "sm:data-[state=closed]:duration-150 sm:data-[state=open]:duration-200 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
          )}
        >
          {entry && (
            <Body
              entry={entry}
              day={day}
              mode={mode}
              sponsorName={sponsorName}
              workshops={workshops}
              tasks={tasks}
              entries={entries}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({
  entry,
  day,
  mode,
  sponsorName,
  workshops,
  tasks,
  entries,
}: {
  entry: TimelineEntry;
  day: RunOfShowDay;
  mode: GridMode;
  sponsorName?: string;
  workshops: readonly WorkshopInfo[];
  tasks: readonly RunOfShowTask[];
  entries: readonly TimelineEntry[];
}) {
  const date = Number(RUN_OF_SHOW_DATES[day].slice(8));
  const isTask = entry.kind === "task";
  const booking = entry.booking ?? null;
  const sponsors = booking
    ? [booking.sponsorName]
    : (entry.item?.sponsors ?? []);
  const mine =
    mode === "sponsor" && !!sponsorName && sponsors.includes(sponsorName);
  const location = entry.location
    ? mine && sponsorName
      ? locationFor(entry.location, sponsorName)
      : entry.location
    : null;
  const workshop =
    isTask || booking ? null : workshopForEntry(entry, day, workshops);
  const during =
    mode === "organizer" && !isTask && !booking
      ? tasksInEntry(entry, day, tasks)
      : [];
  const happening = isTask ? entriesAt(entry.start, entries) : [];
  const owner = entry.task?.owner ?? null;
  // A sponsor's own Ivey chat: Check map opens their portal map on Ivey.
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const mapHref = uuid ? iveyWalkCopy.sponsorMapPath(uuid) : null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-dashboard-text-light">
            {copy.categories[entry.category]}
          </span>
          <Dialog.Title className="m-0 whitespace-pre-line break-words text-xl font-semibold">
            {entry.title}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {isTask
              ? details.taskDescription
              : booking
                ? copy.booking.description
                : details.description}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label={details.close}
          className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:bg-dashboard-bg-highlight"
        >
          <X aria-hidden className="size-5" />
        </Dialog.Close>
      </div>

      <dl className="m-0 flex flex-col gap-3 text-base">
        <Row
          icon={<Clock aria-hidden className="size-4" />}
          label={details.when}
        >
          {isTask
            ? details.taskTime(day, date, formatMinutes(entry.start))
            : details.time(
                day,
                date,
                formatMinutes(entry.start),
                formatMinutes(entry.end),
              )}
        </Row>
        {isTask ? (
          <Row
            icon={<User aria-hidden className="size-4" />}
            label={details.owner}
          >
            {owner
              ? scheduleCopy.organizer.owner(owner)
              : scheduleCopy.organizer.unowned}
          </Row>
        ) : (
          <>
            <Row
              icon={<MapPin aria-hidden className="size-4" />}
              label={details.where}
            >
              {location ?? scheduleCopy.noLocation}
              {entry.ivey && (
                <IveyWalkNote
                  who="sponsor"
                  mapHref={mapHref}
                  className="mt-1"
                />
              )}
            </Row>
            {sponsors.length > 0 && (
              <Row
                icon={<Users aria-hidden className="size-4" />}
                label={details.sponsors}
              >
                {sponsors.join(", ")}
              </Row>
            )}
            {workshop && workshop.runners.length > 0 && (
              <Row
                icon={<User aria-hidden className="size-4" />}
                label={details.runBy}
              >
                {workshop.runners.join("; ")}
              </Row>
            )}
          </>
        )}
      </dl>

      {workshop?.description && (
        <section className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold text-dashboard-text-light">
            {details.about}
          </h3>
          <p className="m-0 whitespace-pre-line break-words text-base text-dashboard-text-medium">
            {workshop.description}
          </p>
        </section>
      )}

      {/* Sheet Main event items are hackathon-wide too, but not from /live. */}
      {entry.kind === "hackathon" && !entry.item && (
        <p className="m-0 text-sm text-dashboard-text-light">
          {details.hackathonNote}
        </p>
      )}

      {booking && (
        <ListSection heading={copy.booking.who} empty={details.noTasks}>
          {booking.chats.map((c) => (
            <li
              key={c.chatId}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <span className="break-words">{c.hacker}</span>
              <span className="text-sm text-dashboard-text-light">
                {coffeeChatCopy.organizer.status[
                  c.status as keyof typeof coffeeChatCopy.organizer.status
                ] ?? c.status}
              </span>
            </li>
          ))}
        </ListSection>
      )}
      {booking && (
        <p className="m-0 text-sm text-dashboard-text-light">
          {copy.booking.liveNote}
        </p>
      )}

      {mode === "organizer" && !isTask && !booking && (
        <ListSection heading={details.tasks} empty={details.noTasks}>
          {during.map((t, i) => (
            <li key={`${t.start}-${i}`} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-dashboard-text-light">
                {formatClock(t.start)}
              </span>
              <span className="whitespace-pre-line break-words">{t.task}</span>
              <span className="text-sm text-dashboard-text-light">
                {t.owner
                  ? scheduleCopy.organizer.owner(t.owner)
                  : scheduleCopy.organizer.unowned}
              </span>
            </li>
          ))}
        </ListSection>
      )}

      {isTask && (
        <ListSection
          heading={details.happening}
          empty={details.nothingHappening}
        >
          {happening.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-dashboard-text-light">
                {copy.srTime(formatMinutes(e.start), formatMinutes(e.end))}
              </span>
              <span className="break-words">{e.title}</span>
              {e.location && (
                <span className="text-sm text-dashboard-text-light">
                  {e.location}
                </span>
              )}
            </li>
          ))}
        </ListSection>
      )}
    </>
  );
}

function ListSection({
  heading,
  empty,
  children,
}: {
  heading: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-dashboard-border-subtle pt-4">
      <h3 className="m-0 text-sm font-semibold text-dashboard-text-light">
        {heading}
      </h3>
      {children.length === 0 ? (
        <p className="m-0 text-base text-dashboard-text-medium">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>
      )}
    </section>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="flex shrink-0 pt-1 text-dashboard-text-light">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}
